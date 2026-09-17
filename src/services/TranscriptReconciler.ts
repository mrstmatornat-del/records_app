import { TranscriptSegment, ISpeechRecognitionEvent } from '../types';
import {
  normalizeTranscriptText,
  isSubstantiallyIdentical,
  mergeTranscriptTexts,
  isNormalizedPrefix,
} from '../utils/transcriptNormalization';

interface StreamReconcilerState {
  source: 'microphone' | 'system';
  speaker: string;
  committedSegments: TranscriptSegment[];
  activeInterimSegment: TranscriptSegment | null;
  lastCommitTime: number;
}

/**
 * TranscriptReconciler
 * 
 * Converts raw incremental STT output into a clean, canonical transcript:
 * 1. Distinguishes interim results (preview-only, never committed) from final results.
 * 2. Properly handles Web Speech API `event.resultIndex` and slot replacement.
 * 3. Eliminates incremental duplicates, prefix extensions, and overlap duplicates.
 * 4. Strictly preserves genuine human repetition ("really really", "No, no, no").
 * 5. Maintains independent, unmingled streams for Microphone ([Me]) and System ([Meeting]).
 * 6. Guarantees monotonic timestamps and clean canonical data for AI summary & notes.
 */
export class TranscriptReconciler {
  private streams: Map<string, StreamReconcilerState> = new Map();
  private segmentCounter = 0;

  constructor() {}

  private getStreamKey(source: 'microphone' | 'system', speaker: string): string {
    return `${source}:${speaker}`;
  }

  private getOrCreateStream(source: 'microphone' | 'system', speaker: string): StreamReconcilerState {
    const key = this.getStreamKey(source, speaker);
    let state = this.streams.get(key);
    if (!state) {
      state = {
        source,
        speaker,
        committedSegments: [],
        activeInterimSegment: null,
        lastCommitTime: 0,
      };
      this.streams.set(key, state);
    }
    return state;
  }

  /**
   * Pushes a final transcript segment through defensive deduplication.
   * Merges prefix/overlap continuations or appends new genuine speech.
   */
  public pushFinalSegment(segment: TranscriptSegment): TranscriptSegment | null {
    const text = segment.text.trim();
    if (!text) return null;

    const state = this.getOrCreateStream(segment.source, segment.speaker);

    // Clear any active interim state for this stream
    state.activeInterimSegment = null;

    const committed = state.committedSegments;
    const last = committed.length > 0 ? committed[committed.length - 1] : null;

    if (last) {
      // 1. Exact or substantially identical duplicate check
      if (isSubstantiallyIdentical(last.text, text)) {
        return null; // Ignore duplicate
      }

      // 2. Prefix duplication (last text is a prefix of incoming text)
      if (isNormalizedPrefix(last.text, text)) {
        last.text = text;
        last.endTime = Math.max(last.endTime, segment.endTime || segment.startTime + 2);
        last.isFinal = true;
        return last;
      }

      // 2b. Reverse prefix duplication: incoming text is a STALE/SHORTER subset of
      // what's already committed (e.g. a recognizer restart re-emits an earlier or
      // trailing fragment after the fuller text was already finalized). Absorb it
      // without creating a spurious duplicate segment.
      if (isNormalizedPrefix(text, last.text)) {
        last.endTime = Math.max(last.endTime, segment.endTime || segment.startTime + 2);
        return last;
      }

      // 3. Suffix / Overlap duplication ("I have a cat, something" + "something very huge")
      const merged = mergeTranscriptTexts(last.text, text);
      if (merged !== null) {
        if (merged === last.text) {
          // Incoming text contributed no new words (fully contained/overlapping
          // already-committed text) — absorb it instead of falling through to
          // "genuinely new segment", which would otherwise duplicate the line.
          last.endTime = Math.max(last.endTime, segment.endTime || segment.startTime + 2);
          return last;
        }
        last.text = merged;
        last.endTime = Math.max(last.endTime, segment.endTime || segment.startTime + 2);
        last.isFinal = true;
        return last;
      }
    }

    // 4. Genuinely new speech segment
    // Ensure monotonic timestamp progression on this stream when arriving forward in time
    let startTime = segment.startTime;
    if (last && segment.startTime >= last.startTime) {
      startTime = Math.max(segment.startTime, last.endTime);
    }
    const endTime = Math.max(startTime + 0.5, segment.endTime || startTime + 2);

    const finalizedSegment: TranscriptSegment = {
      id: segment.id || `reconciled-${Date.now()}-${++this.segmentCounter}`,
      startTime: Math.round(startTime * 10) / 10,
      endTime: Math.round(endTime * 10) / 10,
      timestamp: Math.round(startTime),
      text,
      source: segment.source,
      speaker: segment.speaker,
      confidence: segment.confidence || 0.95,
      isFinal: true,
    };

    committed.push(finalizedSegment);
    committed.sort((a, b) => a.startTime - b.startTime);
    state.lastCommitTime = committed[committed.length - 1].endTime;

    return finalizedSegment;
  }

