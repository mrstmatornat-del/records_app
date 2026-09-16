import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { AudioControls } from './components/AudioControls';
import { LiveVisualizer } from './components/LiveVisualizer';
import { LiveTranscript } from './components/LiveTranscript';
import { AINotesPanel } from './components/AINotesPanel';
import { ExtensionPopupMockup } from './components/ExtensionPopupMockup';
import { SessionHistoryModal } from './components/SessionHistoryModal';
import { LocalModelSettingsModal } from './components/LocalModelSettingsModal';
import { AudioSession, AudioSourceType, STTLanguage, TranscriptSegment, SessionAnalysis } from './types';
import { AudioStreamManager } from './utils/audioStreamer';
import { generateLocalSummary } from './utils/localSummarizer';
import { LocalEngineConfig, DEFAULT_LOCAL_CONFIG, generateLocalFastAnalysis } from './utils/localModelEngine';
import { DEMO_SESSIONS } from './data/demoSessions';
import { Sparkles, Radio, HelpCircle, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';

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
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);

  const [currentSession, setCurrentSession] = useState<AudioSession | null>(DEMO_SESSIONS[0]);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>(DEMO_SESSIONS[0].transcript);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [audioSource, setAudioSource] = useState<AudioSourceType>('mic');
  const [sttLanguage, setSttLanguage] = useState<STTLanguage>('en-US');
  const [micVolume, setMicVolume] = useState<number>(0);
  const [durationSeconds, setDurationSeconds] = useState(DEMO_SESSIONS[0].durationSeconds);
  const [viewMode, setViewMode] = useState<'workspace' | 'extension'>('workspace');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioManagerRef = useRef<AudioStreamManager | null>(null);
  const timerRef = useRef<any>(null);

  // Save engineConfig to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('streamnote_engine_config', JSON.stringify(engineConfig));
    } catch (e) {
      console.warn("Could not save engineConfig to localStorage", e);
    }
  }, [engineConfig]);

  // Initialize AudioStreamManager
  useEffect(() => {
    audioManagerRef.current = new AudioStreamManager();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioManagerRef.current) audioManagerRef.current.stopStream();
    };
  }, []);

  // Update STT language dynamically
  useEffect(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.setLanguage(sttLanguage);
    }
  }, [sttLanguage]);

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('streamnote_sessions', JSON.stringify(sessions));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  }, [sessions]);

  // Handle START Streaming Audio
  const handleStartRecording = async () => {
    setErrorMessage(null);
    const newSessionId = `session-${Date.now()}`;

    const newSession: AudioSession = {
      id: newSessionId,
      title: `Live Audio Session (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
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
    setMicVolume(0);

    // Timer interval
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);

    try {
      if (audioManagerRef.current) {
        await audioManagerRef.current.startStream(
          audioSource === 'demo' ? 'mic' : (audioSource as 'mic' | 'tab' | 'combined' | 'file'),
          sttLanguage,
          (segment) => {
            setTranscript((prev) => {
              const existingIdx = prev.findIndex((s) => s.id === segment.id);
              if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = segment;
                return updated;
              } else {
                return [...prev, segment];
              }
            });
          },
          (err) => {
            setErrorMessage(err);
          },
          (vol) => {
            setMicVolume(vol);
          },
          async (base64Slice, mime, elapsedSec) => {
            // Real-time incremental slice transcription for browser tab / device audio (Interviewer/Meeting voice)
            try {
              const transRes = await fetch('/api/transcribe-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioBase64: base64Slice,
                  mimeType: mime,
                  targetLanguage: sttLanguage === 'vi-VN' ? 'vi' : 'en',
                }),
              });
              if (transRes.ok) {
                const transData = await transRes.json();
                if (transData.transcript && transData.transcript.trim().length > 0) {
                  const text = transData.transcript.trim();
                  const speakerName =
                    audioSource === 'combined'
                      ? 'Interview (Mic + Tab)'
                      : audioSource === 'tab'
                      ? 'Interviewer (Browser Tab)'
                      : 'Live Speaker (Mic)';
                  const liveSeg: TranscriptSegment = {
                    id: `live-tab-slice-${Date.now()}`,
                    timestamp: elapsedSec,
                    text,
                    isFinal: true,
                    speaker: speakerName,
                  };
                  setTranscript((prev) => {
                    const last = prev[prev.length - 1];
                    if (last && last.text === text) return prev;
                    return [...prev, liveSeg];
                  });
                }
              } else {
                const errJson = await transRes.json().catch(() => ({}));
                if (errJson.error && errJson.error.includes("429")) {
                  console.warn("Live slice rate limit warning:", errJson.error);
                }
              }
            } catch (sliceErr) {
              console.warn("Live audio slice transcription error:", sliceErr);
            }
          }
        );
      }
    } catch (err: any) {
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setErrorMessage(err.message || "Could not start audio stream.");
    }
  };

  // Handle END Streaming Audio & AI Session Analysis
  const handleEndRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setMicVolume(0);

    let finalDuration = durationSeconds;
    let audioBase64: string | undefined;
    let mimeType = 'audio/webm';

    if (audioManagerRef.current) {
      const result = await audioManagerRef.current.stopStream();
      if (result.durationSeconds > 0) finalDuration = Math.round(result.durationSeconds);
      audioBase64 = result.audioBase64;
      mimeType = result.mimeType || 'audio/webm';
    }

    let activeTranscript = [...transcript];

    // For Tab capture or when live Speech Recognition captured little/nothing, transcribe the recorded audio stream via Gemini Multimodal Audio API
    if (audioBase64 && (audioSource === 'tab' || activeTranscript.length === 0)) {
      setIsAnalyzing(true);
      try {
        const transRes = await fetch('/api/transcribe-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType,
            targetLanguage: sttLanguage === 'vi-VN' ? 'vi' : 'en',
          }),
        });

        const transData = await transRes.json();

        if (transRes.ok && transData.transcript && transData.transcript.trim().length > 0) {
          const rawText = transData.transcript.trim();
          // Split into clean sentence segments
          const sentences = rawText.split(/(?<=[.?!])\s+/).filter((s: string) => s.trim().length > 0);
          
          const aiSegments: TranscriptSegment[] = sentences.map((sentence: string, idx: number) => ({
            id: `ai-transcribed-${Date.now()}-${idx}`,
            timestamp: Math.round((finalDuration / Math.max(1, sentences.length)) * idx),
            text: sentence.trim(),
            isFinal: true,
            speaker: audioSource === 'tab' ? 'Browser Tab Speaker' : 'Recorded Speaker',
          }));

          activeTranscript = aiSegments.length > 0 ? aiSegments : [{
            id: `ai-transcribed-${Date.now()}`,
            timestamp: 0,
            text: rawText,
            isFinal: true,
            speaker: 'Recorded Speaker',
          }];

          setTranscript(activeTranscript);
        }
      } catch (transErr) {
        console.warn("Gemini audio transcription fallback error:", transErr);
      } finally {
        setIsAnalyzing(false);
      }
    }

    // Trigger AI Analysis via Gemini server endpoint
    await analyzeTranscript(activeTranscript, finalDuration);
  };

  // Call AI server /api/analyze-session endpoint or Local Fast Offline engine
  const analyzeTranscript = async (currentSegments: TranscriptSegment[], durationSec: number) => {
    const fullText = currentSegments.map((s) => s.text).join(' ');

    if (!fullText || fullText.trim().length === 0) {
      setErrorMessage("Chưa có văn bản thu âm nào được ghi lại.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    // If user selected Local Fast (Offline Light Mode) for Bronze machines
    if (engineConfig.engineType === 'local-fast') {
      setTimeout(() => {
        const localAnalysis = generateLocalFastAnalysis(fullText, durationSec);
        const fastSession: AudioSession = {
          id: currentSession?.id || `session-${Date.now()}`,
          title: localAnalysis.title || 'Live Audio Session',
          createdAt: currentSession?.createdAt || new Date().toISOString(),
          durationSeconds: durationSec,
          transcript: currentSegments,
          analysis: localAnalysis,
          audioSource,
          status: 'completed',
        };
        setCurrentSession(fastSession);
        setSessions((prev) => [fastSession, ...prev.filter((s) => s.id !== fastSession.id)]);
        setIsAnalyzing(false);
      }, 100);
      return;
    }

    try {
      const response = await fetch('/api/analyze-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: fullText,
          durationSeconds: durationSec,
          engineType: engineConfig.engineType,
          ollamaUrl: engineConfig.ollamaUrl,
          ollamaModel: engineConfig.ollamaModel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze audio session.');
      }

      const analysis: SessionAnalysis = data;

      const completedSession: AudioSession = {
        id: currentSession?.id || `session-${Date.now()}`,
        title: analysis.title || 'Live Audio Session',
        createdAt: currentSession?.createdAt || new Date().toISOString(),
        durationSeconds: durationSec,
        transcript: currentSegments,
        analysis,
        audioSource,
        status: 'completed',
      };

      setCurrentSession(completedSession);
      setSessions((prev) => [completedSession, ...prev.filter((s) => s.id !== completedSession.id)]);
    } catch (err: any) {
      console.warn("AI API error, falling back to Local Fast Offline NLP engine:", err);
      
      // Fallback: Use client-side Local Fast NLP summarizer (100% Free & Unlimited)
      const localAnalysis = generateLocalFastAnalysis(fullText, durationSec);
      
      const fallbackSession: AudioSession = {
        id: currentSession?.id || `session-${Date.now()}`,
        title: localAnalysis.title || 'Tóm tắt nhanh (Offline Fast)',
        createdAt: currentSession?.createdAt || new Date().toISOString(),
        durationSeconds: durationSec,
        transcript: currentSegments,
        analysis: localAnalysis,
        audioSource,
        status: 'completed',
      };

      setCurrentSession(fallbackSession);
      setSessions((prev) => [fallbackSession, ...prev.filter((s) => s.id !== fallbackSession.id)]);
      
      setErrorMessage("⚡ Đã tự động dùng Tóm tắt Offline Miễn phí (Zero Latency) do máy chạy chế độ nhẹ!");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Simulate text injection into stream
  const handleSimulateSpeech = (text: string) => {
    if (!isRecording) return;

    const newSeg: TranscriptSegment = {
      id: `sim-${Date.now()}`,
      timestamp: durationSeconds,
      text,
      isFinal: true,
      speaker: 'Speaker',
    };

    setTranscript((prev) => [...prev, newSeg]);
  };

  // Load a demo session
  const handleLoadDemoSession = (demoSession = DEMO_SESSIONS[0]) => {
    setCurrentSession(demoSession);
    setTranscript(demoSession.transcript);
    setDurationSeconds(demoSession.durationSeconds);
    setAudioSource(demoSession.audioSource);
    setErrorMessage(null);
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
      setTranscript([]);
    }
  };

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
              isAnalyzing={isAnalyzing}
              audioSource={audioSource}
              setAudioSource={setAudioSource}
              sttLanguage={sttLanguage}
              setSttLanguage={setSttLanguage}
              onStart={handleStartRecording}
              onEnd={handleEndRecording}
              onSimulateSpeech={handleSimulateSpeech}
              durationSeconds={durationSeconds}
              errorMessage={errorMessage}
              micVolume={micVolume}
            />

            {/* Visualizer Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Radio className={`w-5 h-5 ${isRecording ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Audio Frequency Spectrum
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isRecording ? 'Capturing live audio stream' : 'Visualizer ready'}
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-80">
                <LiveVisualizer isRecording={isRecording} audioManagerRef={audioManagerRef} />
              </div>
            </div>

            {/* Split Grid: Left = Live Transcript (STT), Right = AI Notes & Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Requirement #1: Real-time English Speech-to-Text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    1. Real-Time English STT Stream
                  </h3>
                  <span className="text-[11px] text-slate-400">English (en-US)</span>
                </div>
                <LiveTranscript
                  transcript={transcript}
                  isRecording={isRecording}
                  onClear={() => setTranscript([])}
                  audioSource={audioSource}
                />
              </div>

              {/* Requirement #2: Automated AI Session Notes & Content Analysis */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    2. AI Automated Notes & Analysis
                  </h3>
                  <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                    Powered by Gemini 3.6 Flash
                  </span>
                </div>
                <AINotesPanel
                  analysis={currentSession?.analysis || null}
                  isAnalyzing={isAnalyzing}
                  transcriptText={fullTextString}
                  onReAnalyze={() => analyzeTranscript(transcript, durationSeconds)}
                  engineConfig={engineConfig}
                />
              </div>
            </div>
          </div>
        )}
      </main>

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
