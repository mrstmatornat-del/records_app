import React, { useState } from 'react';
import { MeetingContext, STTLanguage } from '../types';
import { Target, CheckCircle2, ShieldAlert, Sparkles, X, Plus, Trash2 } from 'lucide-react';

interface MeetingSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: MeetingContext;
  onSaveContext: (ctx: MeetingContext) => void;
  sttLanguage: STTLanguage;
  setSttLanguage: (lang: STTLanguage) => void;
}

const DEFAULT_WATCH_OPTIONS = [
  'unresolved technical issues',
  'owners',
  'deadlines',
  'decisions',
  'risks',
  'data quality problems',
  'action items',
  'budget and costs',
];

export const MeetingSetupModal: React.FC<MeetingSetupModalProps> = ({
  isOpen,
  onClose,
  context,
  onSaveContext,
  sttLanguage,
  setSttLanguage,
}) => {
  const [title, setTitle] = useState(context.title);
  const [objective, setObjective] = useState(context.objective);
  const [expectedOutcome, setExpectedOutcome] = useState(context.expectedOutcome);
  const [watchList, setWatchList] = useState<string[]>(context.watchList || DEFAULT_WATCH_OPTIONS.slice(0, 6));
  const [newWatchItem, setNewWatchItem] = useState('');

  if (!isOpen) return null;

  const handleToggleWatch = (item: string) => {
    if (watchList.includes(item)) {
      setWatchList(watchList.filter((w) => w !== item));
    } else {
      setWatchList([...watchList, item]);
    }
  };

  const handleAddCustomWatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatchItem.trim()) return;
    if (!watchList.includes(newWatchItem.trim())) {
      setWatchList([...watchList, newWatchItem.trim()]);
    }
    setNewWatchItem('');
  };

  const handleSave = () => {
    onSaveContext({
      title: title.trim() || 'Untitled Meeting',
      objective: objective.trim() || 'Review meeting discussions and agree on action items.',
      expectedOutcome: expectedOutcome.trim() || 'Clear decisions and next steps.',
      watchList,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Meeting Intelligence Setup
              </h3>
              <p className="text-xs text-slate-500">
                Define meeting goals, expected outcomes, and focus areas for Notion-like AI notes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Meeting Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Meeting Title / Tên cuộc họp
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prudential Banca Reconciliation or Sprint Architecture Sync"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Meeting Objective */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-500" />
              Meeting Objective / Mục tiêu cuộc họp
            </label>
            <textarea
              rows={2}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Understand reconciliation issues and agree on the final architecture."
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Expected Outcome */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Expected Outcome / Kết quả mong đợi
            </label>
            <input
              type="text"
              value={expectedOutcome}
              onChange={(e) => setExpectedOutcome(e.target.value)}
              placeholder="e.g. Final sign-off on Fabric lakehouse and assign engineering owners."
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Important Things to Watch */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              Important Things to Watch / Trọng tâm AI cần giám sát
            </label>
            <p className="text-[11px] text-slate-500">
              Gemini will actively extract and highlight these topics from the meeting dialogue:
            </p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_WATCH_OPTIONS.map((item) => {
                const selected = watchList.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleToggleWatch(item)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      selected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 font-semibold'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '}
                    {item}
                  </button>
                );
              })}
            </div>

            {/* Custom watch item input */}
            <form onSubmit={handleAddCustomWatch} className="flex gap-2 pt-1">
              <input
                type="text"
                value={newWatchItem}
                onChange={(e) => setNewWatchItem(e.target.value)}
                placeholder="Add custom watch topic (e.g. data latency, SLA penalties)..."
                className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Save Meeting Goals</span>
          </button>
        </div>
      </div>
    </div>
  );
};
