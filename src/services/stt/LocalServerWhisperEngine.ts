import {
  ISTTEngine,
  STTEngineConfig,
  STTEngineStatus,
  STTTranscribeOptions,
  STTTranscriptionResult,
} from './ISTTEngine';

/**
 * LocalServerWhisperEngine
 *
 * Talks to `/api/stt/transcribe-local` on this app's own Express server, which
 * runs a real local Whisper model (@xenova/transformers) in the Node process —
 * see server/localWhisperEngine.ts. It's a same-origin call, identical in
 * shape to the existing /api/analyze-session and /api/ask-session requests,
 * so it isn't affected by third-party-CDN or cross-origin restrictions a
 * sandboxed preview iframe or a packaged Electron (file://) build might
 * impose on a browser-side Worker. The model still runs entirely on the
 * user's own machine — no cloud API, no per-utterance token cost. Gemini is
 * reserved exclusively for the one-shot end-of-meeting summary/Q&A.
 */
export class LocalServerWhisperEngine implements ISTTEngine {
  public readonly id = 'local-server-whisper';
  public readonly name = 'Local Whisper (runs on this machine via the app server)';

  private status: STTEngineStatus = 'uninitialized';
  private errorCode: string | null = null;
  private errorMessage: string | null = null;
  private config: STTEngineConfig = { language: 'en', modelSize: 'base' };

  public getStatus(): STTEngineStatus {
    return this.status;
  }

  public getErrorCode(): string | null {
    return this.errorCode;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public async initialize(config: STTEngineConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    this.status = 'ready';
    this.errorCode = null;
    this.errorMessage = null;
  }

  public async transcribe(
    pcm16: Int16Array,
    _sampleRate: number,
    options: STTTranscribeOptions
  ): Promise<STTTranscriptionResult> {
    if (!pcm16 || pcm16.length === 0) {
      throw new Error('PCM audio buffer is empty.');
    }

    this.status = 'processing';
    this.errorCode = null;
    this.errorMessage = null;

    try {
      const pcmBytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
      let binary = '';
      for (let i = 0; i < pcmBytes.byteLength; i++) {
        binary += String.fromCharCode(pcmBytes[i]);
      }
      const pcmBase64 = btoa(binary);

      const response = await fetch('/api/stt/transcribe-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pcmBase64,
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
        this.errorMessage = data.message || data.error || 'Local Whisper server engine unavailable.';
        const err = new Error(this.errorMessage || 'Local Whisper unavailable');
        (err as any).code = code;
        throw err;
      }

      if (data.text && typeof data.text === 'string' && data.text.trim().length > 0) {
        this.status = 'completed';
        return {
          text: data.text.trim(),
          confidence: data.confidence || 0.9,
          startTime: options.startTime,
          endTime: options.endTime,
          source: options.source,
          speaker: options.speaker,
          isFinal: true,
        };
      }

      this.status = 'ready';
      throw new Error('Local Whisper produced no reliable speech for this audio segment.');
    } catch (err: any) {
      if (!this.errorCode) {
        this.status = 'ready';
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

export const localServerWhisperEngine = new LocalServerWhisperEngine();
