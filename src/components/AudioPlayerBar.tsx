import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, FastForward } from 'lucide-react';

interface AudioPlayerBarProps {
  audioUrl?: string;
  durationSeconds: number;
  seekTimestamp?: number; // When updated, jump player to this second
  onTimeUpdate?: (currentTimeSec: number) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  audioUrl,
  durationSeconds,
  seekTimestamp,
  onTimeUpdate,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Jump to timestamp when seekTimestamp changes
  useEffect(() => {
    if (seekTimestamp !== undefined && seekTimestamp >= 0 && audioRef.current) {
      audioRef.current.currentTime = seekTimestamp;
      setCurrentTime(seekTimestamp);
      if (!isPlaying) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  }, [seekTimestamp]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
    setCurrentTime(val);
    if (onTimeUpdate) onTimeUpdate(val);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!audioUrl) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => {
          if (audioRef.current) {
            const cur = audioRef.current.currentTime;
            setCurrentTime(cur);
            if (onTimeUpdate) onTimeUpdate(cur);
          }
        }}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center gap-3 w-full sm:w-auto">
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 transition-all shrink-0"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        <div className="min-w-0">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Meeting Audio Playback</span>
          </h4>
          <span className="text-[11px] font-mono text-slate-500">
            {formatTime(currentTime)} / {formatTime(durationSeconds || 0)}
          </span>
        </div>
      </div>

      {/* Progress Seeker */}
      <div className="flex items-center gap-3 w-full sm:flex-1 max-w-xl">
        <input
          type="range"
          min={0}
          max={Math.max(durationSeconds, 1)}
          step={0.1}
          value={currentTime}
          onChange={handleSliderChange}
          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
      </div>

      <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
        <span>Click any timestamp in notes to seek</span>
      </div>
    </div>
  );
};
