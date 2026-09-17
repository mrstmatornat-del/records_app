import React, { useState } from 'react';
import { SessionAnalysis, ChatMessage } from '../types';
import {
  Sparkles,
  FileText,
  CheckSquare,
  Lightbulb,
  MessageSquare,
  Download,
  Send,
  RefreshCw,
  Copy,
  Check,
  Target,
  ShieldAlert,
  HelpCircle,
  Clock,
  Play,
  User,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { LocalEngineConfig, generateLocalFastAnswer } from '../utils/localModelEngine';

interface AINotesPanelProps {
  analysis: SessionAnalysis | null;
  isAnalyzing: boolean;
  transcriptText: string;
  onReAnalyze?: () => void;
  engineConfig?: LocalEngineConfig;
  onSeekTimestamp?: (seconds: number) => void;
}

export const AINotesPanel: React.FC<AINotesPanelProps> = ({
  analysis,
  isAnalyzing,
  transcriptText,
  onReAnalyze,
  engineConfig = { engineType: 'gemini', ollamaUrl: 'http://localhost:11434', ollamaModel: 'llama3.2' },
  onSeekTimestamp,
}) => {
  const [activeTab, setActiveTab] = useState<
    'summary' | 'decisions' | 'actions' | 'topics' | 'risks' | 'questions' | 'ask' | 'export'
  >('summary');
  const [completedTasks, setCompletedTasks] = useState<Record<number, boolean>>({});

  // Ask AI Q&A Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);

  const toggleTask = (index: number) => {
    setCompletedTasks((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const formatTimestamp = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Handle Q&A asking Gemini or Local AI about transcript
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim() || !transcriptText || isAsking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: questionInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestionInput('');
    setIsAsking(true);

    try {
      if (engineConfig.engineType === 'local-fast') {
        const fastAnswer = generateLocalFastAnswer(transcriptText, userMsg.text);
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: fastAnswer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const response = await fetch('/api/ask-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: transcriptText,
            question: userMsg.text,
            engineType: engineConfig.engineType,
            ollamaUrl: engineConfig.ollamaUrl,
            ollamaModel: engineConfig.ollamaModel,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to get answer');
        }

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: data.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `Error: ${err.message || 'Could not answer question.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  // Format full Markdown for Notion export
  const generateMarkdownExport = (): string => {
    if (!analysis) return '';

    let md = `# ${analysis.title}\n\n`;
    if (analysis.objective) {
      md += `**Meeting Objective:** ${analysis.objective}\n\n`;
    }
    md += `**Tone/Sentiment:** ${analysis.sentiment}\n\n`;
    md += `## 📝 Executive Summary\n${analysis.executiveSummary || analysis.summary}\n\n`;

    if (analysis.decisions && analysis.decisions.length > 0) {
      md += `## ⚖️ Key Decisions\n`;
      analysis.decisions.forEach((d) => {
        md += `- [${formatTimestamp(d.timestamp)}] **${d.decision}**\n  _${d.context}_\n`;
      });
      md += `\n`;
    }

    if (analysis.actionItems && analysis.actionItems.length > 0) {
      md += `## 🎯 Action Items\n`;
      analysis.actionItems.forEach((item) => {
        const check = completedTasks[item.timestamp] ? '[x]' : '[ ]';
        md += `- ${check} [${formatTimestamp(item.timestamp)}] **${item.task}** (Owner: ${item.owner} | Deadline: ${item.deadline} | Priority: ${item.priority})\n`;
      });
      md += `\n`;
    }

    if (analysis.importantPoints && analysis.importantPoints.length > 0) {
      md += `## 💡 Important Topics & Points\n`;
      analysis.importantPoints.forEach((p) => {
        md += `### [${formatTimestamp(p.timestamp)}] ${p.topic}\n- ${p.detail}\n\n`;
      });
    }

    if (analysis.risks && analysis.risks.length > 0) {
      md += `## ⚠️ Identified Risks & Issues\n`;
      analysis.risks.forEach((r) => {
        md += `- **Risk:** ${r.risk}\n  - **Impact:** ${r.impact}\n  - **Follow-up:** ${r.suggestedFollowUp}\n`;
      });
      md += `\n`;
    }

    if (analysis.openQuestions && analysis.openQuestions.length > 0) {
      md += `## ❓ Open Questions & Follow-ups\n`;
      analysis.openQuestions.forEach((q) => {
        md += `- ${q}\n`;
      });
      md += `\n`;
    }

    md += `---\n*Generated by StreamNote AI Assistant (Notion AI Architecture)*\n`;
    return md;
  };

  const handleDownloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyNotes = () => {
    const md = generateMarkdownExport();
    navigator.clipboard.writeText(md);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);
  };

  // Loading state
  if (isAnalyzing) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center text-center space-y-4 h-[520px]">
        <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center animate-bounce shadow-lg shadow-purple-500/10">
          <Sparkles className="w-8 h-8 animate-spin text-purple-500" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Gemini AI Generating Meeting Intelligence...
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
            Analyzing dual-stream transcript to extract decisions, action items with owners, timestamp links, and risk assessments.
          </p>
        </div>
        <div className="w-48 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse w-3/4 rounded-full" />
        </div>
      </div>
    );
  }

  // Empty state when session not analyzed yet
  if (!analysis) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center text-center h-[520px]">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center mb-4">
          <FileText className="w-7 h-7" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Meeting Intelligence Pending
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1 mb-4">
          Your recording is saved. Click the button below whenever you're
          ready to generate structured Notion-like meeting notes — this runs
          on demand so testing doesn't burn API quota.
        </p>
        {onReAnalyze && transcriptText.length > 0 && (
          <button
            type="button"
            onClick={onReAnalyze}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Meeting Notes Now</span>
          </button>
        )}
      </div>
    );
  }

  const decisions = analysis.decisions || [];
  const actionItems = analysis.actionItems || [];
  const importantPoints = analysis.importantPoints || [];
  const risks = analysis.risks || [];
  const openQuestions = analysis.openQuestions || [];
  const followUps = analysis.followUps || [];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[520px] overflow-hidden">
      {/* Header Tabs (Notion AI Style) */}
      <div className="px-4 pt-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'summary'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Summary</span>
          </button>

          <button
            onClick={() => setActiveTab('decisions')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'decisions'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-emerald-500" />
            <span>Decisions ({decisions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('actions')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'actions'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
            <span>Action Items ({actionItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('topics')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'topics'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span>Topics ({importantPoints.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('risks')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'risks'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>Risks ({risks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'questions'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
            <span>Questions</span>
          </button>

          <button
            onClick={() => setActiveTab('ask')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ask'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
            <span>Ask Q&A</span>
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'export'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>

        {/* Re-analyze button */}
        {onReAnalyze && (
          <button
            type="button"
            onClick={onReAnalyze}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Re-run AI Analysis"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 font-sans text-slate-800 dark:text-slate-200">
        {/* 1. EXECUTIVE SUMMARY TAB */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                {analysis.sentiment || 'Professional Sync'}
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {analysis.title}
              </h2>
              {analysis.objective && (
                <p className="text-xs text-slate-500 mt-0.5">
                  <strong>Objective:</strong> {analysis.objective}
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                Executive Summary
              </h4>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {analysis.executiveSummary || analysis.summary}
              </p>
            </div>

            {/* Quick overview of key decisions & action items */}
            {decisions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Top Decisions
                </h4>
                <div className="space-y-1.5">
                  {decisions.slice(0, 2).map((d, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40 text-xs flex items-start justify-between gap-2"
                    >
                      <span>{d.decision}</span>
                      <button
                        type="button"
                        onClick={() => onSeekTimestamp && onSeekTimestamp(d.timestamp)}
                        className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-mono text-[10px] shrink-0 hover:underline flex items-center gap-1"
                        title="Jump to audio position"
                      >
                        <Play className="w-2 h-2 fill-current" />
                        <span>[{formatTimestamp(d.timestamp)}]</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. DECISIONS TAB WITH TIMESTAMP LINKING */}
        {activeTab === 'decisions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Key Decisions Made
              </h3>
              <span className="text-[11px] text-slate-400">Click timestamp to jump in audio</span>
            </div>

            {decisions.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No explicit decisions identified.</p>
            ) : (
              decisions.map((d, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {d.decision}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{d.context}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSeekTimestamp && onSeekTimestamp(d.timestamp)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-semibold shrink-0 transition-colors flex items-center gap-1"
                      title="Jump audio player to timestamp"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>[{formatTimestamp(d.timestamp)}]</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. ACTION ITEMS TAB WITH OWNERS, DEADLINES, TIMESTAMPS */}
        {activeTab === 'actions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Action Items & Ownership
              </h3>
              <span className="text-[11px] text-slate-400">Owner & Deadline strictly uninvented</span>
            </div>

            {actionItems.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No action items recorded.</p>
            ) : (
              actionItems.map((item, i) => {
                const isChecked = completedTasks[item.timestamp || i];
                return (
                  <div
                    key={i}
                    className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                      isChecked
                        ? 'bg-slate-100/60 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={Boolean(isChecked)}
                          onChange={() => toggleTask(item.timestamp || i)}
                          className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="space-y-1">
                          <p
                            className={`text-sm font-medium ${
                              isChecked
                                ? 'line-through text-slate-500'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.task}
                          </p>

                          {/* Metadata: Owner, Deadline, Priority */}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 font-medium bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{item.owner}</span>
                            </span>

                            <span className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{item.deadline}</span>
                            </span>

                            <span
                              className={`px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase tracking-wider ${
                                item.priority === 'high'
                                  ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900'
                                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                              }`}
                            >
                              {item.priority}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSeekTimestamp && onSeekTimestamp(item.timestamp)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-semibold shrink-0 transition-colors flex items-center gap-1"
                        title="Jump audio player to timestamp"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>[{formatTimestamp(item.timestamp)}]</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 4. IMPORTANT TOPICS TAB WITH TIMESTAMPS */}
        {activeTab === 'topics' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Important Topics & Discussion Detail
            </h3>

            {importantPoints.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No topics detailed.</p>
            ) : (
              importantPoints.map((pt, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      {pt.topic}
                    </h4>
                    <button
                      type="button"
                      onClick={() => onSeekTimestamp && onSeekTimestamp(pt.timestamp)}
                      className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-semibold hover:underline flex items-center gap-1"
                    >
                      <Play className="w-2 h-2 fill-current" />
                      <span>[{formatTimestamp(pt.timestamp)}]</span>
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {pt.detail}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* 5. RISKS TAB */}
        {activeTab === 'risks' && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Identified Risks & Impact
            </h3>

            {risks.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No significant risks identified.</p>
            ) : (
              risks.map((r, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 space-y-2"
                >
                  <h4 className="text-xs font-bold text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Risk: {r.risk}</span>
                  </h4>
                  <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                    <p>
                      <strong>Impact:</strong> {r.impact}
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-300">
                      <strong>Suggested Follow-up:</strong> {r.suggestedFollowUp}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 6. OPEN QUESTIONS & FOLLOW-UPS */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
                Unresolved Questions
              </h4>
              {openQuestions.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No unresolved questions.</p>
              ) : (
                <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-700 dark:text-slate-300">
                  {openQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              )}
            </div>

            {followUps.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Recommended Follow-Ups
                </h4>
                <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-700 dark:text-slate-300">
                  {followUps.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 7. ASK AI Q&A CHAT */}
        {activeTab === 'ask' && (
          <div className="flex flex-col h-full space-y-3">
            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[330px]">
              {messages.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                  <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-medium">Ask any question about this meeting transcript</p>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    "What was decided regarding the lakehouse architecture?", "Who owns the VAD worker?"
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl text-xs ${
                      m.sender === 'user'
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 ml-8 text-right'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mr-8 text-left'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                    <span className="text-[9px] text-slate-400 mt-1 block">{m.timestamp}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAskQuestion} className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <input
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="Ask a question about the meeting transcript..."
                className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isAsking || !questionInput.trim()}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>Ask</span>
              </button>
            </form>
          </div>
        )}

        {/* 8. EXPORT TAB */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Export Meeting Intelligence
            </h3>
            <p className="text-xs text-slate-500">
              Export complete formatted markdown notes (compatible with Notion, Obsidian, and Word) or raw JSON data.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyNotes}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800 flex flex-col items-start gap-2 text-left transition-all"
              >
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  {copiedNote ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {copiedNote ? 'Copied to Clipboard!' : 'Copy Notion Markdown'}
                  </h4>
                  <p className="text-[11px] text-slate-500">Includes timestamps, decisions, and tasks</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDownloadFile(
                    generateMarkdownExport(),
                    `${analysis.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.md`,
                    'text/markdown'
                  )
                }
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800 flex flex-col items-start gap-2 text-left transition-all"
              >
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Download .MD File
                  </h4>
                  <p className="text-[11px] text-slate-500">Ready to paste into Notion</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>AI Engine: <strong className="text-indigo-600 dark:text-indigo-400">{engineConfig.engineType === 'gemini' ? 'Gemini 3.6 Flash (Post-Meeting Reasoning)' : engineConfig.engineType === 'local-fast' ? 'Local Fast Offline' : 'Local Ollama'}</strong></span>
        <span>Notion AI Architecture</span>
      </div>
    </div>
  );
};
