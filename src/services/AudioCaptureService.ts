import { AudioSourceType, RecordingState, AudioLevels } from '../types';
import { downsampleTo16kHz, float32ToInt16, calculateVolumeRMS, encodeWAV, mixAudioBuffers } from '../utils/audioUtils';

export interface AudioCaptureOptions {
  source: AudioSourceType; // 'mic' | 'system' | 'dual' | 'tab' | 'combined'
  micDeviceId?: string;
  systemDeviceId?: string;
  enableNoiseSuppression?: boolean;
  enableEchoCancellation?: boolean;
}

export interface RecordingResult {
  audioBlob?: Blob;
  audioUrl?: string;
  systemBlob?: Blob;
  micBlob?: Blob;
  durationSeconds: number;
}

export type AudioFrameCallback = (
  source: 'microphone' | 'system',
  pcm16k: Int16Array,
  rawFloat32: Float32Array
) => void;

export type LevelsCallback = (levels: AudioLevels) => void;
export type StateCallback = (state: RecordingState) => void;
export type ErrorCallback = (error: string) => void;

/**
 * AudioCaptureService
 * 
 * Windows-first audio capture service providing:
 * - Independent Microphone and System Audio loopback capture streams.
 * - ZERO ECHO: Passive audio tapping that NEVER connects captured streams to audioContext.destination.
 * - Dual pipeline:
 *     Pipeline A: High-quality lossless recording for playback session.
 *     Pipeline B: 16kHz mono 16-bit PCM streaming for local VAD & STT.
 * - Resilient fallback: If mic fails, system audio still records; if system audio fails, mic still records.
 */
export class AudioCaptureService {
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;

  private micAudioContext: AudioContext | null = null;
  private systemAudioContext: AudioContext | null = null;

  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private systemSourceNode: MediaStreamAudioSourceNode | null = null;

  private micAnalyser: AnalyserNode | null = null;
  private systemAnalyser: AnalyserNode | null = null;

  private micProcessor: ScriptProcessorNode | null = null;
  private systemProcessor: ScriptProcessorNode | null = null;

  // Recording pipeline buffers (Pipeline A)
  private micRecordedSamples: Float32Array[] = [];
  private systemRecordedSamples: Float32Array[] = [];

  private state: RecordingState = 'idle';
  private startTime = 0;
  private pauseTime = 0;
  private totalPausedDuration = 0;

  // Callbacks
  private frameCallbacks: Set<AudioFrameCallback> = new Set();
  private levelCallbacks: Set<LevelsCallback> = new Set();
  private stateCallbacks: Set<StateCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();

  private levelInterval: ReturnType<typeof setInterval> | null = null;
  private currentLevels: AudioLevels = { micLevel: 0, systemLevel: 0 };

  constructor() {}

  public getRecordingState(): RecordingState {
    return this.state;
  }

  public getMicrophoneStream(): MediaStream | null {
    return this.micStream;
  }

  public getSystemAudioStream(): MediaStream | null {
    return this.systemStream;
  }

  public onAudioFrame(cb: AudioFrameCallback): () => void {
    this.frameCallbacks.add(cb);
    return () => this.frameCallbacks.delete(cb);
  }

  public onLevelsChange(cb: LevelsCallback): () => void {
    this.levelCallbacks.add(cb);
    return () => this.levelCallbacks.delete(cb);
  }

  public onStateChange(cb: StateCallback): () => void {
    this.stateCallbacks.add(cb);
    return () => this.stateCallbacks.delete(cb);
  }

  public onError(cb: ErrorCallback): () => void {
    this.errorCallbacks.add(cb);
    return () => this.errorCallbacks.delete(cb);
  }

  private setState(newState: RecordingState) {
    this.state = newState;
    this.stateCallbacks.forEach((cb) => cb(newState));
  }

  private notifyError(err: string) {
    console.error(`[AudioCaptureService] ${err}`);
    this.errorCallbacks.forEach((cb) => cb(err));
  }

