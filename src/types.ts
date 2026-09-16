export type AudioSourceType = 'mic' | 'system' | 'dual' | 'tab' | 'combined' | 'file' | 'demo';
export type STTLanguage = 'en-US' | 'vi-VN';
export type AudioCaptureMode = 'native-wasapi' | 'browser-fallback' | 'mock';
export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface TranscriptSegment {
  id: string;
  startTime: number; // in seconds relative to start
  endTime: number; // in seconds relative to start
  timestamp: number; // backward compatibility: alias for startTime
  text: string;
  source: 'microphone' | 'system';
  speaker: 'Me' | 'Meeting' | string;
  confidence: number;
  isFinal: boolean;
}

export interface MeetingContext {
  title: string;
  objective: string;
  expectedOutcome: string;
  watchList: string[]; // key items to watch for (e.g. owners, deadlines, decisions, risks)
}

export interface DecisionItem {
  decision: string;
  context: string;
  timestamp: number; // in seconds
}

export interface ActionItem {
  task: string;
  owner: string; // "Not specified" if transcript does not state
  deadline: string; // "Not specified" if transcript does not state
  priority: 'high' | 'medium' | 'low';
  timestamp: number; // in seconds
  completed?: boolean;
}

export interface ImportantPoint {
  topic: string;
  detail: string;
  timestamp: number; // in seconds
}

export interface RiskItem {
  risk: string;
  impact: string;
  suggestedFollowUp: string;
  timestamp?: number;
}

export interface KeyTopic {
  topic: string;
  details: string[];
}

export interface SessionAnalysis {
  title: string;
  objective?: string;
  executiveSummary: string;
  decisions: DecisionItem[];
  actionItems: ActionItem[];
  importantPoints: ImportantPoint[];
  risks: RiskItem[];
  openQuestions: string[];
  followUps: string[];
  sentiment: string;
  wordCount?: number;
  // Backward compatibility fields:
  summary?: string;
  keyTopics?: KeyTopic[];
  keyTakeaways?: string[];
}

export interface AudioSession {
  id: string;
  title: string;
  context?: MeetingContext;
  createdAt: string;
  durationSeconds: number;
  transcript: TranscriptSegment[];
  analysis?: SessionAnalysis;
  audioSource: AudioSourceType;
  status: 'recording' | 'paused' | 'completed' | 'analyzing';
  audioBlobUrl?: string; // Recorded audio URL for synchronized playback
}

export interface AudioLevels {
  micLevel: number;     // 0-100%
  systemLevel: number;  // 0-100%
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
    __STREAMNOTE_ELECTRON__?: {
      isDesktop: boolean;
      platform: string;
      wasapiSupported: boolean;
    };
  }
}
