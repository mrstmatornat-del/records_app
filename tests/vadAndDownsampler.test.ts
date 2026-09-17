import { describe, it, expect } from 'vitest';
import { downsampleTo16kHz, float32ToInt16, calculateVolumeRMS, encodeWAV, mixAudioBuffers } from '../src/utils/audioUtils';
import { VoiceActivityDetector } from '../src/utils/vad';

describe('Audio Normalization & Downsampler', () => {
  it('downsamples 48kHz audio to 16kHz mono correctly', () => {
    // 48000 samples = 1 second at 48kHz
    const input48k = new Float32Array(48000);
    // Fill with 440Hz sine wave
    for (let i = 0; i < input48k.length; i++) {
      input48k[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }

    const downsampled = downsampleTo16kHz(input48k, 48000, 16000);
    expect(downsampled.length).toBe(16000);
    expect(downsampled[0]).toBeLessThan(0.1);
  });

  it('converts Float32Array to 16-bit signed PCM Int16Array within bounds', () => {
    const input = new Float32Array([-1.0, -0.5, 0.0, 0.5, 1.0, 1.5, -2.0]);
    const int16 = float32ToInt16(input);

    expect(int16.length).toBe(input.length);
    expect(int16[0]).toBe(-32768); // -1.0 * 0x8000
    expect(int16[2]).toBe(0);
    expect(int16[4]).toBe(32767); // 1.0 * 0x7fff
    expect(int16[5]).toBe(32767); // clamped at 1.0
    expect(int16[6]).toBe(-32768); // clamped at -1.0
  });

  it('calculates RMS volume percentage correctly for silence and active speech', () => {
    const silence = new Float32Array(1024).fill(0);
    const quietLvl = calculateVolumeRMS(silence);
    expect(quietLvl).toBe(0);

    const active = new Float32Array(1024).fill(0.4);
    const activeLvl = calculateVolumeRMS(active);
    expect(activeLvl).toBeGreaterThan(40);
  });

  it('encodes Float32Array PCM into standard 16-bit WAV header and data', async () => {
    const samples = new Float32Array(16000);
    const wavBlob = encodeWAV(samples, 16000, 1);

    expect(wavBlob.type).toBe('audio/wav');
    expect(wavBlob.size).toBe(44 + 16000 * 2); // 44 byte header + 16000 16-bit samples
  });

  it('performs non-destructive mixing of two audio buffers', () => {
    const bufA = new Float32Array([0.2, 0.4, -0.2]);
    const bufB = new Float32Array([0.1, -0.2, 0.3]);
    const mixed = mixAudioBuffers(bufA, 1.0, bufB, 1.0);

    expect(mixed.length).toBe(3);
    expect(mixed[0]).toBeCloseTo(0.3);
    expect(mixed[1]).toBeCloseTo(0.2);
    expect(mixed[2]).toBeCloseTo(0.1);
  });
});

describe('Voice Activity Detector (VAD)', () => {
  it('detects speech and triggers completed utterance after silence hangover', () => {
    const vad = new VoiceActivityDetector({
      sampleRate: 16000,
      energyThreshold: 0.02,
      silenceHangoverFrames: 3,
      minSpeechFrames: 2,
    });

    // Frame size 640 (~40ms at 16kHz)
    const speechFrame = new Int16Array(640).fill(8000); // loud speech
    const silenceFrame = new Int16Array(640).fill(0);

    // Frame 1: speech
    let res = vad.processFrame(speechFrame, 0.04, 'system');
    expect(res.isSpeech).toBe(false); // minSpeechFrames = 2, not reached yet

    // Frame 2: speech (reaches minSpeechFrames)
    res = vad.processFrame(speechFrame, 0.08, 'system');
    expect(res.isSpeech).toBe(true);
    expect(res.utterance).toBeNull();

    // Frame 3: speech
    res = vad.processFrame(speechFrame, 0.12, 'system');
    expect(res.isSpeech).toBe(true);

    // Frame 4: silence 1
    res = vad.processFrame(silenceFrame, 0.16, 'system');
    expect(res.utterance).toBeNull();

    // Frame 5: silence 2
    res = vad.processFrame(silenceFrame, 0.20, 'system');
    expect(res.utterance).toBeNull();

    // Frame 6: silence 3 (exceeds silenceHangoverFrames = 3)
    res = vad.processFrame(silenceFrame, 0.24, 'system');
    expect(res.utterance).not.toBeNull();
    expect(res.utterance?.source).toBe('system');
    expect(res.utterance?.speaker).toBe('Meeting');
    expect(res.utterance?.endTime).toBe(0.24);
  });

  it('force-flushes a still-speaking utterance once it hits the max-duration cap, then keeps listening', () => {
    const vad = new VoiceActivityDetector({
      sampleRate: 16000,
      energyThreshold: 0.02,
      silenceHangoverFrames: 12,
      minSpeechFrames: 2,
      maxUtteranceSeconds: 0.2, // tiny cap for a fast test
    });

    const speechFrame = new Int16Array(640).fill(8000);

    // Reach minSpeechFrames to start the utterance.
    vad.processFrame(speechFrame, 0.04, 'system');
    let res = vad.processFrame(speechFrame, 0.08, 'system');
    expect(res.isSpeech).toBe(true);
    expect(res.utterance).toBeNull();

    // Keep feeding continuous speech with NO silence gap at all.
    res = vad.processFrame(speechFrame, 0.12, 'system');
    expect(res.utterance).toBeNull();
    res = vad.processFrame(speechFrame, 0.16, 'system');
    expect(res.utterance).toBeNull();

    // This frame pushes elapsed time (since utterance start ~0.0) past the
    // 0.2s cap — must force-flush instead of waiting for silence forever.
    res = vad.processFrame(speechFrame, 0.24, 'system');
    expect(res.utterance).not.toBeNull();
    expect(res.utterance?.source).toBe('system');
    // Still speaking — the detector should immediately start a new utterance
    // rather than requiring another minSpeechFrames ramp-up.
    expect(res.isSpeech).toBe(true);

    // Continuing speech accumulates into the NEW utterance without being lost.
    res = vad.processFrame(speechFrame, 0.28, 'system');
    expect(res.utterance).toBeNull();
    expect(res.isSpeech).toBe(true);
  });
});
