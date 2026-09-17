import { TranscriptSegment, STTLanguage } from '../types';
import { VoiceActivityDetector, Utterance } from '../utils/vad';
import { detectHardwareCapabilities, HardwareProfile } from '../utils/hardwareDetector';
import { transcriptEventBus } from './TranscriptEventBus';
import { transcriptReconciler } from './TranscriptReconciler';
import { ISTTEngine, STTModelSize, STTEngineStatus } from './stt/ISTTEngine';
import { localServerWhisperEngine } from './stt/LocalServerWhisperEngine';

export interface STTServiceConfig {
  language: STTLanguage;
  modelSize: STTModelSize;
  hardwareProfile?: HardwareProfile;
}

export type TranscriptCallback = (segment: TranscriptSegment) => void;

/**
 * LocalSTTService
 * 
 * Local Realtime Speech-to-Text Pipeline Supervisor:
 * - Maintains independent pipelines for Microphone ('Me') and System Audio ('Meeting').
 * - Normalizes audio to 16kHz mono 16-bit PCM frames.
 * - Slices by Voice Activity Detection (VAD) boundaries into speech utterances.
 * - System Audio: Transcribes real utterances via ISTTEngine (Local Whisper / faster-whisper).
 * - Microphone: Uses browser SpeechRecognition (if available) with strict slot reconciliation,
 *   or falls back to ISTTEngine.
 * - Integrates with TranscriptReconciler to guarantee ZERO incremental duplicate pollution.
 * - Clearly signals SYSTEM_STT_UNAVAILABLE instead of silently returning empty strings.
 */
export class LocalSTTService {
  private config: STTServiceConfig;
  private isRunning = false;
  private micVAD: VoiceActivityDetector;
  private systemVAD: VoiceActivityDetector;
  private sttEngine: ISTTEngine;

  private partialCallbacks: Set<TranscriptCallback> = new Set();
  private finalCallbacks: Set<TranscriptCallback> = new Set();

  // Browser speech recognition for microphone stream
  private browserRecognition: any = null;
  private isBrowserRecognitionActive = false;
  private recognitionStartTime = 0;

  // Asynchronous queue for system STT to prevent blocking audio capture
  private systemTranscriptionQueue: Utterance[] = [];
  private isTranscribingSystem = false;

  constructor(config?: Partial<STTServiceConfig>, sttEngine?: ISTTEngine) {
    const hw = detectHardwareCapabilities();
    this.config = {
      language: 'en-US',
      modelSize: hw.recommendedModel,
      hardwareProfile: hw,
      ...config,
    };

    this.sttEngine = sttEngine || localServerWhisperEngine;
    this.micVAD = new VoiceActivityDetector({ energyThreshold: 0.012 });
    // System/tab audio (YouTube, Teams, Zoom) commonly arrives quieter and more
    // normalized than a close-talking mic, so it needs a lower trigger threshold
    // or speech gets silently dropped before it ever reaches STT.
    this.systemVAD = new VoiceActivityDetector({ energyThreshold: 0.008 });
  }

  public getSTTEngine(): ISTTEngine {
    return this.sttEngine;
  }

  public setSTTEngine(engine: ISTTEngine): void {
    this.sttEngine = engine;
  }

  public getHardwareProfile(): HardwareProfile {
    return this.config.hardwareProfile || detectHardwareCapabilities();
  }

  public setModelSize(size: STTModelSize) {
    this.config.modelSize = size;
  }

  public setLanguage(lang: STTLanguage) {
    this.config.language = lang;
    if (this.browserRecognition) {
      this.browserRecognition.lang = lang;
    }
  }

  public onPartialTranscript(cb: TranscriptCallback): () => void {
    this.partialCallbacks.add(cb);
    return () => this.partialCallbacks.delete(cb);
  }

