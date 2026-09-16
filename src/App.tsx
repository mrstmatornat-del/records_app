import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { AudioControls } from './components/AudioControls';
import { LiveVisualizer } from './components/LiveVisualizer';
import { LiveTranscript } from './components/LiveTranscript';
import { AINotesPanel } from './components/AINotesPanel';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { MeetingSetupModal } from './components/MeetingSetupModal';
import { ExtensionPopupMockup } from './components/ExtensionPopupMockup';
import { SessionHistoryModal } from './components/SessionHistoryModal';
import { LocalModelSettingsModal } from './components/LocalModelSettingsModal';
import {
  AudioSession,
  AudioSourceType,
  STTLanguage,
  TranscriptSegment,
  SessionAnalysis,
  MeetingContext,
  AudioLevels,
} from './types';
import { STTEngineStatusEvent } from './services/stt/ISTTEngine';
import { AudioCaptureService } from './services/AudioCaptureService';
import { LocalSTTService } from './services/LocalSTTService';
import { transcriptEventBus } from './services/TranscriptEventBus';
import { LocalEngineConfig, DEFAULT_LOCAL_CONFIG, generateLocalFastAnalysis } from './utils/localModelEngine';
import { DEMO_SESSIONS } from './data/demoSessions';
import { Sparkles, Radio, ShieldCheck, Cpu } from 'lucide-react';

