import { describe, it, expect } from 'vitest';
import { TranscriptEventBus } from '../src/services/TranscriptEventBus';
import { TranscriptSegment } from '../src/types';

describe('TranscriptEventBus', () => {
  it('correctly handles chronological ordering and deduplication of segments', () => {
    const bus = new TranscriptEventBus();

    const seg1: TranscriptSegment = {
      id: 'seg-1',
      startTime: 10.0,
      endTime: 14.0,
      timestamp: 10.0,
      text: 'First meeting statement',
      source: 'system',
      speaker: 'Meeting',
      confidence: 0.95,
      isFinal: true,
    };

    const seg2: TranscriptSegment = {
      id: 'seg-2',
      startTime: 2.0,
      endTime: 5.0,
      timestamp: 2.0,
      text: 'Introductions from me',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.98,
      isFinal: true,
    };

    bus.emitFinal(seg1);
    bus.emitFinal(seg2);

    const segments = bus.getSegments();
    expect(segments.length).toBe(2);
    // seg2 (startTime 2.0) should precede seg1 (startTime 10.0)
    expect(segments[0].id).toBe('seg-2');
    expect(segments[1].id).toBe('seg-1');

    // Test deduplication
    const segDuplicate: TranscriptSegment = {
      id: 'seg-3',
      startTime: 10.2, // close timestamp
      endTime: 14.0,
      timestamp: 10.2,
      text: 'First meeting statement', // identical text
      source: 'system',
      speaker: 'Meeting',
      confidence: 0.95,
      isFinal: true,
    };

    bus.emitFinal(segDuplicate);
    // Should NOT have added duplicate
    expect(bus.getSegments().length).toBe(2);
  });

  it('notifies subscribers of partial segments and levels correctly', () => {
    const bus = new TranscriptEventBus();
    let receivedPartial: TranscriptSegment | null = null;
    let receivedLevels: { micLevel: number; systemLevel: number } | null = null;

    const unsubPartial = bus.onPartialSegment((s) => {
      receivedPartial = s;
    });

    const unsubLevels = bus.onLevels((l) => {
      receivedLevels = l;
    });

    bus.emitPartial({
      id: 'part-1',
      startTime: 1.0,
      endTime: 2.0,
      timestamp: 1.0,
      text: 'Speaking in progress',
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.8,
      isFinal: false,
    });

    expect(receivedPartial).not.toBeNull();
    expect((receivedPartial as any).text).toBe('Speaking in progress');

    bus.emitLevels({ micLevel: 45, systemLevel: 62 });
    expect(receivedLevels).toEqual({ micLevel: 45, systemLevel: 62 });

    unsubPartial();
    unsubLevels();
  });
});
