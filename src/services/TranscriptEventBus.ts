import { TranscriptSegment, AudioLevels, RecordingState } from '../types';
import { STTEngineStatusEvent } from './stt/ISTTEngine';
import { transcriptReconciler } from './TranscriptReconciler';

export type EventBusListener<T> = (data: T) => void;

export interface SourceActiveEvent {
  source: 'microphone' | 'system';
  speaker: 'Me' | 'Meeting' | string;
  isActive: boolean;
}

/**
 * TranscriptEventBus
 * Centralized pub/sub event bus decoupling audio capture & STT pipelines from UI.
 * Acts as the final defensive layer ensuring:
 * 1. Chronological order
 * 2. Deduplication across case, punctuation, prefix, and suffix overlap
 * 3. Separation of interim (preview) vs canonical (final) transcripts
 * 4. STT engine status monitoring (Audio captured vs STT Processing vs STT Completed vs SYSTEM_STT_UNAVAILABLE)
 */
export class TranscriptEventBus {
  private partialListeners: Set<EventBusListener<TranscriptSegment>> = new Set();
  private finalListeners: Set<EventBusListener<TranscriptSegment>> = new Set();
  private levelsListeners: Set<EventBusListener<AudioLevels>> = new Set();
  private stateListeners: Set<EventBusListener<RecordingState>> = new Set();
  private sourceActiveListeners: Set<EventBusListener<SourceActiveEvent>> = new Set();
  private sttStatusListeners: Set<EventBusListener<STTEngineStatusEvent>> = new Set();

  constructor() {}

  public onPartialSegment(cb: EventBusListener<TranscriptSegment>): () => void {
    this.partialListeners.add(cb);
    return () => this.partialListeners.delete(cb);
  }

  public onFinalSegment(cb: EventBusListener<TranscriptSegment>): () => void {
    this.finalListeners.add(cb);
    return () => this.finalListeners.delete(cb);
  }

  public onLevels(cb: EventBusListener<AudioLevels>): () => void {
    this.levelsListeners.add(cb);
    return () => this.levelsListeners.delete(cb);
  }

  public onState(cb: EventBusListener<RecordingState>): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  public onSourceActive(cb: EventBusListener<SourceActiveEvent>): () => void {
    this.sourceActiveListeners.add(cb);
    return () => this.sourceActiveListeners.delete(cb);
  }

  public onSTTStatus(cb: EventBusListener<STTEngineStatusEvent>): () => void {
    this.sttStatusListeners.add(cb);
    return () => this.sttStatusListeners.delete(cb);
  }

  public emitPartial(segment: TranscriptSegment): void {
    // Record in reconciler as interim preview
    transcriptReconciler.pushInterimSegment(segment);
    this.partialListeners.forEach((cb) => {
      try {
        cb(segment);
      } catch (e) {
        console.error("Error in partial transcript listener:", e);
      }
    });
  }

  public emitFinal(segment: TranscriptSegment): void {
    // Pass through defensive reconciliation
    const reconciled = transcriptReconciler.pushFinalSegment(segment);
    if (!reconciled) {
      // Ignored duplicate
      return;
    }

    this.finalListeners.forEach((cb) => {
      try {
        cb(reconciled);
      } catch (e) {
        console.error("Error in final transcript listener:", e);
      }
    });
  }

  public emitLevels(levels: AudioLevels): void {
    this.levelsListeners.forEach((cb) => {
      try {
        cb(levels);
      } catch (e) {
        console.error("Error in levels listener:", e);
      }
    });
  }

  public emitState(state: RecordingState): void {
    this.stateListeners.forEach((cb) => {
      try {
        cb(state);
      } catch (e) {
        console.error("Error in state listener:", e);
      }
    });
  }

  public emitSourceActive(event: SourceActiveEvent): void {
    this.sourceActiveListeners.forEach((cb) => {
      try {
        cb(event);
      } catch (e) {
        console.error("Error in source active listener:", e);
      }
    });
  }

  public emitSTTStatus(event: STTEngineStatusEvent): void {
    this.sttStatusListeners.forEach((cb) => {
      try {
        cb(event);
      } catch (e) {
        console.error("Error in STT status listener:", e);
      }
    });
  }

  /**
   * Returns canonical transcript segments with ZERO interim results and ZERO duplicates.
   */
  public getSegments(): TranscriptSegment[] {
    return transcriptReconciler.getCanonicalSegments();
  }

  /**
   * Returns canonical dialogue text for Summary, Word count, and AI Notes.
   */
  public getCanonicalText(): string {
    return transcriptReconciler.getCanonicalTranscriptText();
  }

  public clear(): void {
    transcriptReconciler.clear();
  }
}

export const transcriptEventBus = new TranscriptEventBus();
