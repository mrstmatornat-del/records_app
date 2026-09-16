import { TranscriptSegment, STTLanguage } from '../types';

export class AudioStreamManager {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recognition: any | null = null;
  private isListening = false;
  private startTime = 0;
  private selectedLang: STTLanguage = 'en-US';

  private onTranscriptUpdate: ((segment: TranscriptSegment) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onVolumeChange: ((volumePercent: number) => void) | null = null;
  private volumeInterval: any = null;
  private sessionTag = 0;
  private totalFinalSegments = 0;

  constructor() {}

  // Check Web Speech API availability
  public isSpeechRecognitionSupported(): boolean {
    return typeof window !== 'undefined' && (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);
  }

  public setLanguage(lang: STTLanguage) {
    this.selectedLang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  private liveChunkInterval: any = null;
  private lastSliceChunkIndex = 0;

  // Start audio recording and live speech recognition
  public async startStream(
    source: 'mic' | 'tab' | 'combined' | 'file',
    lang: STTLanguage = 'en-US',
    onTranscript: (segment: TranscriptSegment) => void,
    onError: (err: string) => void,
    onVolume?: (vol: number) => void,
    onLiveAudioSlice?: (base64: string, mimeType: string, elapsedSec: number) => void
  ): Promise<MediaStream | null> {
    this.selectedLang = lang;
    this.onTranscriptUpdate = onTranscript;
    this.onErrorCallback = onError;
    this.onVolumeChange = onVolume || null;
    this.isListening = true;
    this.startTime = Date.now();
    this.sessionTag = Date.now();
    this.totalFinalSegments = 0;
    this.audioChunks = [];
    this.lastSliceChunkIndex = 0;

    try {
      // 1. Acquire MediaStream based on chosen source
      if (source === 'mic') {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } else if (source === 'tab') {
        // Capture browser tab / app window audio
        const isInIframe = window.self !== window.top;
        try {
          this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        } catch (e: any) {
          console.warn("DisplayMedia capture error:", e);
          if (isInIframe) {
            throw new Error(
              "⚠️ Trình duyệt hạn chế chọn Thẻ âm thanh khi nằm trong Khung Xem Trước (iFrame preview). Vui lòng bấm vào nút 'Mở trong tab mới' (Open in new tab ↗️) ở góc trên bên phải màn hình để dùng tính năng bắt âm thanh Thẻ trình duyệt/Cửa sổ!"
            );
          }
          if (e.name === 'NotAllowedError' || e.message?.includes('Permission denied')) {
            throw new Error("Bạn đã hủy hoặc từ chối cửa sổ chọn Thẻ/Màn hình. Hãy nhấn 'START Recording' lại và chọn tab cần thu.");
          }
          throw new Error(`Không thể khởi tạo chia sẻ âm thanh thẻ: ${e.message || "Bị từ chối quyền"}`);
        }

        const audioTracks = this.mediaStream.getAudioTracks();
        if (audioTracks.length === 0) {
          this.mediaStream.getTracks().forEach(t => t.stop());
          this.mediaStream = null;
          throw new Error("⚠️ Chưa chọn âm thanh! Hãy bấm 'START Recording' lại, chọn Chrome Tab và TÍCH CHỌN 'Chia sẻ âm thanh' (Share audio) ở góc dưới bên trái cửa sổ chọn!");
        }
      } else if (source === 'combined') {
        // Dual-Stream Mode (Microphone + Browser Tab Combined for Interviews)
        const isInIframe = window.self !== window.top;
        let tabStream: MediaStream | null = null;
        let micStream: MediaStream | null = null;

        try {
          tabStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        } catch (e: any) {
          if (isInIframe) {
            throw new Error(
              "⚠️ Vui lòng mở ứng dụng trong Tab Mới ('Open in new tab ↗️') để cấp quyền chia sẻ âm thanh Thẻ Web và Microphone cùng lúc!"
            );
          }
          throw new Error("Không thể chọn Thẻ trình duyệt cho Dual-Stream Interview mode.");
        }

        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
        } catch (micErr) {
          console.warn("Mic access failed in combined mode, falling back to tab only:", micErr);
        }

        // Mix both streams in Web Audio API
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx();
        const dest = this.audioContext.createMediaStreamDestination();

        if (tabStream && tabStream.getAudioTracks().length > 0) {
          const tabNode = this.audioContext.createMediaStreamSource(tabStream);
          tabNode.connect(dest);
          try {
            tabNode.connect(this.audioContext.destination); // Speaker out so user hears interviewer
          } catch (e) {}
        }

        if (micStream && micStream.getAudioTracks().length > 0) {
          const micNode = this.audioContext.createMediaStreamSource(micStream);
          micNode.connect(dest);
        }

        this.mediaStream = dest.stream;
      }

      // 2. Setup Web Audio Analyser Node for Visualizer & Volume Meter
      if (this.mediaStream && this.mediaStream.getAudioTracks().length > 0) {
        if (!this.audioContext) {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          this.audioContext = new AudioCtx();
        }
        const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        sourceNode.connect(this.analyser);

        // For browser tab capture, route audio to speakers so user can hear the meeting/interview
        if (source === 'tab') {
          try {
            sourceNode.connect(this.audioContext.destination);
          } catch (destErr) {
            console.warn("Could not connect tab audio to destination speakers:", destErr);
          }
        }

        // Track audio input volume level
        if (this.onVolumeChange) {
          const pcmData = new Uint8Array(32);
          this.volumeInterval = setInterval(() => {
            if (this.analyser && this.isListening) {
              this.analyser.getByteFrequencyData(pcmData);
              let sum = 0;
              for (let i = 0; i < pcmData.length; i++) sum += pcmData[i];
              const avg = sum / pcmData.length;
              const percent = Math.min(100, Math.round((avg / 128) * 100));
              if (this.onVolumeChange) this.onVolumeChange(percent);
            }
          }, 100);
        }

        // Setup MediaRecorder for real-time streaming audio slices
        try {
          const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? { mimeType: 'audio/webm;codecs=opus' }
            : MediaRecorder.isTypeSupported('audio/mp4')
            ? { mimeType: 'audio/mp4' }
            : undefined;

          this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
          this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              this.audioChunks.push(event.data);
            }
          };
          this.mediaRecorder.start(1000); // Record audio chunks

          // Periodic real-time slice transcriber for live meetings / interviews (every 3 seconds)
          if (onLiveAudioSlice) {
            this.liveChunkInterval = setInterval(() => {
              if (!this.isListening || this.audioChunks.length <= 1) return;

              // Ensure the slice ALWAYS includes audioChunks[0] (the WebM EBML header chunk)
              const startIndex = Math.max(1, this.lastSliceChunkIndex);
              if (this.audioChunks.length <= startIndex) return;

              const newChunks = this.audioChunks.slice(startIndex);
              this.lastSliceChunkIndex = this.audioChunks.length;

              if (newChunks.length > 0 && this.mediaRecorder) {
                const mime = this.mediaRecorder.mimeType || 'audio/webm';
                // Combine EBML header chunk with new cluster chunks for valid WebM file
                const validSliceChunks = [this.audioChunks[0], ...newChunks];
                const sliceBlob = new Blob(validSliceChunks, { type: mime });

                if (sliceBlob.size > 800) {
                  sliceBlob.arrayBuffer().then((buffer) => {
                    const bytes = new Uint8Array(buffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                      binary += String.fromCharCode(bytes[i]);
                    }
                    const b64 = btoa(binary);
                    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
                    if (b64 && onLiveAudioSlice && this.isListening) {
                      onLiveAudioSlice(b64, mime, elapsed);
                    }
                  }).catch(err => console.warn("Live slice b64 error:", err));
                }
              }
            }, 3000); // 3-second slice real-time interval for fast streaming
          }
        } catch (recErr) {
          console.warn("MediaRecorder setup warning:", recErr);
        }
      }

      // 3. Setup Web Speech Recognition API for free, instant real-time STT
      this.setupSpeechRecognition();

      return this.mediaStream;
    } catch (err: any) {
      this.isListening = false;
      const errorMsg = err.message || "Could not access audio device.";
      if (this.onErrorCallback) this.onErrorCallback(errorMsg);
      throw err;
    }
  }

  private setupSpeechRecognition() {
    if (!this.isSpeechRecognitionSupported()) {
      if (this.onErrorCallback) {
        this.onErrorCallback("Browser Speech Recognition API is not supported in this browser window. Gemini Multimodal Audio transcription will be used automatically upon ending!");
      }
      return;
    }

    try {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRec();

      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.selectedLang;
      this.recognition.maxAlternatives = 1;

      let highestIndexInBatch = -1;

      this.recognition.onresult = (event: any) => {
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcriptText = result[0].transcript;
          const isFinal = result.isFinal;

          if (transcriptText && transcriptText.trim().length > 0) {
            const segId = `seg-${this.sessionTag}-${this.totalFinalSegments + i}`;
            const segment: TranscriptSegment = {
              id: segId,
              timestamp: Math.round(elapsedSeconds),
              text: transcriptText.trim(),
              isFinal,
              speaker: 'Speaker',
            };

            if (isFinal && i > highestIndexInBatch) {
              highestIndexInBatch = i;
            }

            if (this.onTranscriptUpdate) {
              this.onTranscriptUpdate(segment);
            }
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn("Speech recognition notice:", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          if (this.onErrorCallback) {
            this.onErrorCallback("Microphone or speech service permission denied by browser. Gemini AI will transcribe your recorded audio when you click END.");
          }
        }
      };

      this.recognition.onend = () => {
        if (highestIndexInBatch >= 0) {
          this.totalFinalSegments += (highestIndexInBatch + 1);
          highestIndexInBatch = -1;
        }

        // Auto restart if user didn't hit End/Stop and is still active
        if (this.isListening && this.recognition) {
          setTimeout(() => {
            if (this.isListening && this.recognition) {
              try {
                this.recognition.start();
              } catch (e) {
                // Ignore silent restart errors
              }
            }
          }, 200);
        }
      };

      this.recognition.start();
    } catch (err) {
      console.warn("Speech recognition initialization failed, falling back to recorded audio AI transcription:", err);
    }
  }

  // Get current frequency data array for canvas visualizer
  public getFrequencyData(outputArray: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(outputArray);
    } else {
      outputArray.fill(0);
    }
  }

  // Stop recording stream and return audio Blob & Base64
  public async stopStream(): Promise<{ audioBlob?: Blob; audioBase64?: string; mimeType?: string; durationSeconds: number }> {
    this.isListening = false;
    const durationSeconds = (Date.now() - this.startTime) / 1000;

    if (this.volumeInterval) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }

    if (this.liveChunkInterval) {
      clearInterval(this.liveChunkInterval);
      this.liveChunkInterval = null;
    }

    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.stop();
      } catch (e) {
        console.warn("Error stopping recognition:", e);
      }
      this.recognition = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn("Error stopping media recorder:", e);
      }
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (e) {
        console.warn("AudioContext close error:", e);
      }
      this.audioContext = null;
    }

    let audioBlob: Blob | undefined;
    let audioBase64: string | undefined;
    let mimeType = 'audio/webm';

    if (this.audioChunks.length > 0) {
      mimeType = this.audioChunks[0].type || 'audio/webm';
      audioBlob = new Blob(this.audioChunks, { type: mimeType });

      // Convert Blob to Base64 string for Gemini API
      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        audioBase64 = btoa(binary);
      } catch (b64Err) {
        console.error("Failed to convert audio blob to Base64:", b64Err);
      }
    }

    return { audioBlob, audioBase64, mimeType, durationSeconds };
  }
}