  /**
   * Pushes an interim (live preview) segment.
   * Interim segments are NEVER committed permanently to the canonical transcript.
   */
  public pushInterimSegment(segment: TranscriptSegment): TranscriptSegment {
    const state = this.getOrCreateStream(segment.source, segment.speaker);
    const interimSeg: TranscriptSegment = {
      ...segment,
      isFinal: false,
    };
    state.activeInterimSegment = interimSeg;
    return interimSeg;
  }

  /**
   * Processes native Web Speech API recognition event correctly.
   * Tracks event.resultIndex and SpeechRecognitionResultList to replace interim results
   * rather than generating hundreds of duplicate permanent items.
   */
  public handleWebSpeechResult(
    event: ISpeechRecognitionEvent,
    source: 'microphone' | 'system',
    speaker: string,
    elapsedSeconds: number
  ): { interim: TranscriptSegment | null; newlyCommitted: TranscriptSegment[] } {
    const state = this.getOrCreateStream(source, speaker);
    const newlyCommitted: TranscriptSegment[] = [];
    let activeInterimText = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result = event.results[i];
      const transcriptText = result[0]?.transcript?.trim();
      if (!transcriptText) continue;

      if (result.isFinal) {
        // Commit this final result exactly once
        const startTime = Math.max(0, Math.round((elapsedSeconds - 2) * 10) / 10);
        const endTime = Math.round(elapsedSeconds * 10) / 10;
        const finalSeg = this.pushFinalSegment({
          id: `final-stt-${i}-${Math.round(startTime)}`,
          startTime,
          endTime,
          timestamp: Math.round(startTime),
          text: transcriptText,
          source,
          speaker,
          confidence: result[0].confidence || 0.95,
          isFinal: true,
        });
        if (finalSeg) {
          newlyCommitted.push(finalSeg);
        }
      } else {
        // Collect interim result for active preview
        activeInterimText += (activeInterimText ? ' ' : '') + transcriptText;
      }
    }

    let interimResult: TranscriptSegment | null = null;
    if (activeInterimText.trim().length > 0) {
      interimResult = {
        id: `interim-${source}-${speaker}`,
        startTime: Math.round(elapsedSeconds * 10) / 10,
        endTime: Math.round((elapsedSeconds + 1) * 10) / 10,
        timestamp: Math.round(elapsedSeconds),
        text: activeInterimText.trim(),
        source,
        speaker,
        confidence: 0.8,
        isFinal: false,
      };
      state.activeInterimSegment = interimResult;
    } else {
      state.activeInterimSegment = null;
    }

    return { interim: interimResult, newlyCommitted };
  }

  /**
   * Returns all canonical finalized segments from all streams,
   * sorted chronologically by startTime. Contains ZERO interim results.
   */
  public getCanonicalSegments(): TranscriptSegment[] {
    const allSegments: TranscriptSegment[] = [];
    this.streams.forEach((state) => {
      allSegments.push(...state.committedSegments);
    });
    // Sort strictly by startTime
    return allSegments.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Returns full canonical dialogue text for AI notes, summarizer, copy, and Q&A.
   */
  public getCanonicalTranscriptText(): string {
    const segments = this.getCanonicalSegments();
    return segments
      .map((s) => `[${s.speaker || (s.source === 'microphone' ? 'Me' : 'Meeting')}]: ${s.text}`)
      .join('\n');
  }

  /**
   * Returns currently active live interim segments (preview only).
   */
  public getActiveInterimSegments(): TranscriptSegment[] {
    const interims: TranscriptSegment[] = [];
    this.streams.forEach((state) => {
      if (state.activeInterimSegment) {
        interims.push(state.activeInterimSegment);
      }
    });
    return interims;
  }

  public clear(): void {
    this.streams.clear();
    this.segmentCounter = 0;
  }
}

export const transcriptReconciler = new TranscriptReconciler();
