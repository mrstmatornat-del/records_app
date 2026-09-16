/**
 * Audio Conversion and Processing Utilities for Windows Meeting Intelligence
 * Normalizes input PCM buffers from any sample rate (44.1kHz, 48kHz) to 16kHz mono 16-bit PCM for Whisper/STT.
 */

/**
 * Downsamples Float32Array PCM audio to 16000Hz mono.
 */
export function downsampleTo16kHz(
  inputBuffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate = 16000
): Float32Array {
  if (inputSampleRate === outputSampleRate) {
    return inputBuffer;
  }
  if (inputSampleRate < outputSampleRate) {
    // Upsampling is rare for audio capture; return as-is
    return inputBuffer;
  }

  const sampleRatio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(inputBuffer.length / sampleRatio);
  const result = new Float32Array(outputLength);

  let offsetResult = 0;
  let offsetInput = 0;

  while (offsetResult < result.length) {
    const nextOffsetInput = Math.round((offsetResult + 1) * sampleRatio);
    // Linear interpolation / averaging over sample window
    let accum = 0;
    let count = 0;
    for (let i = offsetInput; i < nextOffsetInput && i < inputBuffer.length; i++) {
      accum += inputBuffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetInput = nextOffsetInput;
  }

  return result;
}

/**
 * Converts Float32Array (-1.0 to +1.0) to Int16Array (-32768 to 32767).
 */
export function float32ToInt16(buffer: Float32Array): Int16Array {
  const int16 = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

/**
 * Calculates RMS (Root Mean Square) volume level (0 to 100%).
 */
export function calculateVolumeRMS(buffer: Float32Array): number {
  if (!buffer || buffer.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i++) {
    sumSquares += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSquares / buffer.length);
  // Scale non-linearly to 0-100 for natural UI VU-meter representation
  const db = 20 * Math.log10(Math.max(rms, 1e-4));
  // Map -50dB to 0dB -> 0 to 100
  const normalized = Math.max(0, Math.min(100, Math.round(((db + 50) / 50) * 100)));
  return normalized;
}

/**
 * Encodes Float32Array PCM audio into a standard 16-bit PCM WAV Blob.
 * Used to save high-quality session recordings without compression artifacts.
 */
export function encodeWAV(
  samples: Float32Array,
  sampleRate: number,
  numChannels = 1
): Blob {
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate
  view.setUint32(28, byteRate, true);
  // block align
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Mixes two Float32Array audio buffers with independent gain control.
 * Non-destructive offline mix for playback export.
 */
export function mixAudioBuffers(
  bufferA: Float32Array,
  gainA = 0.9,
  bufferB: Float32Array,
  gainB = 0.9
): Float32Array {
  const length = Math.max(bufferA.length, bufferB.length);
  const mixed = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const sampleA = i < bufferA.length ? bufferA[i] * gainA : 0;
    const sampleB = i < bufferB.length ? bufferB[i] * gainB : 0;
    let sum = sampleA + sampleB;
    // Soft clipping
    if (sum > 1.0) sum = 1.0;
    else if (sum < -1.0) sum = -1.0;
    mixed[i] = sum;
  }

  return mixed;
}
