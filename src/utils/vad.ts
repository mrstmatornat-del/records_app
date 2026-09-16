/**
 * Voice Activity Detection (VAD) for 16kHz 16-bit PCM Audio Frames
 * Slices continuous meeting audio streams into coherent speech utterances based on energy and silence hangover,
 * avoiding arbitrary 3-second cuts that slice words in half.
 */

export interface VADConfig {
  sampleRate: number; // 16000
  energyThreshold: number; // RMS threshold between speech and silence (default 0.015)
  silenceHangoverFrames: number; // frames of silence before ending utterance (~500ms)
  minSpeechFrames: number; // minimum frames to count as valid speech (~200ms)
}

export interface Utterance {
  source: 'microphone' | 'system';
  speaker: 'Me' | 'Meeting';
  startTime: number; // in seconds
  endTime: number; // in seconds
  pcm16: Int16Array;
}

export class VoiceActivityDetector {
  private config: VADConfig;
  private isSpeaking = false;
  private consecutiveSpeechFrames = 0;
  private consecutiveSilenceFrames = 0;
  private currentUtteranceChunks: Int16Array[] = [];
  private utteranceStartTime = 0;

  constructor(config?: Partial<VADConfig>) {
    this.config = {
      sampleRate: 16000,
      energyThreshold: 0.015,
      silenceHangoverFrames: 12, // ~500ms at ~40ms/frame
      minSpeechFrames: 4, // ~160ms
      ...config,
    };
  }

  /**
   * Process a 16kHz 16-bit PCM frame
   * Returns a completed Utterance if silence hangover was reached, otherwise null.
   */
  public processFrame(
    pcm16: Int16Array,
    timestampSeconds: number,
    source: 'microphone' | 'system'
  ): { utterance: Utterance | null; isSpeech: boolean } {
    const rms = this.computeRMS(pcm16);
    const isSpeechFrame = rms >= this.config.energyThreshold;

    let completedUtterance: Utterance | null = null;

    if (isSpeechFrame) {
      this.consecutiveSilenceFrames = 0;
      this.consecutiveSpeechFrames++;

      if (!this.isSpeaking && this.consecutiveSpeechFrames >= this.config.minSpeechFrames) {
        this.isSpeaking = true;
        this.utteranceStartTime = Math.max(0, timestampSeconds - 0.2); // slight lookback
      }

      if (this.isSpeaking) {
        this.currentUtteranceChunks.push(pcm16);
      }
    } else {
      this.consecutiveSpeechFrames = 0;
      if (this.isSpeaking) {
        this.consecutiveSilenceFrames++;
        this.currentUtteranceChunks.push(pcm16);

        // Check if silence hangover threshold exceeded
        if (this.consecutiveSilenceFrames >= this.config.silenceHangoverFrames) {
          this.isSpeaking = false;
          const endTime = timestampSeconds;
          const concatenated = this.concatenateChunks(this.currentUtteranceChunks);
          this.currentUtteranceChunks = [];
          this.consecutiveSilenceFrames = 0;

          completedUtterance = {
            source,
            speaker: source === 'microphone' ? 'Me' : 'Meeting',
            startTime: this.utteranceStartTime,
            endTime,
            pcm16: concatenated,
          };
        }
      }
    }

    return { utterance: completedUtterance, isSpeech: this.isSpeaking };
  }

  public flush(timestampSeconds: number, source: 'microphone' | 'system'): Utterance | null {
    if (this.currentUtteranceChunks.length > 0) {
      const concatenated = this.concatenateChunks(this.currentUtteranceChunks);
      const utterance: Utterance = {
        source,
        speaker: source === 'microphone' ? 'Me' : 'Meeting',
        startTime: this.utteranceStartTime,
        endTime: timestampSeconds,
        pcm16: concatenated,
      };
      this.currentUtteranceChunks = [];
      this.isSpeaking = false;
      return utterance;
    }
    return null;
  }

  private computeRMS(pcm16: Int16Array): number {
    if (pcm16.length === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < pcm16.length; i++) {
      const norm = pcm16[i] / 32768.0;
      sumSquares += norm * norm;
    }
    return Math.sqrt(sumSquares / pcm16.length);
  }

  private concatenateChunks(chunks: Int16Array[]): Int16Array {
    let totalLen = 0;
    for (const c of chunks) totalLen += c.length;
    const result = new Int16Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  }
}
