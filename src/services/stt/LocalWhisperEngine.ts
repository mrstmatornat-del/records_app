import {
  ISTTEngine,
  STTEngineConfig,
  STTEngineStatus,
  STTTranscribeOptions,
  STTTranscriptionResult,
} from './ISTTEngine';

export type DirectTranscriberFn = (
  pcm16: Int16Array,
  sampleRate: number,
  options: STTTranscribeOptions
) => Promise<string | null>;

/**
 * LocalWhisperEngine
 * 
 * Production adapter for local Whisper / faster-whisper / whisper.cpp inference.
 * Receives 16kHz mono 16-bit PCM utterances sliced by VAD, and delivers clean,
 * speaker-attributed, timestamped transcript segments.
 * 
 * Never silently returns an empty string: if unavailable, enters SYSTEM_STT_UNAVAILABLE state.
 */
export class LocalWhisperEngine implements ISTTEngine {
  public readonly id = 'local-whisper-engine';
  public readonly name = 'Local Whisper Engine (faster-whisper / whisper.cpp)';

  private status: STTEngineStatus = 'uninitialized';
  private errorCode: string | null = null;
  private errorMessage: string | null = null;
  private config: STTEngineConfig = { language: 'en', modelSize: 'base' };
  private customTranscriber: DirectTranscriberFn | null = null;

  constructor(customTranscriber?: DirectTranscriberFn) {
    if (customTranscriber) {
      this.customTranscriber = customTranscriber;
    }
  }

  public getStatus(): STTEngineStatus {
    return this.status;
  }

  public getErrorCode(): string | null {
    return this.errorCode;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public setCustomTranscriber(fn: DirectTranscriberFn | null) {
    this.customTranscriber = fn;
  }

  public async initialize(config: STTEngineConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    this.status = 'ready';
    this.errorCode = null;
    this.errorMessage = null;

    // Check backend STT service health if running in browser
    if (typeof window !== 'undefined' && !this.customTranscriber) {
      try {
        const res = await fetch('/api/stt/status');
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ready') {
            this.status = 'ready';
            return;
          }
        }
      } catch (err: any) {
        // Backend not reachable or offline
        console.warn('[LocalWhisperEngine] STT status probe failed:', err);
      }
    }
  }

  public async transcribe(
    pcm16: Int16Array,
    sampleRate: number,
    options: STTTranscribeOptions
  ): Promise<STTTranscriptionResult> {
    if (!pcm16 || pcm16.length === 0) {
      throw new Error('PCM audio buffer is empty.');
    }

    this.status = 'processing';
    this.errorCode = null;
    this.errorMessage = null;

    // 1. Direct transcriber (e.g. Injected worker, whisper.cpp WebAssembly, or test mock)
    if (this.customTranscriber) {
      try {
        const text = await this.customTranscriber(pcm16, sampleRate, options);
        if (text && text.trim().length > 0) {
          this.status = 'completed';
          return {
            text: text.trim(),
            confidence: 0.94,
            startTime: options.startTime,
            endTime: options.endTime,
            source: options.source,
            speaker: options.speaker,
            isFinal: true,
          };
        } else {
          this.status = 'ready';
          throw new Error('STT returned empty transcript for speech utterance.');
        }
      } catch (err: any) {
        this.status = 'error';
        this.errorCode = 'STT_INFERENCE_ERROR';
        this.errorMessage = err.message || 'Direct STT inference failed.';
        throw err;
      }
    }

    // 2. Transcribe via local server PCM endpoint
    try {
      // Convert Int16Array PCM to Base64 string
      const pcmBytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
      let binary = '';
      const len = pcmBytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(pcmBytes[i]);
      }
      const pcmBase64 = btoa(binary);

      const response = await fetch('/api/stt/transcribe-pcm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pcmBase64,
          sampleRate,
          language: this.config.language.startsWith('vi') ? 'vi' : 'en',
          modelSize: this.config.modelSize,
          source: options.source,
          startTime: options.startTime,
          endTime: options.endTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const code = data.code || 'SYSTEM_STT_UNAVAILABLE';
        this.status = 'unavailable';
        this.errorCode = code;
        this.errorMessage = data.message || data.error || 'System STT engine unavailable.';
        const err = new Error(this.errorMessage || 'System STT unavailable');
        (err as any).code = code;
        throw err;
      }

      if (data.text && typeof data.text === 'string' && data.text.trim().length > 0) {
        this.status = 'completed';
        return {
          text: data.text.trim(),
          confidence: data.confidence || 0.92,
          startTime: options.startTime,
          endTime: options.endTime,
          source: options.source,
          speaker: options.speaker,
          isFinal: true,
        };
      }

      this.status = 'ready';
      throw new Error('STT produced no text for this audio segment.');
    } catch (err: any) {
      if (!this.errorCode) {
        this.status = 'unavailable';
        this.errorCode = 'SYSTEM_STT_UNAVAILABLE';
        this.errorMessage = err.message || 'System STT engine unavailable.';
      }
      throw err;
    }
  }

  public async dispose(): Promise<void> {
    this.status = 'uninitialized';
    this.errorCode = null;
    this.errorMessage = null;
  }
}

export const localWhisperEngine = new LocalWhisperEngine();
