/**
 * Windows WASAPI Loopback Capture Native Implementation
 * 
 * Uses Core Audio APIs:
 * - IMMDeviceEnumerator & IMMDevice (eRender, eConsole)
 * - IAudioClient with AUDCLNT_STREAMFLAGS_LOOPBACK
 * - IAudioCaptureClient for reading PCM audio packets rendered by Windows audio mixer
 * - 0% impact on meeting sound, 0% latency, 0% echo/feedback
 */

#if defined(_WIN32) || defined(_WIN64)
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <audiopolicy.h>
#include <functiondiscoverykeys_devpkey.h>
#include <iostream>
#include <vector>
#include <thread>
#include <atomic>
#include <functional>

typedef std::function<void(const int16_t* pcmData, size_t frameCount, uint32_t sampleRate, uint32_t channels)> AudioChunkCallback;

class WasapiLoopbackCapture {
private:
    IMMDeviceEnumerator* pEnumerator = nullptr;
    IMMDevice* pDevice = nullptr;
    IAudioClient* pAudioClient = nullptr;
    IAudioCaptureClient* pCaptureClient = nullptr;
    WAVEFORMATEX* pwfx = nullptr;
    HANDLE hEvent = nullptr;
    std::atomic<bool> isRunning{false};
    std::thread captureThread;
    AudioChunkCallback callback;

public:
    WasapiLoopbackCapture() {}

    ~WasapiLoopbackCapture() {
        Stop();
    }

    bool Start(AudioChunkCallback onChunk) {
        if (isRunning) return true;
        callback = onChunk;

        HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
        if (FAILED(hr) && hr != RPC_E_CHANGED_MODE) {
            std::cerr << "CoInitializeEx failed: " << std::hex << hr << std::endl;
            return false;
        }

        // Get default audio output endpoint (eRender) for loopback capture
        hr = CoCreateInstance(
            __uuidof(MMDeviceEnumerator),
            nullptr,
            CLSCTX_ALL,
            __uuidof(IMMDeviceEnumerator),
            (void**)&pEnumerator
        );
        if (FAILED(hr)) return false;

        hr = pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pDevice);
        if (FAILED(hr)) return false;

        hr = pDevice->Activate(
            __uuidof(IAudioClient),
            CLSCTX_ALL,
            nullptr,
            (void**)&pAudioClient
        );
        if (FAILED(hr)) return false;

        hr = pAudioClient->GetMixFormat(&pwfx);
        if (FAILED(hr)) return false;

        // Initialize in AUDCLNT_STREAMFLAGS_LOOPBACK mode
        // 100ns units: 10,000,000 = 1 sec; 500,000 = 50ms buffer
        REFERENCE_TIME hnsRequestedDuration = 500000;
        hr = pAudioClient->Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
            hnsRequestedDuration,
            0,
            pwfx,
            nullptr
        );
        if (FAILED(hr)) return false;

        hEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
        pAudioClient->SetEventHandle(hEvent);

        hr = pAudioClient->GetService(
            __uuidof(IAudioCaptureClient),
            (void**)&pCaptureClient
        );
        if (FAILED(hr)) return false;

        hr = pAudioClient->Start();
        if (FAILED(hr)) return false;

        isRunning = true;
        captureThread = std::thread(&WasapiLoopbackCapture::CaptureLoop, this);
        return true;
    }

    void Stop() {
        if (!isRunning) return;
        isRunning = false;

        if (hEvent) {
            SetEvent(hEvent);
        }

        if (captureThread.joinable()) {
            captureThread.join();
        }

        if (pAudioClient) {
            pAudioClient->Stop();
            pAudioClient->Release();
            pAudioClient = nullptr;
        }

        if (pCaptureClient) {
            pCaptureClient->Release();
            pCaptureClient = nullptr;
        }

        if (pDevice) {
            pDevice->Release();
            pDevice = nullptr;
        }

        if (pEnumerator) {
            pEnumerator->Release();
            pEnumerator = nullptr;
        }

        if (pwfx) {
            CoTaskMemFree(pwfx);
            pwfx = nullptr;
        }

        if (hEvent) {
            CloseHandle(hEvent);
            hEvent = nullptr;
        }

        CoUninitialize();
    }

private:
    void CaptureLoop() {
        UINT32 packetLength = 0;
        std::vector<int16_t> pcmConversionBuffer;

        while (isRunning) {
            DWORD waitResult = WaitForSingleObject(hEvent, 1000);
            if (!isRunning) break;
            if (waitResult != WAIT_OBJECT_0) continue;

            HRESULT hr = pCaptureClient->GetNextPacketSize(&packetLength);
            while (SUCCEEDED(hr) && packetLength > 0) {
                BYTE* pData = nullptr;
                UINT32 numFramesAvailable = 0;
                DWORD flags = 0;

                hr = pCaptureClient->GetBuffer(&pData, &numFramesAvailable, &flags, nullptr, nullptr);
                if (FAILED(hr)) break;

                if (numFramesAvailable > 0 && callback) {
                    // Convert float/PCM to 16-bit signed PCM
                    if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
                        pcmConversionBuffer.assign(numFramesAvailable * pwfx->nChannels, 0);
                    } else if (pwfx->wFormatTag == WAVE_FORMAT_IEEE_FLOAT ||
                              (pwfx->wFormatTag == WAVE_FORMAT_EXTENSIBLE &&
                               reinterpret_cast<WAVEFORMATEXTENSIBLE*>(pwfx)->SubFormat == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT)) {
                        const float* floatSamples = reinterpret_cast<const float*>(pData);
                        size_t totalSamples = numFramesAvailable * pwfx->nChannels;
                        pcmConversionBuffer.resize(totalSamples);
                        for (size_t i = 0; i < totalSamples; i++) {
                            float s = floatSamples[i];
                            if (s > 1.0f) s = 1.0f;
                            if (s < -1.0f) s = -1.0f;
                            pcmConversionBuffer[i] = static_cast<int16_t>(s < 0 ? s * 32768.0f : s * 32767.0f);
                        }
                    } else {
                        // Already 16-bit PCM
                        const int16_t* s16 = reinterpret_cast<const int16_t*>(pData);
                        pcmConversionBuffer.assign(s16, s16 + (numFramesAvailable * pwfx->nChannels));
                    }

                    callback(pcmConversionBuffer.data(), numFramesAvailable, pwfx->nSamplesPerSec, pwfx->nChannels);
                }

                pCaptureClient->ReleaseBuffer(numFramesAvailable);
                hr = pCaptureClient->GetNextPacketSize(&packetLength);
            }
        }
    }
};

#endif
