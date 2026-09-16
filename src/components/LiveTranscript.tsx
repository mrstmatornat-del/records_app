import React, { useState, useRef, useEffect } from 'react';
import { TranscriptSegment, AudioSourceType } from '../types';
import { Copy, Check, Search, Trash2, Volume2, Mic, Sparkles, MessageSquare, Info, Monitor } from 'lucide-react';

interface LiveTranscriptProps {
  transcript: TranscriptSegment[];
  isRecording: boolean;
  onClear: () => void;
  audioSource?: AudioSourceType;
}

export const LiveTranscript: React.FC<LiveTranscriptProps> = ({
  transcript,
  isRecording,
  onClear,
  audioSource = 'mic',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new transcripts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const filteredSegments = transcript.filter((seg) =>
    seg.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fullText = transcript.map((s) => s.text).join(' ');
  const wordCount = fullText ? fullText.trim().split(/\s+/).length : 0;

  const handleCopy = () => {
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[480px] overflow-hidden">
      {/* Transcript Card Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                Real-Time English Speech Stream
              </h3>
              {isRecording && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Live STT
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {wordCount} words &bull; {transcript.length} speech segments
            </p>
          </div>
        </div>

        {/* Toolbar: Search, Copy, Clear */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search speech..."
              className="pl-8 pr-3 py-1 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-36 sm:w-44"
            />
          </div>

          <button
            id="copy-transcript-btn"
            type="button"
            onClick={handleCopy}
            disabled={!fullText}
            className="p-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1"
            title="Copy Full Transcript Text"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline text-xs">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            id="clear-transcript-btn"
            type="button"
            onClick={onClear}
            disabled={transcript.length === 0 || isRecording}
            className="p-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 transition-colors"
            title="Clear Live Transcript"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transcript Feed Body */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 font-sans">
        {filteredSegments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            {isRecording ? (
              <div className="space-y-3 max-w-sm">
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mx-auto animate-bounce">
                  {audioSource === 'tab' ? <Monitor className="w-6 h-6 text-purple-500" /> : <Mic className="w-6 h-6 text-indigo-500" />}
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {audioSource === 'tab' ? 'Đang thu âm luồng âm thanh Thẻ Web / Cửa sổ...' : 'Đang lắng nghe giọng nói từ Microphone...'}
                </p>
                {audioSource === 'tab' ? (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800 text-[11.5px] text-purple-900 dark:text-purple-200 text-left space-y-1">
                    <p className="font-semibold flex items-center gap-1 text-purple-950 dark:text-white">
                      <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" /> Cơ chế thu âm Thẻ Web (Browser Tab):
                    </p>
                    <p className="text-purple-800 dark:text-purple-300">
                      Chrome khoá API nhận diện trực tiếp vào Microphone. Luồng âm thanh Tab/YouTube/Meet của bạn đang được <strong>MediaRecorder ghi lại trực tiếp sắc nét 100%</strong>.
                    </p>
                    <p className="text-purple-900 dark:text-purple-200 font-medium">
                      👉 Khi nhấn <span className="text-red-600 font-bold">STOP Recording</span>, Gemini AI sẽ tự động phân tích file thu âm này và tạo bản ghi chữ (Transcript) hoàn chỉnh!
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Hãy nói vào micro để thấy chữ xuất hiện thời gian thực (real-time stream).
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Volume2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Chưa có dữ liệu ghi âm
                </p>
                <p className="text-xs text-slate-500 max-w-xs">
                  Bấm <span className="font-semibold text-emerald-600 dark:text-emerald-400">START Streaming Audio</span> để bắt đầu thu âm từ Mic hoặc Thẻ web.
                </p>
              </div>
            )}
          </div>
        ) : (
          filteredSegments.map((seg) => (
            <div
              key={seg.id}
              className={`p-3 rounded-xl transition-all border ${
                seg.isFinal
                  ? 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  : 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200/60 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200 animate-pulse'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    {seg.speaker || 'Speaker'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {formatTimestamp(seg.timestamp)}
                  </span>
                </div>
                {!seg.isFinal && (
                  <span className="text-[10px] font-semibold text-indigo-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 animate-spin" /> Live streaming
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {seg.text}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Transcript Footer Info */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>Language: <strong className="text-slate-700 dark:text-slate-300">English (en-US)</strong></span>
        <span>Mode: <strong className="text-indigo-600 dark:text-indigo-400">Browser Audio Stream</strong></span>
      </div>
    </div>
  );
};
