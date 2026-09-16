import { describe, it, expect, beforeEach } from 'vitest';
import { TranscriptReconciler } from '../src/services/TranscriptReconciler';
import { TranscriptSegment } from '../src/types';

describe('TranscriptReconciler - Required Tests', () => {
  let reconciler: TranscriptReconciler;

  beforeEach(() => {
    reconciler = new TranscriptReconciler();
  });

  // TEST 1: Incremental interim stream followed by final
  it('TEST 1: correctly reconciles interim stream into a single final segment', () => {
    reconciler.pushInterimSegment({
      id: 'int-1',
      startTime: 1.0,
      endTime: 1.5,
      timestamp: 1,
      text: 'I have a',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.8,
      isFinal: false,
    });

    reconciler.pushInterimSegment({
      id: 'int-2',
      startTime: 1.0,
      endTime: 2.0,
      timestamp: 1,
      text: 'I have a cat',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.85,
      isFinal: false,
    });

    reconciler.pushInterimSegment({
      id: 'int-3',
      startTime: 1.0,
      endTime: 2.5,
      timestamp: 1,
      text: 'I have a cat, something',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.9,
      isFinal: false,
    });

    // Final result commits
    reconciler.pushFinalSegment({
      id: 'fin-1',
      startTime: 1.0,
      endTime: 3.5,
      timestamp: 1,
      text: 'I have a cat, something very huge',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.95,
      isFinal: true,
    });

    const canonical = reconciler.getCanonicalSegments();
    expect(canonical.length).toBe(1);
    expect(canonical[0].text).toBe('I have a cat, something very huge');
  });

  // TEST 2: Exact duplicate inputs
  it('TEST 2: collapses exact duplicate inputs into one segment', () => {
    reconciler.pushFinalSegment({
      id: 'fin-1',
      startTime: 2.0,
      endTime: 4.0,
      timestamp: 2,
      text: 'I have a cat',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.95,
      isFinal: true,
    });

    reconciler.pushFinalSegment({
      id: 'fin-2',
      startTime: 2.2,
      endTime: 4.2,
      timestamp: 2,
      text: 'I have a cat',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.95,
      isFinal: true,
    });

    const canonical = reconciler.getCanonicalSegments();
    expect(canonical.length).toBe(1);
    expect(canonical[0].text).toBe('I have a cat');
  });

  // TEST 3: Genuine human repetition within sentence
  it('TEST 3: preserves legitimate human repetition like "really really"', () => {
    reconciler.pushFinalSegment({
      id: 'fin-1',
      startTime: 3.0,
      endTime: 6.0,
      timestamp: 3,
      text: 'I really really like this idea.',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.95,
      isFinal: true,
    });

    const canonical = reconciler.getCanonicalSegments();
    expect(canonical.length).toBe(1);
    expect(canonical[0].text).toBe('I really really like this idea.');
  });

  // TEST 4: Repeated words like "No, no, no"
  it('TEST 4: preserves legitimate repetition like "No, no, no, that\'s not what I meant."', () => {
    reconciler.pushFinalSegment({
      id: 'fin-1',
      startTime: 4.0,
      endTime: 7.0,
      timestamp: 4,
      text: "No, no, no, that's not what I meant.",
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.95,
      isFinal: true,
    });

    const canonical = reconciler.getCanonicalSegments();
    expect(canonical.length).toBe(1);
    expect(canonical[0].text).toBe("No, no, no, that's not what I meant.");
  });

  // TEST 5: Suffix/overlap duplication across chunks
  it('TEST 5: merges suffix/prefix overlap between "I have a cat, something" and "something very huge"', () => {
    reconciler.pushFinalSegment({
      id: 'chunk-1',
      startTime: 5.0,
      endTime: 7.0,
      timestamp: 5,
      text: 'I have a cat, something',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.9,
      isFinal: true,
    });

    reconciler.pushFinalSegment({
      id: 'chunk-2',
      startTime: 6.8,
      endTime: 9.0,
      timestamp: 7,
      text: 'something very huge',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.92,
      isFinal: true,
    });

    const canonical = reconciler.getCanonicalSegments();
    expect(canonical.length).toBe(1);
    expect(canonical[0].text).toBe('I have a cat, something very huge');
  });

  // TEST 6: Different speakers are not deduplicated
  it('TEST 6: does NOT deduplicate identical text spoken by different speakers', () => {
    reconciler.pushFinalSegment({
      id: 'me-1',
      startTime: 10.0,
      endTime: 12.0,
      timestamp: 10,
      text: 'I have a cat',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.95,
      isFinal: true,
    });

    reconciler.pushFinalSegment({
      id: 'meeting-1',
      startTime: 13.0,
      endTime: 15.0,
      timestamp: 13,
      text: 'I have a cat',
      source: 'system',
      speaker: 'Meeting',
      confidence: 0.95,
      isFinal: true,
    });

    const canonical = reconciler.getCanonicalSegments();
    expect(canonical.length).toBe(2);
    expect(canonical[0].speaker).toBe('Me');
    expect(canonical[1].speaker).toBe('Meeting');
  });

  // TEST 7: Different sources are not deduplicated
  it('TEST 7: does NOT automatically deduplicate across microphone and system sources', () => {
    reconciler.pushFinalSegment({
      id: 'mic-src',
      startTime: 10.0,
      endTime: 12.0,
      timestamp: 10,
      text: 'I have a cat',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.95,
      isFinal: true,
    });

    reconciler.pushFinalSegment({
      id: 'sys-src',
      startTime: 12.5,
      endTime: 14.5,
      timestamp: 12,
      text: 'I have a cat',
      source: 'system',
      speaker: 'Meeting',
      confidence: 0.95,
      isFinal: true,
    });

    const canonical = reconciler.getCanonicalSegments();
    expect(canonical.length).toBe(2);
  });

  // TEST 8: Interim result must never become permanent transcript
  it('TEST 8: interim results alone are NEVER returned in getCanonicalSegments()', () => {
    reconciler.pushInterimSegment({
      id: 'int-only',
      startTime: 1.0,
      endTime: 2.0,
      timestamp: 1,
      text: 'Temporary interim speech words',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.7,
      isFinal: false,
    });

    const canonical = reconciler.getCanonicalSegments();
    expect(canonical.length).toBe(0);

    const interims = reconciler.getActiveInterimSegments();
    expect(interims.length).toBe(1);
    expect(interims[0].text).toBe('Temporary interim speech words');
  });

  // TEST 9: Final result after interim appears exactly once
  it('TEST 9: final result after multiple interim updates appears exactly once', () => {
    for (let i = 0; i < 5; i++) {
      reconciler.pushInterimSegment({
        id: `int-${i}`,
        startTime: 1.0,
        endTime: 1.0 + i * 0.5,
        timestamp: 1,
        text: `Word number ${i}`,
        source: 'microphone',
        speaker: 'Me',
        confidence: 0.7,
        isFinal: false,
      });
    }

    reconciler.pushFinalSegment({
      id: 'final-exact-one',
      startTime: 1.0,
      endTime: 4.0,
      timestamp: 1,
      text: 'Final complete sentence',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.96,
      isFinal: true,
    });

    const canonical = reconciler.getCanonicalSegments();
    expect(canonical.length).toBe(1);
    expect(canonical[0].text).toBe('Final complete sentence');
    expect(reconciler.getActiveInterimSegments().length).toBe(0);
  });

  // TEST 10: Long meeting with multiple utterances preserves chronological order
  it('TEST 10: preserves strict chronological order across multiple utterances', () => {
    reconciler.pushFinalSegment({
      id: 'seg-3',
      startTime: 45.0,
      endTime: 50.0,
      timestamp: 45,
      text: 'Discussion on action items and deployment.',
      source: 'system',
      speaker: 'Meeting',
      confidence: 0.94,
      isFinal: true,
    });

    reconciler.pushFinalSegment({
      id: 'seg-1',
      startTime: 5.0,
      endTime: 10.0,
      timestamp: 5,
      text: 'Meeting kicked off by the host.',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.98,
      isFinal: true,
    });

    reconciler.pushFinalSegment({
      id: 'seg-2',
      startTime: 20.0,
      endTime: 25.0,
      timestamp: 20,
      text: 'Architecture proposal review.',
      source: 'system',
      speaker: 'Meeting',
      confidence: 0.93,
      isFinal: true,
    });

    const canonical = reconciler.getCanonicalSegments();
    expect(canonical.length).toBe(3);
    expect(canonical[0].text).toBe('Meeting kicked off by the host.');
    expect(canonical[1].text).toBe('Architecture proposal review.');
    expect(canonical[2].text).toBe('Discussion on action items and deployment.');

    // Verify monotonic timestamps
    for (let i = 1; i < canonical.length; i++) {
      expect(canonical[i].startTime).toBeGreaterThanOrEqual(canonical[i - 1].startTime);
    }
  });
});
