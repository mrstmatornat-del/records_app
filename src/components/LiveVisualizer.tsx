import React, { useEffect, useRef } from 'react';
import { AudioCaptureService } from '../services/AudioCaptureService';

interface LiveVisualizerProps {
  isRecording: boolean;
  audioCaptureRef?: React.RefObject<AudioCaptureService | null>;
  audioManagerRef?: React.RefObject<any>; // For backward compatibility
}

export const LiveVisualizer: React.FC<LiveVisualizerProps> = ({ isRecording, audioCaptureRef, audioManagerRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const frequencyData = new Uint8Array(32);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      if (isRecording) {
        if (audioCaptureRef?.current) {
          // Check system frequency first, then microphone
          audioCaptureRef.current.getFrequencyData('system', frequencyData);
          let sum = 0;
          for (let i = 0; i < 32; i++) sum += frequencyData[i];
          if (sum === 0) {
            audioCaptureRef.current.getFrequencyData('microphone', frequencyData);
          }
        } else if (audioManagerRef?.current) {
          audioManagerRef.current.getFrequencyData(frequencyData);
        }
      } else {
        // Idle ambient wave state
        const time = Date.now() * 0.003;
        for (let i = 0; i < 32; i++) {
          frequencyData[i] = Math.max(10, Math.sin(time + i * 0.2) * 25 + 25);
        }
      }

      const barWidth = (width / 32) - 2;
      for (let i = 0; i < 32; i++) {
        const value = frequencyData[i];
        const percent = value / 255;
        const barHeight = Math.max(4, percent * (height - 8));

        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        // Gradient styling: Emerald -> Indigo -> Purple
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isRecording) {
          gradient.addColorStop(0, '#10b981'); // Emerald 500
          gradient.addColorStop(0.5, '#6366f1'); // Indigo 500
          gradient.addColorStop(1, '#a855f7'); // Purple 500
        } else {
          gradient.addColorStop(0, '#94a3b8');
          gradient.addColorStop(1, '#cbd5e1');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(x, y, barWidth, barHeight, 3);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isRecording, audioCaptureRef, audioManagerRef]);

  return (
    <div className="w-full h-12 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-1.5 flex items-center justify-center border border-slate-200/80 dark:border-slate-800">
      <canvas
        ref={canvasRef}
        width={380}
        height={40}
        className="w-full h-full object-contain"
      />
    </div>
  );
};