  public onFinalTranscript(cb: TranscriptCallback): () => void {
    this.finalCallbacks.add(cb);
    return () => this.finalCallbacks.delete(cb);
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.micVAD = new VoiceActivityDetector({ energyThreshold: 0.012 });
    this.systemVAD = new VoiceActivityDetector({ energyThreshold: 0.008 });
    this.systemTranscriptionQueue = [];
    this.isTranscribingSystem = false;

    // Initialize local STT engine
    try {
      await this.sttEngine.initialize({
        language: this.config.language.startsWith('vi') ? 'vi' : 'en',
        modelSize: this.config.modelSize,
      });

      transcriptEventBus.emitSTTStatus({
        source: 'system',
        status: this.sttEngine.getStatus(),
        errorCode: null,
        message: 'System STT engine ready for Teams/Zoom/YouTube speech.',
      });
    } catch (err: any) {
      console.warn('[LocalSTTService] STT engine initialization notice:', err);
      transcriptEventBus.emitSTTStatus({
        source: 'system',
        status: 'unavailable',
        errorCode: 'SYSTEM_STT_UNAVAILABLE',
        message: err.message || 'System STT engine unavailable. Audio recording remains active.',
      });
    }

    this.initBrowserMicAssistant();
  }

  public stop(): void {
    this.isRunning = false;
    this.systemTranscriptionQueue = [];

    if (this.browserRecognition) {
      try {
        this.browserRecognition.onend = null;
        this.browserRecognition.onerror = null;
        this.browserRecognition.stop();
      } catch (e) {}
      this.browserRecognition = null;
      this.isBrowserRecognitionActive = false;
    }
  }

  /**
   * Receives normalized 16kHz 16-bit PCM audio frames from AudioCaptureService
   */
  public pushAudioFrame(
    source: 'microphone' | 'system',
    pcm16: Int16Array,
    timestampSeconds: number
  ): void {
    if (!this.isRunning) return;

    const vad = source === 'microphone' ? this.micVAD : this.systemVAD;
    const { utterance, isSpeech } = vad.processFrame(pcm16, timestampSeconds, source);

    // Notify event bus of active speaker source for UI visual indicators
    transcriptEventBus.emitSourceActive({
      source,
      speaker: source === 'microphone' ? 'Me' : 'Meeting',
      isActive: isSpeech,
    });

    if (utterance) {
      if (source === 'system') {
        this.enqueueSystemUtterance(utterance);
      } else if (!this.isBrowserRecognitionActive) {
        // If microphone Web Speech API is not supported in this browser, use local STT engine
        this.enqueueSystemUtterance(utterance);
      }
    }
  }

  /**
   * Non-blocking queue for system audio utterance transcription
   */
  private enqueueSystemUtterance(utterance: Utterance) {
    const duration = utterance.endTime - utterance.startTime;
    if (duration < 0.4) return; // Ignore brief mouth clicks/coughs

    this.systemTranscriptionQueue.push(utterance);
    this.processNextSystemUtterance();
  }

  private async processNextSystemUtterance() {
    if (this.isTranscribingSystem || this.systemTranscriptionQueue.length === 0) {
      return;
    }

    this.isTranscribingSystem = true;
    const utterance = this.systemTranscriptionQueue.shift()!;

    try {
      transcriptEventBus.emitSTTStatus({
        source: utterance.source,
        status: 'processing',
        errorCode: null,
        message: 'Transcribing speech utterance...',
      });

      const result = await this.sttEngine.transcribe(utterance.pcm16, 16000, {
        source: utterance.source,
        speaker: utterance.speaker,
        startTime: utterance.startTime,
        endTime: utterance.endTime,
      });

      if (result && result.text && result.text.trim().length > 0) {
        const seg: TranscriptSegment = {
          id: `stt-${Date.now()}-${Math.round(result.startTime)}`,
          startTime: result.startTime,
          endTime: result.endTime,
          timestamp: Math.round(result.startTime),
          text: result.text,
          source: result.source,
          speaker: result.speaker,
          confidence: result.confidence,
          isFinal: true,
        };

        // Send through defensive reconciliation
        const reconciled = transcriptReconciler.pushFinalSegment(seg);
        if (reconciled) {
          transcriptEventBus.emitFinal(reconciled);
          this.finalCallbacks.forEach((cb) => cb(reconciled));
        }

        transcriptEventBus.emitSTTStatus({
          source: utterance.source,
          status: 'completed',
          errorCode: null,
          message: null,
        });
      }
    } catch (err: any) {
      console.warn('[LocalSTTService] System STT utterance transcription failed:', err);
      const code = err?.code || 'SYSTEM_STT_UNAVAILABLE';
      transcriptEventBus.emitSTTStatus({
        source: utterance.source,
        status: 'unavailable',
        errorCode: code,
        message: err?.message || 'System STT engine is unavailable for this utterance.',
      });
    } finally {
      this.isTranscribingSystem = false;
      if (this.systemTranscriptionQueue.length > 0) {
        this.processNextSystemUtterance();
      }
    }
  }

