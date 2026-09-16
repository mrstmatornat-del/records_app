import React, { useState } from 'react';
import { Mic, Square, Monitor, Upload, Sparkles, Clock, AlertTriangle, Languages, Volume2, ExternalLink, Users } from 'lucide-react';
import { AudioSourceType, STTLanguage } from '../types';

interface AudioControlsProps {
  isRecording: boolean;
  isAnalyzing: boolean;
  audioSource: AudioSourceType;
  setAudioSource: (source: AudioSourceType) => void;
  sttLanguage: STTLanguage;
  setSttLanguage: (lang: STTLanguage) => void;
  onStart: () => void;
  onEnd: () => void;
  onSimulateSpeech?: (text: string) => void;
  durationSeconds: number;
  errorMessage?: string | null;
  micVolume?: number;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isRecording,
  isAnalyzing,
  audioSource,
  setAudioSource,
  sttLanguage,
  setSttLanguage,
  onStart,
  onEnd,
  onSimulateSpeech,
  durationSeconds,
  errorMessage,
  micVolume = 0,
}) => {
  const [customText, setCustomText] = useState('');

  // Format seconds to MM:SS or HH:MM:SS
  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const sampleEnglishPhrases = [
    "Welcome to our live audio session today.",
    "We are discussing key project updates and milestones.",
    "Let's review the AI summary generated from this recorded audio.",
    "Xin chào! Đây là thử nghiệm nhận diện giọng nói.",
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm transition-all space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Left: Audio Input & Language Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Audio Source / Nguồn Âm Thanh
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                id="source-mic-btn"
                type="button"
                disabled={isRecording}
                onClick={() => setAudioSource('mic')}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border ${
                  audioSource === 'mic'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 font-semibold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                } ${isRecording ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <Mic className="w-3.5 h-3.5 text-indigo-500" />
                <span>Microphone</span>
              </button>

              <button
                id="source-tab-btn"
                type="button"
                disabled={isRecording}
                onClick={() => setAudioSource('tab')}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border ${
                  audioSource === 'tab'
                    ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-semibold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                } ${isRecording ? 'opacity-60 cursor-not-allowed' : ''}`}
                title="Capture Browser Tab / Zoom / Meet / YouTube Audio"
              >
                <Monitor className="w-3.5 h-3.5 text-purple-500" />
                <span>Browser Tab</span>
              </button>

              <button
                id="source-combined-btn"
                type="button"
                disabled={isRecording}
                onClick={() => setAudioSource('combined')}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border ${
                  audioSource === 'combined'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-semibold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                } ${isRecording ? 'opacity-60 cursor-not-allowed' : ''}`}
                title="Interview Mode: Mix Mic (Your Voice) + Tab Audio (Interviewer Voice)"
              >
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                <span>Mic + Tab (Interview Mode)</span>
              </button>
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Languages className="w-3.5 h-3.5 text-indigo-500" />
              Language / Ngôn ngữ
            </label>
            <select
              disabled={isRecording}
              value={sttLanguage}
              onChange={(e) => setSttLanguage(e.target.value as STTLanguage)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            >
              <option value="en-US">English (en-US)</option>
              <option value="vi-VN">Tiếng Việt (vi-VN)</option>
            </select>
          </div>
        </div>

        {/* Center: Main Start / End Action Button */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
          {!isRecording ? (
            <button
              id="start-streaming-btn"
              type="button"
              disabled={isAnalyzing}
              onClick={onStart}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-semibold text-base shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-98 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <div className="w-4 h-4 rounded-full bg-white animate-pulse" />
              <span>START Recording Audio</span>
            </button>
          ) : (
            <button
              id="end-streaming-btn"
              type="button"
              onClick={onEnd}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-base shadow-lg shadow-red-500/25 hover:shadow-red-500/40 active:scale-98 transition-all flex items-center justify-center gap-3 animate-pulse"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>END & Generate Notes</span>
            </button>
          )}

          {/* Live Timer Counter & Mic Volume Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono text-base font-bold">
              <Clock className={`w-4 h-4 ${isRecording ? 'text-red-500 animate-spin' : 'text-slate-400'}`} />
              <span>{formatTime(durationSeconds)}</span>
            </div>

            {isRecording && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" title="Audio Input Level">
                <Volume2 className="w-4 h-4 text-emerald-500 animate-pulse" />
                <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.max(5, micVolume)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Stream Audio Source Badge during recording */}
      {isRecording && (audioSource === 'tab' || audioSource === 'combined') && (
        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 font-semibold">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-600"></span>
            </span>
            <span>
              {audioSource === 'combined' ? '🎙️ Interview Dual-Stream (Mic + Device/Tab Audio)' : '📡 Live Tab & Device Streaming Active'}
            </span>
          </div>
          <span className="text-[11px] text-purple-700 dark:text-purple-300 italic">
            ⚡ Âm thanh phát từ Thẻ / Cửa sổ app đang được Gemini AI tự động giải mã thành chữ nhảy trực tiếp (mỗi 3 giây)
          </span>
        </div>
      )}

      {/* Browser Tab Guidance Notice */}
      {audioSource === 'tab' && !isRecording && (
        <div className="p-3.5 rounded-xl bg-purple-50/90 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-xs space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold text-purple-950 dark:text-purple-100">
              <Monitor className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>Hướng dẫn đính kèm Thẻ web (YouTube, Google Meet, Zoom...) / Cửa sổ app:</span>
            </div>
            {typeof window !== 'undefined' && window.self !== window.top && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-white bg-purple-100 dark:bg-purple-900/60 px-2 py-1 rounded-md transition-colors border border-purple-300 dark:border-purple-700 shrink-0"
              >
                Mở ở Tab Mới <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <ol className="list-disc list-inside space-y-1 text-[11.5px] text-purple-800 dark:text-purple-300">
            <li>Nhấn nút <strong>START Recording</strong> bên trên.</li>
            <li>Chọn tab <strong>Chrome Tab</strong> (như Youtube, Spotify...) hoặc <strong>Window</strong> (Zoom, Teams...).</li>
            <li><strong>QUAN TRỌNG:</strong> Tích chọn ô <span className="underline font-bold decoration-purple-500 text-purple-950 dark:text-white">"Chia sẻ âm thanh" (Share audio)</span> ở góc dưới bên trái trước khi nhấn <em>Share</em>!</li>
          </ol>
        </div>
      )}

      {/* Error / Permission Notice */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Speech Testing & Simulator Panel */}
      {isRecording && onSimulateSpeech && (
        <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Quick Text Test Injector (Nói/Thử nghiệm văn bản)
            </span>
            <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
              Gemini AI will also transcribe recorded audio automatically!
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {sampleEnglishPhrases.map((phrase, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSimulateSpeech(phrase)}
                className="text-xs text-left px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-slate-700 transition-colors shadow-2xs"
              >
                "{phrase}"
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Nhập hoặc gõ câu văn bản để đưa trực tiếp vào đoạn hội thoại..."
              className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-indigo-200 dark:border-indigo-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customText.trim()) {
                  onSimulateSpeech(customText.trim());
                  setCustomText('');
                }
              }}
            />
            <button
              type="button"
              disabled={!customText.trim()}
              onClick={() => {
                if (customText.trim()) {
                  onSimulateSpeech(customText.trim());
                  setCustomText('');
                }
              }}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Chèn văn bản
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
