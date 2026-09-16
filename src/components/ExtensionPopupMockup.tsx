import React, { useState } from 'react';
import { AudioSession, AudioSourceType, TranscriptSegment } from '../types';
import { Radio, Mic, Monitor, Square, Sparkles, Copy, Check, ChevronRight, X, Layers, Clock } from 'lucide-react';

interface ExtensionPopupMockupProps {
  isRecording: boolean;
  isAnalyzing: boolean;
  audioSource: AudioSourceType;
  setAudioSource: (source: AudioSourceType) => void;
  onStart: () => void;
  onEnd: () => void;
  transcript: TranscriptSegment[];
  currentSession: AudioSession | null;
  durationSeconds: number;
  onSwitchToWorkspace: () => void;
}

export const ExtensionPopupMockup: React.FC<ExtensionPopupMockupProps> = ({
  isRecording,
  isAnalyzing,
  audioSource,
  setAudioSource,
  onStart,
  onEnd,
  transcript,
  currentSession,
  durationSeconds,
  onSwitchToWorkspace,
}) => {
  const [copied, setCopied] = useState(false);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const fullText = transcript.map((s) => s.text).join(' ');

  const handleCopy = () => {
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto my-6 bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 font-sans transition-all">
      {/* Chrome Extension Browser Header Bar */}
      <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white">
            <Radio className={`w-4 h-4 ${isRecording ? 'animate-pulse text-emerald-300' : ''}`} />
          </div>
          <div>
            <h3 className="font-bold text-xs text-white tracking-tight flex items-center gap-1.5">
              StreamNote AI <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-900 text-indigo-300 border border-indigo-700">v1.0</span>
            </h3>
            <p className="text-[10px] text-slate-400">Chrome Extension Active</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSwitchToWorkspace}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-950/60 px-2 py-1 rounded-md border border-indigo-800"
          title="Expand to full workspace"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Full View</span>
        </button>
      </div>

      {/* Main Extension Popup Container */}
      <div className="p-5 space-y-4">
        {/* Source Selector */}
        <div className="flex items-center justify-between text-[11px] bg-slate-800/80 p-1.5 rounded-xl border border-slate-700 gap-1">
          <button
            type="button"
            disabled={isRecording}
            onClick={() => setAudioSource('mic')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
              audioSource === 'mic' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic className="w-3 h-3" /> Mic
          </button>
          <button
            type="button"
            disabled={isRecording}
            onClick={() => setAudioSource('tab')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
              audioSource === 'tab' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3 h-3" /> Tab
          </button>
          <button
            type="button"
            disabled={isRecording}
            onClick={() => setAudioSource('combined')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
              audioSource === 'combined' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
            }`}
            title="Interview Mode: Mic + Tab Combined"
          >
            Dual Mode
          </button>
        </div>

        {/* Start / End Button */}
        <div>
          {!isRecording ? (
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={onStart}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-98 transition-all flex items-center justify-center gap-2.5"
            >
              <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              START Streaming Audio
            </button>
          ) : (
            <button
              type="button"
              onClick={onEnd}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-red-500/20 active:scale-98 transition-all flex items-center justify-center gap-2.5 animate-pulse"
            >
              <Square className="w-4 h-4 fill-current" />
              END & Analyze Session ({formatTime(durationSeconds)})
            </button>
          )}
        </div>

        {/* Mini Live Transcript */}
        <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800 h-52 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] border-b border-slate-800 pb-2 text-slate-400">
            <span className="flex items-center gap-1 font-medium text-slate-300">
              <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              English STT Stream
            </span>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!fullText}
              className="hover:text-white flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-2 space-y-2 text-xs">
            {transcript.length === 0 ? (
              <p className="text-slate-500 text-center py-6 text-[11px]">
                {isRecording ? 'Listening for English speech...' : 'Press START to capture tab audio or mic...'}
              </p>
            ) : (
              transcript.map((seg) => (
                <div key={seg.id} className="text-slate-200 bg-slate-900/60 p-2 rounded-lg text-xs leading-normal border border-slate-800">
                  <span className="text-[10px] text-indigo-400 font-mono mr-1.5">[{Math.floor(seg.timestamp)}s]</span>
                  {seg.text}
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
            <span>Segments: {transcript.length}</span>
            <span>Duration: {formatTime(durationSeconds)}</span>
          </div>
        </div>

        {/* AI Analysis Preview Box (if session completed) */}
        {currentSession?.analysis && (
          <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/60 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI Notes Summary
              </span>
              <button
                onClick={onSwitchToWorkspace}
                className="text-purple-300 hover:text-white flex items-center text-[10px]"
              >
                View full notes <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <p className="text-slate-300 text-[11px] line-clamp-3 leading-relaxed">
              {currentSession.analysis.summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