  /**
   * Browser Speech Recognition for instant zero-latency mic transcription
   * Strictly integrated with TranscriptReconciler to prevent incremental duplication.
   */
  private initBrowserMicAssistant() {
    if (typeof window === 'undefined') return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      this.isBrowserRecognitionActive = false;
      return;
    }

    try {
      this.browserRecognition = new SpeechRec();
      this.browserRecognition.continuous = true;
      this.browserRecognition.interimResults = true;
      this.browserRecognition.lang = this.config.language;
      this.browserRecognition.maxAlternatives = 1;

      this.recognitionStartTime = Date.now();

      this.browserRecognition.onresult = (event: any) => {
        const elapsed = (Date.now() - this.recognitionStartTime) / 1000;

        // Use TranscriptReconciler to handle resultIndex and separate interim from final
        const { interim, newlyCommitted } = transcriptReconciler.handleWebSpeechResult(
          event,
          'microphone',
          'Me',
          elapsed
        );

        // Emit interim for live preview if present
        if (interim) {
          transcriptEventBus.emitPartial(interim);
          this.partialCallbacks.forEach((cb) => cb(interim));
        }

        // Emit committed final segments
        newlyCommitted.forEach((finalSeg) => {
          transcriptEventBus.emitFinal(finalSeg);
          this.finalCallbacks.forEach((cb) => cb(finalSeg));
        });
      };

      this.browserRecognition.onend = () => {
        if (this.isRunning && this.browserRecognition) {
          try {
            this.browserRecognition.start();
          } catch (e) {}
        }
      };

      this.browserRecognition.onerror = (e: any) => {
        console.warn('[LocalSTTService] Browser mic recognition notice:', e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          transcriptEventBus.emitSTTStatus({
            source: 'microphone',
            status: 'unavailable',
            errorCode: 'MIC_STT_UNAVAILABLE',
            message: 'Microphone speech recognition permission denied by browser.',
          });
        }
      };

      this.browserRecognition.start();
      this.isBrowserRecognitionActive = true;
    } catch (err: any) {
      console.warn('[LocalSTTService] Browser Speech Recognition unavailable:', err);
      this.isBrowserRecognitionActive = false;
    }
  }

  /**
   * Helper to inject transcript segments (e.g. for tests, local worker, or simulation)
   */
  public injectTranscript(
    source: 'microphone' | 'system',
    text: string,
    startTime: number,
    endTime: number,
    isFinal = true
  ): void {
    const seg: TranscriptSegment = {
      id: `inject-${Date.now()}`,
      startTime,
      endTime,
      timestamp: Math.round(startTime),
      text,
      source,
      speaker: source === 'microphone' ? 'Me' : 'Meeting',
      confidence: 0.95,
      isFinal,
    };

    if (isFinal) {
      const reconciled = transcriptReconciler.pushFinalSegment(seg);
      if (reconciled) {
        transcriptEventBus.emitFinal(reconciled);
        this.finalCallbacks.forEach((cb) => cb(reconciled));
      }
    } else {
      const interim = transcriptReconciler.pushInterimSegment(seg);
      transcriptEventBus.emitPartial(interim);
      this.partialCallbacks.forEach((cb) => cb(interim));
    }
  }
}

export const localSTTService = new LocalSTTService();
