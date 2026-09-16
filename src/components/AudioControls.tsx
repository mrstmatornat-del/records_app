import React from 'react';
import {
  Mic,
  Square,
  Pause,
  Play,
  Volume2,
  Clock,
  Target,
  ShieldCheck,
  Headphones,
  Sliders,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { AudioSourceType, STTLanguage, AudioLevels, MeetingContext } from '../types';

interface AudioControlsProps {
  isRecording: boolean;
  isPaused?: boolean;
  isAnalyzing: boolean;
  audioSource: AudioSourceType;
  setAudioSource: (source: AudioSourceType) => void;
  sttLanguage: STTLanguage;
  setSttLanguage: (lang: STTLanguage) => void;
  onStart: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onEnd: () => void;
  onSimulateSpeech?: (text: string) => void;
  durationSeconds: number;
  errorMessage?: string | null;
  audioLevels?: AudioLevels;
  onOpenMeetingSetup?: () => void;
  meetingContext?: MeetingContext;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isRecording,
  isPaused = false,
  isAnalyzing,
  audioSource,
  setAudioSource,
  sttLanguage,
  setSttLanguage,
  onStart,
  onPause,
  onResume,
  onEnd,
  durationSeconds,
  errorMessage,
  audioLevels = { micLevel: 0, systemLevel: 0 },
  onOpenMeetingSetup,
  meetingContext,
}) => {
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

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm transition-all space-y-4">
      {/* Top Bar: Meeting Objective Context Preview & Setup Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {meetingContext?.title || 'Windows Meeting Intelligence Session'}
              </h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                Notion AI Assistant
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate max-w-xl">
              <strong className="text-slate-700 dark:text-slate-300">Goal:</strong>{' '}
              {meetingContext?.objective || 'Passively record meeting audio and extract structured intelligence'}
            </p>
          </div>
        </div>

        {onOpenMeetingSetup && !isRecording && (
          <button
            type="button"
            onClick={onOpenMeetingSetup}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 transition-all flex items-center gap-1.5 shrink-0"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-500" />
            <span>Edit Meeting Goals</span>
          </button>
        )}
      </div>

      {/* Main Controls Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Audio Source & Language Selectors */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Audio Source Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span>Capture Mode / Nguồn Thu</span>
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Dual Stream: Windows Audio + Mic (Recommended) */}
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setAudioSource('dual')}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border ${
                  audioSource === 'dual' || audioSource === 'combined'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-semibold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                } ${isRecording ? 'opacity-60 cursor-not-allowed' : ''}`}
                title="Captures both System (Teams/Zoom) and Microphone independently without mixing"
              >
                <Headphones className="w-3.5 h-3.5 text-emerald-500" />
                <span>Teams/Zoom + Mic (Dual Stream)</span>
              </button>

              {/* System Audio Only */}
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setAudioSource('system')}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border ${
                  audioSource === 'system' || audioSource === 'tab'
                    ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-semibold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                } ${isRecording ? 'opacity-60 cursor-not-allowed' : ''}`}
                title="Passively captures meeting audio from Teams, Zoom, or Browser tabs"
              >
                <Volume2 className="w-3.5 h-3.5 text-purple-500" />
                <span>System Audio Only</span>
              </button>

              {/* Microphone Only */}
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setAudioSource('mic')}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 border ${
                  audioSource === 'mic'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 font-semibold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                } ${isRecording ? 'opacity-60 cursor-not-allowed' : ''}`}
                title="Captures only your microphone voice"
              >
                <Mic className="w-3.5 h-3.5 text-indigo-500" />
                <span>Microphone Only</span>
              </button>
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Language
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

        {/* Center/Right: Action Buttons & VU Meters */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {!isRecording ? (
            <button
              id="start-streaming-btn"
              type="button"
              disabled={isAnalyzing}
              onClick={onStart}
              className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-98 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-white animate-pulse" />
              <span>START Meeting Recording</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Pause / Resume Button */}
              {isPaused ? (
                <button
                  type="button"
                  onClick={onResume}
                  className="px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm"
                  title="Resume Meeting Recording"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onPause}
                  className="px-4 py-3 rounded-2xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 shadow-sm"
                  title="Pause Recording"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
              )}

              {/* Stop & Generate Notes */}
              <button
                id="end-streaming-btn"
                type="button"
                onClick={onEnd}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all flex items-center gap-2"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>STOP & Generate Notes</span>
              </button>
            </div>
          )}

          {/* Live Timer */}
          <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono text-sm font-bold">
            <Clock className={`w-4 h-4 ${isRecording && !isPaused ? 'text-red-500 animate-spin' : 'text-slate-400'}`} />
            <span>{formatTime(durationSeconds)}</span>
          </div>

          {/* Independent Dual VU Meters during recording */}
          {isRecording && (
            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              {/* System Audio Level (Meeting) */}
              <div className="flex flex-col gap-0.5" title="Meeting / System Audio Level">
                <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Meeting
                </span>
                <div className="w-14 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-75"
                    style={{ width: `${Math.max(4, audioLevels.systemLevel)}%` }}
                  />
                </div>
              </div>

              {/* Microphone Level (Me) */}
              <div className="flex flex-col gap-0.5" title="Microphone Level (Your Voice)">
                <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Me (Mic)
                </span>
                <div className="w-14 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-75"
                    style={{ width: `${Math.max(4, audioLevels.micLevel)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zero Echo & Audio Quality Guarantee Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200 text-[11px]">
        <div className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Zero-Distortion Passive Tap: You will hear Teams/Zoom meetings normally through speakers with 0 echo or feedback.</span>
        </div>
        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono">
          STT: 16kHz PCM &bull; Post-processing: Gemini 3.6 Flash
        </span>
      </div>

      {/* Error / Failsafe Notification */}
      {errorMessage && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