  /**
   * Start independent audio capturing for mic and system/meeting audio.
   */
  public async start(options: AudioCaptureOptions): Promise<void> {
    if (this.state === 'recording') {
      return;
    }

    this.micRecordedSamples = [];
    this.systemRecordedSamples = [];
    this.startTime = Date.now();
    this.totalPausedDuration = 0;
    this.pauseTime = 0;
    this.currentLevels = { micLevel: 0, systemLevel: 0 };

    const shouldCaptureMic = options.source === 'mic' || options.source === 'dual' || options.source === 'combined';
    const shouldCaptureSystem = options.source === 'system' || options.source === 'dual' || options.source === 'tab' || options.source === 'combined';

    let micAcquired = false;
    let systemAcquired = false;

    // 1. Acquire Microphone Stream (Me)
    if (shouldCaptureMic) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: options.micDeviceId ? { exact: options.micDeviceId } : undefined,
            echoCancellation: options.enableEchoCancellation !== false,
            noiseSuppression: options.enableNoiseSuppression !== false,
            autoGainControl: true,
          },
          video: false,
        });
        this.setupMicPipeline(this.micStream);
        micAcquired = true;
      } catch (err: any) {
        console.warn("[AudioCaptureService] Microphone acquisition failed:", err);
        this.notifyError(`Microphone unavailable: ${err.message || 'Permission denied'}. Continuing with system audio if requested.`);
      }
    }

    // 2. Acquire System Audio Stream (Teams, Zoom, Meet, Windows Loopback)
    if (shouldCaptureSystem) {
      try {
        // In browser fallback mode, getDisplayMedia captures system/window audio.
        // In native Windows desktop shell, this will be delegated to WASAPI loopback capture.
        this.systemStream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // required by browser getDisplayMedia to obtain screen/audio picker
          audio: {
            echoCancellation: false, // Don't filter meeting audio
            noiseSuppression: false,
            autoGainControl: false,
          },
        });

        const audioTracks = this.systemStream.getAudioTracks();
        if (audioTracks.length === 0) {
          // User did not check "Share audio"
          this.systemStream.getTracks().forEach((t) => t.stop());
          this.systemStream = null;
          throw new Error("No system audio track selected. Please check 'Share audio' in the selector.");
        }

        // We can disable or stop the video track so CPU is not wasted on video rendering
        this.systemStream.getVideoTracks().forEach((vTrack) => {
          vTrack.enabled = false;
        });

        this.setupSystemPipeline(this.systemStream);
        systemAcquired = true;
      } catch (err: any) {
        console.warn("[AudioCaptureService] System audio acquisition failed:", err);
        this.notifyError(`System audio unavailable: ${err.message || 'Share audio cancelled'}. Continuing with microphone if active.`);
      }
    }

    // Check if at least one audio source was successfully acquired
    if (!micAcquired && !systemAcquired) {
      this.setState('idle');
      throw new Error("Could not acquire any audio source (neither microphone nor system audio).");
    }

    // Start VU meter level interval
    this.startLevelMonitoring();
    this.setState('recording');
  }

  /**
   * Setup Microphone Pipeline (Pipeline A: Record, Pipeline B: 16kHz PCM for STT)
   */
  private setupMicPipeline(stream: MediaStream) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.micAudioContext = new AudioCtx();

    this.micSourceNode = this.micAudioContext.createMediaStreamSource(stream);
    this.micAnalyser = this.micAudioContext.createAnalyser();
    this.micAnalyser.fftSize = 64;
    this.micSourceNode.connect(this.micAnalyser);

    // Buffer size 2048 gives ~43ms frames at 48kHz
    this.micProcessor = this.micAudioContext.createScriptProcessor(2048, 1, 1);

    this.micProcessor.onaudioprocess = (e) => {
      if (this.state !== 'recording') return;

      const inputData = e.inputBuffer.getChannelData(0);
      // Clone raw sample for Pipeline A (playback recording)
      const rawCopy = new Float32Array(inputData);
      this.micRecordedSamples.push(rawCopy);

      // Pipeline B: Downsample to 16kHz mono 16-bit PCM for STT
      const resampled = downsampleTo16kHz(rawCopy, this.micAudioContext?.sampleRate || 48000, 16000);
      const pcm16 = float32ToInt16(resampled);

      // Notify STT pipeline listeners
      this.frameCallbacks.forEach((cb) => {
        try {
          cb('microphone', pcm16, rawCopy);
        } catch (err) {
          console.error("Audio frame listener error:", err);
        }
      });
    };

    // CRITICAL: Connect to a dummy gain node with gain 0, NOT destination!
    // Connecting to destination causes feedback loop!
    const dummyMute = this.micAudioContext.createGain();
    dummyMute.gain.value = 0;
    this.micSourceNode.connect(this.micProcessor);
    this.micProcessor.connect(dummyMute);
    dummyMute.connect(this.micAudioContext.destination);
  }

  /**
   * Setup System Audio Pipeline (Teams, Zoom, Meet loopback)
   * PASSIVE TAP ONLY - NEVER CONNECT TO AUDIO OUTPUT / SPEAKERS!
   */
  private setupSystemPipeline(stream: MediaStream) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.systemAudioContext = new AudioCtx();

    this.systemSourceNode = this.systemAudioContext.createMediaStreamSource(stream);
    this.systemAnalyser = this.systemAudioContext.createAnalyser();
    this.systemAnalyser.fftSize = 64;
    this.systemSourceNode.connect(this.systemAnalyser);

    this.systemProcessor = this.systemAudioContext.createScriptProcessor(2048, 1, 1);

    this.systemProcessor.onaudioprocess = (e) => {
      if (this.state !== 'recording') return;

      const inputData = e.inputBuffer.getChannelData(0);
      const rawCopy = new Float32Array(inputData);
      this.systemRecordedSamples.push(rawCopy);

      // Downsample to 16kHz mono for STT
      const resampled = downsampleTo16kHz(rawCopy, this.systemAudioContext?.sampleRate || 48000, 16000);
      const pcm16 = float32ToInt16(resampled);

      this.frameCallbacks.forEach((cb) => {
        try {
          cb('system', pcm16, rawCopy);
        } catch (err) {
          console.error("System audio frame listener error:", err);
        }
      });
    };

    // PASSIVE TAP ONLY: Zero gain sink to keep ScriptProcessor running without speaker output
    const dummyMute = this.systemAudioContext.createGain();
    dummyMute.gain.value = 0;
    this.systemSourceNode.connect(this.systemProcessor);
    this.systemProcessor.connect(dummyMute);
    dummyMute.connect(this.systemAudioContext.destination);
  }

  private startLevelMonitoring() {
    if (this.levelInterval) clearInterval(this.levelInterval);

    const micBuffer = new Float32Array(64);
    const sysBuffer = new Float32Array(64);

    this.levelInterval = setInterval(() => {
      if (this.state !== 'recording') {
        if (this.currentLevels.micLevel > 0 || this.currentLevels.systemLevel > 0) {
          this.currentLevels = { micLevel: 0, systemLevel: 0 };
          this.levelCallbacks.forEach((cb) => cb(this.currentLevels));
        }
        return;
      }

      let micLvl = 0;
      let sysLvl = 0;

      if (this.micAnalyser) {
        this.micAnalyser.getFloatTimeDomainData(micBuffer);
        micLvl = calculateVolumeRMS(micBuffer);
      }

      if (this.systemAnalyser) {
        this.systemAnalyser.getFloatTimeDomainData(sysBuffer);
        sysLvl = calculateVolumeRMS(sysBuffer);
      }

      this.currentLevels = { micLevel: micLvl, systemLevel: sysLvl };
      this.levelCallbacks.forEach((cb) => cb(this.currentLevels));
    }, 100);
  }

  public pause(): void {
    if (this.state === 'recording') {
      this.pauseTime = Date.now();
      this.setState('paused');
      if (this.micAudioContext?.state === 'running') this.micAudioContext.suspend();
      if (this.systemAudioContext?.state === 'running') this.systemAudioContext.suspend();
    }
  }

  public resume(): void {
    if (this.state === 'paused') {
      if (this.pauseTime > 0) {
        this.totalPausedDuration += Date.now() - this.pauseTime;
        this.pauseTime = 0;
      }
      this.setState('recording');
      if (this.micAudioContext?.state === 'suspended') this.micAudioContext.resume();
      if (this.systemAudioContext?.state === 'suspended') this.systemAudioContext.resume();
    }
  }

  public getFrequencyData(source: 'microphone' | 'system', outputArray: Uint8Array): void {
    const analyser = source === 'microphone' ? this.micAnalyser : this.systemAnalyser;
    if (analyser) {
      analyser.getByteFrequencyData(outputArray);
    } else {
      outputArray.fill(0);
    }
  }

  /**
   * Stop recording, clean up all hardware resources, and export recording result (Pipeline A).
   */
  public async stop(): Promise<RecordingResult> {
    const wasActive = this.state === 'recording' || this.state === 'paused';
    this.setState('stopped');

    if (this.levelInterval) {
      clearInterval(this.levelInterval);
      this.levelInterval = null;
    }

    const elapsedMs = wasActive ? Date.now() - this.startTime - this.totalPausedDuration : 0;
    const durationSeconds = Math.max(0, Math.round(elapsedMs / 1000));

    // Cleanup audio processors and streams
    if (this.micProcessor) {
      this.micProcessor.disconnect();
      this.micProcessor = null;
    }
    if (this.systemProcessor) {
      this.systemProcessor.disconnect();
      this.systemProcessor = null;
    }
    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }
    if (this.systemSourceNode) {
      this.systemSourceNode.disconnect();
      this.systemSourceNode = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.systemStream) {
      this.systemStream.getTracks().forEach((t) => t.stop());
      this.systemStream = null;
    }

    if (this.micAudioContext) {
      try {
        await this.micAudioContext.close();
      } catch (e) {
        console.warn("micAudioContext close err:", e);
      }
      this.micAudioContext = null;
    }
    if (this.systemAudioContext) {
      try {
        await this.systemAudioContext.close();
      } catch (e) {
        console.warn("systemAudioContext close err:", e);
      }
      this.systemAudioContext = null;
    }

    // Process Pipeline A: Compile high quality WAV files for playback
    let audioBlob: Blob | undefined;
    let audioUrl: string | undefined;
    let micBlob: Blob | undefined;
    let systemBlob: Blob | undefined;

    const micFlat = this.flattenSamples(this.micRecordedSamples);
    const systemFlat = this.flattenSamples(this.systemRecordedSamples);

    if (micFlat.length > 0) {
      micBlob = encodeWAV(micFlat, 44100, 1);
    }
    if (systemFlat.length > 0) {
      systemBlob = encodeWAV(systemFlat, 44100, 1);
    }

    // Mix both tracks offline for session playback player
    if (micFlat.length > 0 && systemFlat.length > 0) {
      const mixed = mixAudioBuffers(micFlat, 0.9, systemFlat, 0.9);
      audioBlob = encodeWAV(mixed, 44100, 1);
    } else if (systemFlat.length > 0) {
      audioBlob = systemBlob;
    } else if (micFlat.length > 0) {
      audioBlob = micBlob;
    }

    if (audioBlob) {
      audioUrl = URL.createObjectURL(audioBlob);
    }

    this.setState('idle');

    return {
      audioBlob,
      audioUrl,
      systemBlob,
      micBlob,
      durationSeconds,
    };
  }

  private flattenSamples(chunks: Float32Array[]): Float32Array {
    let totalLength = 0;
    for (const c of chunks) {
      totalLength += c.length;
    }
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  }
}
