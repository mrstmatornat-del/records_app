import { TranscriptSegment, AudioLevels, RecordingState } from '../types';

export type EventBusListener<T> = (data: T) => void;

export interface SourceActiveEvent {
  source: 'microphone' | 'system';
  speaker: 'Me' | 'Meeting' | string;
  isActive: boolean;
}

/**
 * TranscriptEventBus
 * Centralized pub/sub event bus decoupling audio capture & STT pipelines from UI.
 * Handles chronological ordering, deduplication, and speaker/source attribution.
 */
export class TranscriptEventBus {
  private partialListeners: Set<EventBusListener<TranscriptSegment>> = new Set();
  private finalListeners: Set<EventBusListener<TranscriptSegment>> = new Set();
  private levelsListeners: Set<EventBusListener<AudioLevels>> = new Set();
  private stateListeners: Set<EventBusListener<RecordingState>> = new Set();
  private sourceActiveListeners: Set<EventBusListener<SourceActiveEvent>> = new Set();

  private segments: TranscriptSegment[] = [];

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

  public emitPartial(segment: TranscriptSegment): void {
    this.partialListeners.forEach((cb) => {
      try {
        cb(segment);
      } catch (e) {
        console.error("Error in partial transcript listener:", e);
      }
    });
  }

  public emitFinal(segment: TranscriptSegment): void {
    // Deduplication check
    const isDuplicate = this.segments.some(
      (s) => s.id === segment.id || (Math.abs(s.startTime - segment.startTime) < 1.0 && s.text.trim().toLowerCase() === segment.text.trim().toLowerCase())
    );

    if (!isDuplicate) {
      this.segments.push(segment);
      // Sort chronologically by startTime
      this.segments.sort((a, b) => a.startTime - b.startTime);
    }

    this.finalListeners.forEach((cb) => {
      try {
        cb(segment);
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

  public getSegments(): TranscriptSegment[] {
    return [...this.segments];
  }

  public clear(): void {
    this.segments = [];
  }
}

export const transcriptEventBus = new TranscriptEventBus();
