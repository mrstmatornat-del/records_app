import React, { useState, useRef, useEffect } from 'react';
import { TranscriptSegment, AudioSourceType } from '../types';
import { STTEngineStatusEvent } from '../services/stt/ISTTEngine';
import {
  Copy,
  Check,
  Search,
  Trash2,
  Volume2,
  Mic,
  Headphones,
  Sparkles,
  MessageSquare,
  Play,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface LiveTranscriptProps {
  transcript: TranscriptSegment[];
  interimSegment?: TranscriptSegment | null;
  sttStatus?: STTEngineStatusEvent | null;
  isRecording: boolean;
  onClear: () => void;
  audioSource?: AudioSourceType;
  onSeekTimestamp?: (timestampSeconds: number) => void;
  activeTimestamp?: number;
}

export const LiveTranscript: React.FC<LiveTranscriptProps> = ({
  transcript,
  interimSegment = null,
  sttStatus = null,
  isRecording,
  onClear,
  onSeekTimestamp,
  activeTimestamp = -1,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new transcripts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interimSegment]);

  // Combine canonical transcript with live interim segment for viewing
  const displaySegments = React.useMemo(() => {
    if (!interimSegment || !interimSegment.text.trim()) {
      return transcript;
    }
    return [...transcript, interimSegment];
  }, [transcript, interimSegment]);

  const filteredSegments = displaySegments.filter((seg) =>
    seg.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (seg.speaker && seg.speaker.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const fullText = transcript
    .map((s) => `[${formatTimestamp(s.startTime || s.timestamp)}] [${s.speaker || (s.source === 'microphone' ? 'Me' : 'Meeting')}]: ${s.text}`)
    .join('\n');
  const wordCount = transcript.reduce((acc, s) => acc + (s.text ? s.text.trim().split(/\s+/).length : 0), 0);

  const handleCopy = () => {
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  function formatTimestamp(sec: number) {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[520px] overflow-hidden">
      {/* Transcript Card Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                Live Dual-Source Transcript
              </h3>
              {isRecording && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Canonical Stream
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {wordCount} words &bull; {transcript.length} canonical segments &bull; [Me] vs [Meeting]
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
              placeholder="Search words..."
              className="pl-8 pr-3 py-1 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-36 sm:w-44"
            />
          </div>

          <button
            id="copy-transcript-btn"
            type="button"
            onClick={handleCopy}
            disabled={!fullText}
            className="p-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1"
            title="Copy Canonical Transcript with Timestamps"
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

      {/* Explicit 4-State Pipeline Status Banner */}
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/40 text-[11px] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* State 1: Audio Captured Successfully */}
          {isRecording ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Audio Captured (Zero-Echo Loopback)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Capture Ready</span>
            </span>
          )}

          <span>&bull;</span>

          {/* State 2, 3, 4: STT Engine Status */}
          {sttStatus?.status === 'processing' ? (
            <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>STT Processing speech utterance...</span>
            </span>
          ) : sttStatus?.status === 'unavailable' || sttStatus?.errorCode === 'SYSTEM_STT_UNAVAILABLE' ? (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold" title={sttStatus.message || ''}>
              <AlertCircle className="w-3.5 h-3.5" />
              <span>STT: SYSTEM_STT_UNAVAILABLE (Audio is recorded safely)</span>
            </span>
          ) : sttStatus?.status === 'completed' ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>STT Completed</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-slate-500">
              <span>STT Engine Ready</span>
            </span>
          )}
        </div>

        <span className="text-[10px] text-slate-400 font-mono">
          Reconciled &bull; No Duplicates
        </span>
      </div>

      {/* Transcript Feed Body */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-3 font-sans">
        {filteredSegments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            {isRecording ? (
              <div className="space-y-3 max-w-sm">
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mx-auto animate-bounce">
                  <Headphones className="w-6 h-6 text-indigo-500" />
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Listening to Meeting Audio & Microphone...
                </p>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-left text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                    <Mic className="w-3.5 h-3.5" />
                    <span>[ME] = Your voice</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-purple-600 dark:text-purple-400">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>[MEETING] = Teams / Zoom / YouTube / Browser</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1">
                    Speech is sliced via VAD and reconciled into canonical text without duplicate pollution.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Volume2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  No transcript data recorded
                </p>
                <p className="text-xs text-slate-500 max-w-xs">
                  Click <span className="font-semibold text-emerald-600 dark:text-emerald-400">START Meeting Recording</span> or test a demo session.
                </p>
              </div>
            )}
          </div>
        ) : (
          filteredSegments.map((seg) => {
            const isMe = seg.source === 'microphone' || seg.speaker === 'Me';
            const timestampVal = seg.startTime !== undefined ? seg.startTime : seg.timestamp;
            const isTimestampActive = activeTimestamp >= 0 && Math.abs(activeTimestamp - timestampVal) < 2.0;

            return (
              <div
                key={seg.id}
                className={`p-3.5 rounded-xl transition-all border ${
                  isTimestampActive
                    ? 'ring-2 ring-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-400'
                    : seg.isFinal
                    ? isMe
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200/50 dark:border-indigo-900/40 text-slate-800 dark:text-slate-200'
                      : 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200/50 dark:border-purple-900/40 text-slate-800 dark:text-slate-200'
                    : 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/60 text-amber-950 dark:text-amber-200 animate-pulse'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {/* Source Indicator Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        isMe
                          ? 'bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300'
                          : 'bg-purple-100 dark:bg-purple-900/70 text-purple-700 dark:text-purple-300'
                      }`}
                    >
                      {isMe ? <Mic className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      <span>{isMe ? 'ME' : 'MEETING'}</span>
                    </span>

                    {/* Clickable Timestamp Link */}
                    <button
                      type="button"
                      onClick={() => onSeekTimestamp && onSeekTimestamp(timestampVal)}
                      className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline flex items-center gap-0.5"
                      title="Jump audio player to this moment"
                    >
                      <Play className="w-2.5 h-2.5 fill-current opacity-60" />
                      <span>{formatTimestamp(timestampVal)}</span>
                    </button>
                  </div>

                  {!seg.isFinal && (
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 animate-spin" /> Live interim preview...
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {seg.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Transcript Footer Info */}
      <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Channel 1: <strong className="text-indigo-600 dark:text-indigo-400">[ME] Mic</strong></span>
          <span>&bull;</span>
          <span>Channel 2: <strong className="text-purple-600 dark:text-purple-400">[MEETING] Loopback</strong></span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">Canonical Stream</span>
      </div>
    </div>
  );
};
