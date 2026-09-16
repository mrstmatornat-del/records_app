import { describe, it, expect, beforeEach } from 'vitest';
import { LocalSTTService } from '../src/services/LocalSTTService';
import { ISTTEngine, STTEngineConfig, STTTranscribeOptions, STTTranscriptionResult } from '../src/services/stt/ISTTEngine';
import { transcriptEventBus } from '../src/services/TranscriptEventBus';
import { transcriptReconciler } from '../src/services/TranscriptReconciler';

// Mock STT Engine simulating a working local Whisper / faster-whisper inference
class MockWorkingSTTEngine implements ISTTEngine {
  public readonly id = 'mock-working-engine';
  public readonly name = 'Mock Working Whisper Engine';
  public status: any = 'ready';
  public transcribeCalls: STTTranscribeOptions[] = [];

  public getStatus() {
    return this.status;
  }
  public getErrorCode() {
    return null;
  }
  public getErrorMessage() {
    return null;
  }
  public async initialize(_config: STTEngineConfig) {
    this.status = 'ready';
  }
  public async transcribe(
    _pcm16: Int16Array,
    _sampleRate: number,
    options: STTTranscribeOptions
  ): Promise<STTTranscriptionResult> {
    this.transcribeCalls.push(options);
    this.status = 'completed';
    return {
      text: options.source === 'system'
        ? 'We are discussing the new reconciliation lakehouse in this Teams call.'
        : 'Yes, I agree with this proposal.',
      confidence: 0.95,
      startTime: options.startTime,
      endTime: options.endTime,
      source: options.source,
      speaker: options.speaker,
      isFinal: true,
    };
  }
  public async dispose() {
    this.status = 'uninitialized';
  }
}

// Mock STT Engine simulating unavailable local engine
class MockUnavailableSTTEngine implements ISTTEngine {
  public readonly id = 'mock-unavailable-engine';
  public readonly name = 'Mock Unavailable Engine';
  public status: any = 'unavailable';

  public getStatus() {
    return this.status;
  }
  public getErrorCode() {
    return 'SYSTEM_STT_UNAVAILABLE';
  }
  public getErrorMessage() {
    return 'Local Whisper model not found or server offline.';
  }
  public async initialize(_config: STTEngineConfig) {
    this.status = 'unavailable';
    const err = new Error('Local Whisper model not found or server offline.');
    (err as any).code = 'SYSTEM_STT_UNAVAILABLE';
    throw err;
  }
  public async transcribe(
    _pcm16: Int16Array,
    _sampleRate: number,
    _options: STTTranscribeOptions
  ): Promise<STTTranscriptionResult> {
    const err = new Error('Local Whisper engine is unavailable.');
    (err as any).code = 'SYSTEM_STT_UNAVAILABLE';
    throw err;
  }
  public async dispose() {
    this.status = 'uninitialized';
  }
}

describe('System Audio STT Pipeline', () => {
  beforeEach(() => {
    transcriptEventBus.clear();
    transcriptReconciler.clear();
  });

  it('transcribes system audio PCM utterances into attributed Meeting transcript segments', async () => {
    const mockEngine = new MockWorkingSTTEngine();
    const sttService = new LocalSTTService({ language: 'en-US' }, mockEngine);

    await sttService.start();

    // Feed speech PCM frames into system VAD
    // Loud speech frame (640 samples @ 16kHz)
    const speechFrame = new Int16Array(640).fill(6000);
    const silenceFrame = new Int16Array(640).fill(0);

    // Utterance: speech frames followed by silence hangover
    for (let i = 0; i < 6; i++) {
      sttService.pushAudioFrame('system', speechFrame, 1.0 + i * 0.04);
    }
    // Silence hangover
    for (let i = 0; i < 15; i++) {
      sttService.pushAudioFrame('system', silenceFrame, 1.24 + i * 0.04);
    }

    // Wait briefly for async system queue to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockEngine.transcribeCalls.length).toBeGreaterThan(0);
    const lastCall = mockEngine.transcribeCalls[0];
    expect(lastCall.source).toBe('system');
    expect(lastCall.speaker).toBe('Meeting');

    const canonical = transcriptEventBus.getSegments();
    expect(canonical.length).toBeGreaterThan(0);
    expect(canonical[0].source).toBe('system');
    expect(canonical[0].speaker).toBe('Meeting');
    expect(canonical[0].text).toContain('reconciliation lakehouse');

    sttService.stop();
  });

  it('explicitly emits SYSTEM_STT_UNAVAILABLE instead of silently swallowing errors when engine is offline', async () => {
    const unavailableEngine = new MockUnavailableSTTEngine();
    let emittedStatus: any = null;

    const unsub = transcriptEventBus.onSTTStatus((status) => {
      emittedStatus = status;
    });

    const sttService = new LocalSTTService({ language: 'en-US' }, unavailableEngine);
    await sttService.start();

    expect(emittedStatus).not.toBeNull();
    expect(emittedStatus.status).toBe('unavailable');
    expect(emittedStatus.errorCode).toBe('SYSTEM_STT_UNAVAILABLE');

    unsub();
    sttService.stop();
  });

  it('maintains independent streams for Microphone [Me] and System [Meeting] without mingling', async () => {
    const mockEngine = new MockWorkingSTTEngine();
    const sttService = new LocalSTTService({ language: 'en-US' }, mockEngine);
    await sttService.start();

    // Inject Me speech
    sttService.injectTranscript('microphone', 'I will prepare the presentation.', 5.0, 7.0, true);
    // Inject Meeting speech
    sttService.injectTranscript('system', 'We should finalize the scope today.', 8.0, 11.0, true);

    const segments = transcriptEventBus.getSegments();
    expect(segments.length).toBe(2);

    expect(segments[0].speaker).toBe('Me');
    expect(segments[0].source).toBe('microphone');
    expect(segments[0].text).toBe('I will prepare the presentation.');

    expect(segments[1].speaker).toBe('Meeting');
    expect(segments[1].source).toBe('system');
    expect(segments[1].text).toBe('We should finalize the scope today.');

    sttService.stop();
  });
});
