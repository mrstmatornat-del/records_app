import { AudioSession } from '../types';

export const DEMO_SESSIONS: AudioSession[] = [
  {
    id: 'demo-1',
    title: 'Windows Meeting Intelligence & Core Architecture Sync',
    context: {
      title: 'Windows Meeting Intelligence & Core Architecture Sync',
      objective: 'Agree on zero-distortion Windows WASAPI loopback audio capture and local Whisper STT pipeline.',
      expectedOutcome: 'Finalized dual-stream audio architecture and timestamp-linked Notion AI notes.',
      watchList: ['unresolved technical issues', 'owners', 'deadlines', 'decisions', 'risks', 'data quality problems'],
    },
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    durationSeconds: 184,
    audioSource: 'dual',
    status: 'completed',
    transcript: [
      { id: '1', startTime: 0, endTime: 7, timestamp: 0, text: "Good morning everyone. Today we are finalizing the Windows meeting recorder architecture.", source: 'microphone', speaker: 'Me', confidence: 0.96, isFinal: true },
      { id: '2', startTime: 8, endTime: 17, timestamp: 8, text: "The primary requirement is that meeting playback quality must not be altered or distorted when the recorder starts.", source: 'system', speaker: 'Meeting', confidence: 0.94, isFinal: true },
      { id: '3', startTime: 18, endTime: 27, timestamp: 18, text: "We decided to passively tap the Windows output stream using WASAPI Loopback on the default render endpoint.", source: 'system', speaker: 'Meeting', confidence: 0.95, isFinal: true },
      { id: '4', startTime: 28, endTime: 39, timestamp: 28, text: "Never connect captured audio back to audioContext.destination because that creates terrible echo and feedback loops.", source: 'microphone', speaker: 'Me', confidence: 0.97, isFinal: true },
      { id: '5', startTime: 40, endTime: 53, timestamp: 40, text: "Alex will implement the local VAD and 16kHz PCM downsampler by next Friday.", source: 'system', speaker: 'Meeting', confidence: 0.93, isFinal: true },
      { id: '6', startTime: 54, endTime: 67, timestamp: 54, text: "Sarah is assigned to connect the Gemini post-meeting reasoning engine with structured timestamp links.", source: 'system', speaker: 'Meeting', confidence: 0.92, isFinal: true },
      { id: '7', startTime: 68, endTime: 84, timestamp: 68, text: "What is our fallback strategy if the user does not have an active microphone connected?", source: 'microphone', speaker: 'Me', confidence: 0.95, isFinal: true },
      { id: '8', startTime: 85, endTime: 101, timestamp: 85, text: "The system loopback recording will continue unimpeded. Graceful degradation is built into every layer.", source: 'system', speaker: 'Meeting', confidence: 0.94, isFinal: true },
      { id: '9', startTime: 102, endTime: 118, timestamp: 102, text: "Agreed. Let us proceed with this architecture and test both Teams and Zoom desktop integration.", source: 'microphone', speaker: 'Me', confidence: 0.98, isFinal: true },
    ],
    analysis: {
      title: 'Windows Meeting Intelligence & Core Architecture Sync',
      objective: 'Agree on zero-distortion Windows WASAPI loopback audio capture and local Whisper STT pipeline.',
      executiveSummary: 'The team agreed on an independent dual-stream Windows audio architecture. System audio from Teams and Zoom is passively captured via WASAPI loopback without feeding back into speakers, preventing echo and distortion. Realtime STT runs locally over 16kHz PCM frames, reserving Gemini for structured post-meeting reasoning with timestamp links.',
      summary: 'The team agreed on an independent dual-stream Windows audio architecture. System audio from Teams and Zoom is passively captured via WASAPI loopback without feeding back into speakers, preventing echo and distortion.',
      decisions: [
        {
          decision: 'Passively tap Windows audio output via WASAPI Loopback (AUDCLNT_STREAMFLAGS_LOOPBACK) without re-routing to speakers.',
          context: 'Discussed at [00:18] to eliminate audio distortion and feedback during Teams/Zoom calls.',
          timestamp: 18,
        },
        {
          decision: 'Decouple Pipeline A (lossless session recording) from Pipeline B (16kHz mono PCM for local STT).',
          context: 'Agreed at [00:28] to ensure recording quality is not compromised for speech-to-text.',
          timestamp: 28,
        },
        {
          decision: 'Reserve Gemini strictly for post-meeting reasoning and structured intelligence instead of streaming 3-second slices.',
          context: 'Agreed during sync at [01:42] to avoid 429 rate limit quotas and slice hallucinations.',
          timestamp: 102,
        },
      ],
      actionItems: [
        {
          task: 'Implement local VAD and 16kHz PCM downsampler worker',
          owner: 'Alex',
          deadline: 'Next Friday',
          priority: 'high',
          timestamp: 40,
        },
        {
          task: 'Connect Gemini structured post-meeting reasoning schema with timestamp linking',
          owner: 'Sarah',
          deadline: 'Not specified',
          priority: 'high',
          timestamp: 54,
        },
        {
          task: 'Verify graceful degradation when microphone or loopback audio is unavailable',
          owner: 'Not specified',
          deadline: 'Not specified',
          priority: 'medium',
          timestamp: 85,
        },
      ],
      importantPoints: [
        {
          topic: 'WASAPI Loopback Capture Mechanism',
          detail: 'Loopback captures the mixed Windows render endpoint directly from audio hardware with zero latency and no virtual cable requirement.',
          timestamp: 18,
        },
        {
          topic: 'Independent Streams ([Me] vs [Meeting])',
          detail: 'Microphone and meeting streams are processed separately, enabling exact speaker attribution between local participant and external meeting callers.',
          timestamp: 28,
        },
        {
          topic: 'Graceful Degradation Strategy',
          detail: 'If microphone permission is denied or device disconnected, system audio recording and transcription continues without failing.',
          timestamp: 85,
        },
      ],
      risks: [
        {
          risk: 'Browser sandbox restrictions prevent direct WASAPI COM initialization without desktop shell.',
          impact: 'Browser fallback must use getDisplayMedia passive loopback, requiring user to check "Share audio".',
          suggestedFollowUp: 'Package application via Electron desktop shell with native WASAPI bindings.',
        },
        {
          risk: 'High CPU usage if large Whisper models are executed on low-spec laptops.',
          impact: 'Audio stutter or delayed transcription on bronze hardware.',
          suggestedFollowUp: 'Hardware detector automatically configures Whisper Tiny for machines with under 4 cores.',
        },
      ],
      openQuestions: [
        'Are there specific antivirus restrictions on Windows 11 loopback capture endpoints in enterprise environments?',
      ],
      followUps: [
        'Run end-to-end integration test with Microsoft Teams desktop app and Zoom desktop app.',
        'Benchmark CPU utilization of Whisper Base vs Whisper Tiny under heavy meeting traffic.',
      ],
      keyTopics: [
        {
          topic: 'WASAPI Loopback Capture Mechanism',
          details: ['Loopback captures the mixed Windows render endpoint directly from audio hardware.'],
        },
        {
          topic: 'Independent Streams ([Me] vs [Meeting])',
          details: ['Microphone and meeting streams are processed separately for attribution.'],
        },
      ],
      keyTakeaways: [
        'Zero-echo guarantee achieved by passive tapping without connecting to speaker destination.',
        'Local 16kHz PCM pipeline cuts Gemini API token consumption by over 95%.',
        'Timestamps allow jumping directly to key decisions in audio playback.',
      ],
      sentiment: 'Collaborative & Technical',
      wordCount: 172,
    },
  },
];
