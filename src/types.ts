export type AudioSourceType = 'mic' | 'tab' | 'combined' | 'file' | 'demo';
export type STTLanguage = 'en-US' | 'vi-VN';

export interface TranscriptSegment {
  id: string;
  timestamp: number; // in seconds relative to start
  text: string;
  isFinal: boolean;
  speaker?: string;
}

export interface KeyTopic {
  topic: string;
  details: string[];
}

export interface SessionAnalysis {
  title: string;
  summary: string;
  keyTopics: KeyTopic[];
  actionItems: string[];
  keyTakeaways: string[];
  sentiment: string;
  wordCount?: number;
}

export interface AudioSession {
  id: string;
  title: string;
  createdAt: string;
  durationSeconds: number;
  transcript: TranscriptSegment[];
  analysis?: SessionAnalysis;
  audioSource: AudioSourceType;
  status: 'recording' | 'completed' | 'analyzing';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

// Web Speech API TypeScript Definitions
export interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

export interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => any) | null;
  onerror: ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}
