export type STTSource = 'microphone' | 'system';
export type STTSpeaker = 'Me' | 'Meeting' | string;
export type STTModelSize = 'tiny' | 'base' | 'small';

export interface STTEngineConfig {
  language: string; // 'en' | 'vi' | 'en-US' | 'vi-VN'
  modelSize: STTModelSize;
  serverUrl?: string;
}

export interface STTTranscribeOptions {
  source: STTSource;
  speaker: STTSpeaker;
  startTime: number;
  endTime: number;
}

export interface STTTranscriptionResult {
  text: string;
  confidence: number;
  startTime: number;
  endTime: number;
  source: STTSource;
  speaker: STTSpeaker;
  isFinal: boolean;
}

export type STTEngineStatus =
  | 'uninitialized'
  | 'ready'
  | 'processing'
  | 'completed'
  | 'unavailable'
  | 'error';

export interface STTEngineStatusEvent {
  source: STTSource;
  status: STTEngineStatus;
  errorCode: string | null;
  message: string | null;
}

/**
 * ISTTEngine
 * Clean abstraction for local Speech-to-Text inference engines
 * (Whisper, faster-whisper, whisper.cpp, WebAssembly Whisper, or local service).
 */
export interface ISTTEngine {
  readonly id: string;
  readonly name: string;
  getStatus(): STTEngineStatus;
  getErrorCode(): string | null;
  getErrorMessage(): string | null;
  initialize(config: STTEngineConfig): Promise<void>;
  transcribe(
    pcm16: Int16Array,
    sampleRate: number,
    options: STTTranscribeOptions
  ): Promise<STTTranscriptionResult>;
  dispose(): Promise<void>;
}
