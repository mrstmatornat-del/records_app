import React from 'react';
import { Mic, Radio, Layers, Sparkles, History, HelpCircle, FileAudio, ExternalLink, Cpu, Zap, Terminal } from 'lucide-react';
import { LocalEngineConfig } from '../utils/localModelEngine';

interface HeaderProps {
  isRecording: boolean;
  isAnalyzing: boolean;
  viewMode: 'workspace' | 'extension';
  setViewMode: (mode: 'workspace' | 'extension') => void;
  onOpenHistory: () => void;
  onLoadDemo: () => void;
  engineConfig: LocalEngineConfig;
  onOpenModelSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isRecording,
  isAnalyzing,
  viewMode,
  setViewMode,
  onOpenHistory,
  onLoadDemo,
  engineConfig,
  onOpenModelSettings,
}) => {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & App Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Radio className={`w-5 h-5 ${isRecording ? 'animate-pulse text-emerald-300' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight">
                StreamNote AI
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                <Sparkles className="w-3 h-3 text-indigo-500" /> Extension Mode
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Browser Audio Streaming &bull; Real-time English STT &bull; AI Session Notes
            </p>
          </div>
        </div>

        {/* Dynamic Status Badge */}
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs font-medium animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>Live Streaming Audio</span>
            </div>
          )}
          {isAnalyzing && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-600 dark:text-purple-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-500" />
              <span>Gemini AI Analyzing Session...</span>
            </div>
          )}
          {!isRecording && !isAnalyzing && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Ready to Start
            </div>
          )}
        </div>

        {/* Actions & View Selector */}
        <div className="flex items-center gap-2">
          {/* View Switcher: Workspace vs Popup Extension Mockup */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex items-center text-xs font-medium border border-slate-200 dark:border-slate-700">
            <button
              id="view-mode-workspace-btn"
              onClick={() => setViewMode('workspace')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'workspace'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Full Workspace</span>
            </button>
            <button
              id="view-mode-extension-btn"
              onClick={() => setViewMode('extension')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'extension'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Extension Popup</span>
            </button>
          </div>

          {/* Quick Demo Loader */}
          <button
            id="load-demo-btn"
            onClick={onLoadDemo}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
            title="Load Demo Recorded Session"
          >
            <FileAudio className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden lg:inline">Try Demo Session</span>
          </button>

          {/* AI Model / Local Engine Config Trigger */}
          <button
            id="ai-model-config-btn"
            onClick={onOpenModelSettings}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 border shadow-sm ${
              engineConfig.engineType === 'local-fast'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : engineConfig.engineType === 'local-ollama'
                ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Configure AI Model (Cloud vs Local LLM vs Local Fast Bronze)"
          >
            {engineConfig.engineType === 'local-fast' && <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-500" />}
            {engineConfig.engineType === 'local-ollama' && <Terminal className="w-3.5 h-3.5 text-purple-600" />}
            {engineConfig.engineType === 'gemini' && <Cpu className="w-3.5 h-3.5 text-indigo-500" />}
            <span className="hidden sm:inline">
              {engineConfig.engineType === 'local-fast' ? 'Local Fast (Offline)' : engineConfig.engineType === 'local-ollama' ? 'Local LLM' : 'Gemini Cloud'}
            </span>
          </button>

          {/* Session History Modal Trigger */}
          <button
            id="session-history-btn"
            onClick={onOpenHistory}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
            title="Saved Sessions & History"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