export default function App() {
  const [sessions, setSessions] = useState<AudioSession[]>(() => {
    try {
      const saved = localStorage.getItem('streamnote_sessions');
      return saved ? JSON.parse(saved) : DEMO_SESSIONS;
    } catch {
      return DEMO_SESSIONS;
    }
  });

  const [engineConfig, setEngineConfig] = useState<LocalEngineConfig>(() => {
    try {
      const saved = localStorage.getItem('streamnote_engine_config');
      return saved ? JSON.parse(saved) : DEFAULT_LOCAL_CONFIG;
    } catch {
      return DEFAULT_LOCAL_CONFIG;
    }
  });

  const [meetingContext, setMeetingContext] = useState<MeetingContext>({
    title: 'Windows Meeting Architecture & Intelligence Sync',
    objective: 'Understand reconciliation issues and agree on zero-distortion Windows meeting audio capture.',
    expectedOutcome: 'Sign-off on WASAPI loopback capture, local VAD 16kHz PCM, and timestamp-linked Notion AI notes.',
    watchList: [
      'unresolved technical issues',
      'owners',
      'deadlines',
      'decisions',
      'risks',
      'data quality problems',
    ],
  });

  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [currentSession, setCurrentSession] = useState<AudioSession | null>(DEMO_SESSIONS[0]);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>(DEMO_SESSIONS[0].transcript);
  const [interimSegment, setInterimSegment] = useState<TranscriptSegment | null>(null);
  const [sttStatus, setSttStatus] = useState<STTEngineStatusEvent | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [audioSource, setAudioSource] = useState<AudioSourceType>('dual');
  const [sttLanguage, setSttLanguage] = useState<STTLanguage>('en-US');
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({ micLevel: 0, systemLevel: 0 });
  const [durationSeconds, setDurationSeconds] = useState(DEMO_SESSIONS[0].durationSeconds);
  const [viewMode, setViewMode] = useState<'workspace' | 'extension'>('workspace');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio Playback & Timestamp Navigation State
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [seekTimestamp, setSeekTimestamp] = useState<number | undefined>(undefined);
  const [activePlaybackTime, setActivePlaybackTime] = useState<number>(-1);

  const audioCaptureRef = useRef<AudioCaptureService | null>(null);
  const sttServiceRef = useRef<LocalSTTService | null>(null);
  const timerRef = useRef<any>(null);

  // Save engineConfig to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('streamnote_engine_config', JSON.stringify(engineConfig));
    } catch (e) {
      console.warn("Could not save engineConfig to localStorage", e);
    }
  }, [engineConfig]);

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('streamnote_sessions', JSON.stringify(sessions));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  }, [sessions]);

  // Initialize AudioCaptureService and LocalSTTService
  useEffect(() => {
    audioCaptureRef.current = new AudioCaptureService();
    sttServiceRef.current = new LocalSTTService({ language: sttLanguage });

    // Connect Audio Levels to state
    const unsubLevels = audioCaptureRef.current.onLevelsChange((levels) => {
      setAudioLevels(levels);
      transcriptEventBus.emitLevels(levels);
    });

    // Connect Audio Error
    const unsubErr = audioCaptureRef.current.onError((err) => {
      setErrorMessage(err);
    });

    // Connect EventBus partial transcript (live interim preview)
    const unsubPartial = transcriptEventBus.onPartialSegment((segment) => {
      setInterimSegment(segment);
    });

    // Connect EventBus final transcript (reconciled canonical segments)
    const unsubFinal = transcriptEventBus.onFinalSegment(() => {
      setInterimSegment(null);
      setTranscript(transcriptEventBus.getSegments());
    });

    // Connect STT Engine status monitoring (Audio captured vs STT Processing vs STT Completed vs SYSTEM_STT_UNAVAILABLE)
    const unsubStatus = transcriptEventBus.onSTTStatus((status) => {
      setSttStatus(status);
    });

    // Stream PCM audio frames from AudioCaptureService to LocalSTTService
    const unsubFrames = audioCaptureRef.current.onAudioFrame((source, pcm16) => {
      if (sttServiceRef.current) {
        const elapsed = durationSeconds;
        sttServiceRef.current.pushAudioFrame(source, pcm16, elapsed);
      }
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      unsubLevels();
      unsubErr();
      unsubPartial();
      unsubFinal();
      unsubStatus();
      unsubFrames();
      if (audioCaptureRef.current) audioCaptureRef.current.stop();
      if (sttServiceRef.current) sttServiceRef.current.stop();
    };
  }, []);

  // Update STT language dynamically
  useEffect(() => {
    if (sttServiceRef.current) {
      sttServiceRef.current.setLanguage(sttLanguage);
    }
  }, [sttLanguage]);

  // Handle START Streaming Audio
  const handleStartRecording = async () => {
    setErrorMessage(null);
    const newSessionId = `session-${Date.now()}`;

    const newSession: AudioSession = {
      id: newSessionId,
      title: meetingContext.title || `Meeting Session (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
      context: meetingContext,
      createdAt: new Date().toISOString(),
      durationSeconds: 0,
      transcript: [],
      audioSource,
      status: 'recording',
    };

    setCurrentSession(newSession);
    setTranscript([]);
    setDurationSeconds(0);
    setIsRecording(true);
    setIsPaused(false);
    setAudioLevels({ micLevel: 0, systemLevel: 0 });
    setInterimSegment(null);
    setSttStatus(null);
    setAudioUrl(undefined);
    transcriptEventBus.clear();

    // Timer interval
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);

    try {
      if (audioCaptureRef.current && sttServiceRef.current) {
        sttServiceRef.current.start();
        await audioCaptureRef.current.start({
          source: audioSource,
        });
      }
    } catch (err: any) {
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setErrorMessage(err.message || 'Could not start audio capture.');
    }
  };

  const handlePauseRecording = () => {
    if (!isRecording) return;
    setIsPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioCaptureRef.current) audioCaptureRef.current.pause();
  };

  const handleResumeRecording = () => {
    if (!isRecording) return;
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
    if (audioCaptureRef.current) audioCaptureRef.current.resume();
  };

  // Handle STOP Meeting Recording & Post-Meeting Gemini Reasoning
  const handleEndRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setIsPaused(false);
    setAudioLevels({ micLevel: 0, systemLevel: 0 });

    let finalDuration = durationSeconds;
    let recordedAudioUrl: string | undefined;

    if (sttServiceRef.current) {
      sttServiceRef.current.stop();
    }

    if (audioCaptureRef.current) {
      const recResult = await audioCaptureRef.current.stop();
      if (recResult.durationSeconds > 0) finalDuration = recResult.durationSeconds;
      recordedAudioUrl = recResult.audioUrl;
      setAudioUrl(recordedAudioUrl);
    }

    setInterimSegment(null);
    const canonicalSegments = transcriptEventBus.getSegments();
    setTranscript(canonicalSegments);

    // Trigger structured AI Analysis strictly from canonical segments
    await analyzeTranscript(canonicalSegments, finalDuration, recordedAudioUrl);
  };

  // Analyze session transcript via Gemini post-meeting reasoning or Local Offline engine
  const analyzeTranscript = async (
    currentSegments: TranscriptSegment[],
    durationSec: number,
    recordedAudioUrl?: string
  ) => {
    if (currentSegments.length === 0) {
      setErrorMessage('Chưa có nội dung cuộc họp nào được ghi lại.');
      return;
    }

    // Format structured dialogue string with timestamps and speaker attribution
    const formattedTranscript = currentSegments
      .map((s) => `[${formatTimestamp(s.startTime || s.timestamp)}] [${s.speaker || (s.source === 'microphone' ? 'Me' : 'Meeting')}]: ${s.text}`)
      .join('\n');

    setIsAnalyzing(true);
    setErrorMessage(null);

    // If user selected Local Fast (Offline Light Mode)
    if (engineConfig.engineType === 'local-fast') {
      setTimeout(() => {
        const localAnalysis = generateLocalFastAnalysis(currentSegments, durationSec, meetingContext.objective);
        const fastSession: AudioSession = {
          id: currentSession?.id || `session-${Date.now()}`,
          title: localAnalysis.title || meetingContext.title || 'Meeting Session',
          context: meetingContext,
          createdAt: currentSession?.createdAt || new Date().toISOString(),
          durationSeconds: durationSec,
          transcript: currentSegments,
          analysis: localAnalysis,
          audioSource,
          status: 'completed',
          audioBlobUrl: recordedAudioUrl,
        };
        setCurrentSession(fastSession);
        setSessions((prev) => [fastSession, ...prev.filter((s) => s.id !== fastSession.id)]);
        setIsAnalyzing(false);
      }, 150);
      return;
    }

    try {
      const response = await fetch('/api/analyze-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: formattedTranscript,
          durationSeconds: durationSec,
          meetingContext,
          engineType: engineConfig.engineType,
          ollamaUrl: engineConfig.ollamaUrl,
          ollamaModel: engineConfig.ollamaModel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze meeting session.');
      }

      const analysis: SessionAnalysis = data;

      const completedSession: AudioSession = {
        id: currentSession?.id || `session-${Date.now()}`,
        title: analysis.title || meetingContext.title || 'Meeting Session',
        context: meetingContext,
        createdAt: currentSession?.createdAt || new Date().toISOString(),
        durationSeconds: durationSec,
        transcript: currentSegments,
        analysis,
        audioSource,
        status: 'completed',
        audioBlobUrl: recordedAudioUrl,
      };

      setCurrentSession(completedSession);
      setSessions((prev) => [completedSession, ...prev.filter((s) => s.id !== completedSession.id)]);
    } catch (err: any) {
      console.warn('AI API error, gracefully degrading to Local Fast Offline NLP engine:', err);

      // Graceful degradation: Run client-side local NLP summarizer
      const localAnalysis = generateLocalFastAnalysis(currentSegments, durationSec, meetingContext.objective);

      const fallbackSession: AudioSession = {
        id: currentSession?.id || `session-${Date.now()}`,
        title: localAnalysis.title || meetingContext.title || 'Meeting Session (Local Notes)',
        context: meetingContext,
        createdAt: currentSession?.createdAt || new Date().toISOString(),
        durationSeconds: durationSec,
        transcript: currentSegments,
        analysis: localAnalysis,
        audioSource,
        status: 'completed',
        audioBlobUrl: recordedAudioUrl,
      };

      setCurrentSession(fallbackSession);
      setSessions((prev) => [fallbackSession, ...prev.filter((s) => s.id !== fallbackSession.id)]);
      setErrorMessage('⚡ Đã tự động kích hoạt Tóm tắt Offline Miễn phí (Zero Latency) do máy chạy chế độ nhẹ hoặc API giới hạn!');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Timestamp jumping handler: jumps playback and highlights transcript
  const handleSeekTimestamp = (sec: number) => {
    setSeekTimestamp(sec);
    setActivePlaybackTime(sec);
  };

  const handleLoadDemoSession = (demoSession = DEMO_SESSIONS[0]) => {
    setCurrentSession(demoSession);
    setTranscript(demoSession.transcript);
    setDurationSeconds(demoSession.durationSeconds);
    setAudioSource(demoSession.audioSource);
    if (demoSession.context) {
      setMeetingContext(demoSession.context);
    }
    setAudioUrl(undefined);
    setErrorMessage(null);
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
      setTranscript([]);
    }
  };

  function formatTimestamp(sec: number) {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  const fullTextString = transcript.map((s) => s.text).join(' ');

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white transition-colors">
      {/* Top Application Header */}
      <Header
        isRecording={isRecording}
        isAnalyzing={isAnalyzing}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onLoadDemo={() => handleLoadDemoSession(DEMO_SESSIONS[0])}
        engineConfig={engineConfig}
        onOpenModelSettings={() => setIsModelModalOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* EXTENSION POPUP MOCKUP MODE */}
        {viewMode === 'extension' ? (
          <div className="py-4">
            <div className="text-center max-w-md mx-auto mb-2 space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Chrome Extension UI Preview
              </span>
              <p className="text-xs text-slate-500">
                Interact with the compact floating toolbar popup as if installed in your browser!
              </p>
            </div>
            <ExtensionPopupMockup
              isRecording={isRecording}
              isAnalyzing={isAnalyzing}
              audioSource={audioSource}
              setAudioSource={setAudioSource}
              onStart={handleStartRecording}
              onEnd={handleEndRecording}
              transcript={transcript}
              currentSession={currentSession}
              durationSeconds={durationSeconds}
              onSwitchToWorkspace={() => setViewMode('workspace')}
            />
          </div>
        ) : (
          /* FULL WORKSPACE VIEW MODE */
          <div className="space-y-6">
            {/* Audio Controls Bar */}
            <AudioControls
              isRecording={isRecording}
              isPaused={isPaused}
              isAnalyzing={isAnalyzing}
              audioSource={audioSource}
              setAudioSource={setAudioSource}
              sttLanguage={sttLanguage}
              setSttLanguage={setSttLanguage}
              onStart={handleStartRecording}
              onPause={handlePauseRecording}
              onResume={handleResumeRecording}
              onEnd={handleEndRecording}
              durationSeconds={durationSeconds}
              errorMessage={errorMessage}
              audioLevels={audioLevels}
              onOpenMeetingSetup={() => setIsSetupModalOpen(true)}
              meetingContext={meetingContext}
            />

            {/* Audio Player Bar (Shown when recording finishes or audio is available) */}
            {audioUrl && (
              <AudioPlayerBar
                audioUrl={audioUrl}
                durationSeconds={durationSeconds}
                seekTimestamp={seekTimestamp}
                onTimeUpdate={(cur) => setActivePlaybackTime(cur)}
              />
            )}

            {/* Visualizer Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Radio className={`w-5 h-5 ${isRecording && !isPaused ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Dual Audio Frequency Spectrum
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isRecording ? (isPaused ? 'Recording paused' : 'Capturing live dual-stream audio') : 'Visualizer ready'}
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-80">
                <LiveVisualizer isRecording={isRecording && !isPaused} audioCaptureRef={audioCaptureRef} />
              </div>
            </div>

            {/* Split Grid: Left = Live Transcript (STT), Right = AI Notes & Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Live Transcript with [Me] and [Meeting] sources & clickable timestamps */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    1. Real-Time Dual-Source Transcript
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    [Me: Mic] &bull; [Meeting: Loopback]
                  </span>
                </div>
                <LiveTranscript
                  transcript={transcript}
                  interimSegment={interimSegment}
                  sttStatus={sttStatus}
                  isRecording={isRecording}
                  onClear={() => {
                    transcriptEventBus.clear();
                    setTranscript([]);
                    setInterimSegment(null);
                  }}
                  audioSource={audioSource}
                  onSeekTimestamp={handleSeekTimestamp}
                  activeTimestamp={activePlaybackTime}
                />
              </div>

              {/* Right Column: AI Meeting Notes (Notion AI Architecture) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    2. AI Meeting Intelligence Notes
                  </h3>
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                    Notion AI Assistant
                  </span>
                </div>
                <AINotesPanel
                  analysis={currentSession?.analysis || null}
                  isAnalyzing={isAnalyzing}
                  transcriptText={fullTextString}
                  onReAnalyze={() => analyzeTranscript(transcript, durationSeconds, audioUrl)}
                  engineConfig={engineConfig}
                  onSeekTimestamp={handleSeekTimestamp}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Meeting Setup Modal */}
      <MeetingSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        context={meetingContext}
        onSaveContext={(newCtx) => setMeetingContext(newCtx)}
        sttLanguage={sttLanguage}
        setSttLanguage={setSttLanguage}
      />

      {/* Session History Modal */}
      <SessionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions}
        onSelectSession={handleLoadDemoSession}
        onDeleteSession={handleDeleteSession}
        currentSessionId={currentSession?.id}
      />

      {/* Local Model & AI Engine Settings Modal */}
      <LocalModelSettingsModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        config={engineConfig}
        onSaveConfig={(newConfig) => setEngineConfig(newConfig)}
      />
    </div>
  );
}
