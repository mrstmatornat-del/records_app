import {
  ISTTEngine,
  STTEngineConfig,
  STTEngineStatus,
  STTTranscribeOptions,
  STTTranscriptionResult,
} from './ISTTEngine';

/**
 * BrowserWhisperEngine
 *
 * Real local Whisper inference running fully on-device in a Web Worker via
 * @xenova/transformers (WebAssembly/ONNX runtime). No server round trip, no
 * cloud API key, no per-utterance token cost — the model downloads once (cached
 * by the browser) and then runs completely offline.
 *
 * This is the default engine for BOTH microphone fallback and system/meeting
 * audio, replacing the previous cloud-Gemini-per-utterance approach. Gemini is
 * reserved exclusively for the one-shot end-of-meeting summary and Q&A.
 */

// Common Whisper hallucinations on silence/music-only audio (a well-known artifact
// of Whisper being trained on YouTube caption data). VAD already filters out most
// silence, but short/ambiguous utterances can still trigger these stock phrases.
const HALLUCINATION_PATTERN =
  /^[\s.,!?]*(thanks? for watching|thank you( so much)?( for watching)?|please (subscribe|like)( and subscribe)?|bye( bye)?|\[?(blank_audio|music|silence|no speech|inaudible)\]?|you)[\s.,!?]*$/i;

function resolveModel(language: string, modelSize: 'tiny' | 'base' | 'small') {
  const isVietnamese = language.startsWith('vi');
  return {
    // English-only checkpoints (".en") are smaller/faster; Vietnamese needs the
    // multilingual checkpoint.
    modelId: isVietnamese ? `Xenova/whisper-${modelSize}` : `Xenova/whisper-${modelSize}.en`,
    whisperLanguage: isVietnamese ? 'vietnamese' : 'english',
  };
}

export class BrowserWhisperEngine implements ISTTEngine {
  public readonly id = 'browser-whisper-wasm';
  public readonly name = 'Local Whisper (in-browser WebAssembly, offline & free)';

  private status: STTEngineStatus = 'uninitialized';
  private errorCode: string | null = null;
  private errorMessage: string | null = null;
  private config: STTEngineConfig = { language: 'en', modelSize: 'base' };

  private worker: Worker | null = null;
  private modelId: string | null = null;
  private whisperLanguage = 'english';
  private requestCounter = 0;
  private pending: Map<number, { resolve: (v: any) => void; reject: (e: any) => void }> = new Map();
  private initPromise: Promise<void> | null = null;

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
    const { modelId, whisperLanguage } = resolveModel(this.config.language, this.config.modelSize);
    this.whisperLanguage = whisperLanguage;

    if (this.worker && this.modelId === modelId && this.status === 'ready') {
      return;
    }
    if (this.initPromise && this.modelId === modelId) {
      return this.initPromise;
    }

    this.modelId = modelId;
    this.status = 'loading';
    this.errorCode = null;
    this.errorMessage = null;

    this.initPromise = (async () => {
      try {
        if (typeof Worker === 'undefined') {
          throw new Error('Web Workers are not supported in this environment.');
        }
        if (!this.worker) {
          this.worker = new Worker(new URL('../../workers/whisperWorker.ts', import.meta.url), {
            type: 'module',
          });
          this.worker.onmessage = (ev) => this.handleWorkerMessage(ev);
          this.worker.onerror = (ev) => {
            this.status = 'unavailable';
            this.errorCode = 'SYSTEM_STT_UNAVAILABLE';
            this.errorMessage = ev.message || 'Local Whisper worker crashed unexpectedly.';
          };
        }

        await this.sendRequest({ type: 'load', modelId });
        this.status = 'ready';
      } catch (err: any) {
        this.status = 'unavailable';
        this.errorCode = 'SYSTEM_STT_UNAVAILABLE';
        this.errorMessage =
          err?.message ||
          'Failed to load the local Whisper model. It needs an internet connection once to download (~40-150MB, then cached and fully offline).';
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public async transcribe(
    pcm16: Int16Array,
    sampleRate: number,
    options: STTTranscribeOptions
  ): Promise<STTTranscriptionResult> {
    if (!pcm16 || pcm16.length === 0) {
      throw new Error('PCM audio buffer is empty.');
    }
    if (!this.worker || this.status === 'uninitialized' || this.status === 'loading') {
      await this.initialize(this.config);
    }
    if (!this.worker || this.status === 'unavailable') {
      const err = new Error(this.errorMessage || 'Local Whisper engine is unavailable.');
      (err as any).code = this.errorCode || 'SYSTEM_STT_UNAVAILABLE';
      throw err;
    }

    this.status = 'processing';

    // Whisper expects 16kHz mono Float32 samples in [-1, 1].
    const audio = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      audio[i] = pcm16[i] / 32768;
    }

    try {
      const text = await this.sendRequest(
        { type: 'transcribe', modelId: this.modelId, whisperLanguage: this.whisperLanguage, audio },
        [audio.buffer]
      );

      const cleaned = (text || '').trim();
      if (!cleaned || HALLUCINATION_PATTERN.test(cleaned)) {
        this.status = 'ready';
        throw new Error('Local Whisper produced no reliable speech for this audio segment.');
      }

      this.status = 'completed';
      return {
        text: cleaned,
        confidence: 0.9,
        startTime: options.startTime,
        endTime: options.endTime,
        source: options.source,
        speaker: options.speaker,
        isFinal: true,
      };
    } catch (err: any) {
      if ((this.status as STTEngineStatus) !== 'unavailable') {
        this.status = 'ready';
      }
      throw err;
    }
  }

  public async dispose(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.modelId = null;
    this.status = 'uninitialized';
    this.errorCode = null;
    this.errorMessage = null;
    this.pending.clear();
  }

  private sendRequest(payload: Record<string, any>, transfer: Transferable[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestCounter;
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ ...payload, id }, transfer);
    });
  }

  private handleWorkerMessage(event: MessageEvent) {
    const data = event.data || {};
    if (data.type === 'progress') return;

    const entry = this.pending.get(data.id);
    if (!entry) return;
    this.pending.delete(data.id);

    if (data.type === 'error') {
      entry.reject(new Error(data.error || 'Local Whisper worker error.'));
    } else if (data.type === 'ready') {
      entry.resolve(undefined);
    } else if (data.type === 'result') {
      entry.resolve(data.text);
    }
  }
}

export const browserWhisperEngine = new BrowserWhisperEngine();
