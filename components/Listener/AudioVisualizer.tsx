import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  variant?: 'default' | 'nigerian' | 'strand' | 'sides';
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyser, isActive, variant = 'default' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser ? analyser.frequencyBinCount : 128; // Default buffer if null
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      if (analyser && isActive) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Resting state: Populate with low random values (10-30 range) to show activity
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = 10 + Math.random() * 15;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (variant === 'sides') {
        const barCount = 12;
        const barWidth = 2; // Thin strand
        // Dynamic spacing to center the strands
        const totalBarWidth = barCount * barWidth;
        const remainingSpace = canvas.width - totalBarWidth;
        const spacing = remainingSpace / (barCount + 1);

        for (let i = 0; i < barCount; i++) {
          const index = Math.floor((i / barCount) * (bufferLength / 2));
          // Boost sensitivity for more reaction
          const barHeight = (dataArray[index] / 200) * canvas.height * 0.95;
          const y = (canvas.height - barHeight) / 2;
          const x = spacing + (i * (barWidth + spacing));

          ctx.fillStyle = '#FFFFFF';
          ctx.shadowBlur = 4;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath();
          // Compatibility check for roundRect
          if ((ctx as any).roundRect) {
            (ctx as any).roundRect(x, y, barWidth, barHeight, 2);
          } else {
            ctx.rect(x, y, barWidth, barHeight);
          }
          ctx.fill();
        }
      } else {
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          ctx.fillStyle = variant === 'nigerian' ? (i % 3 === 0 ? '#008751' : '#ffffff') : '#008751';
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      }
    };

    draw();
    return () => cancelAnimationFrame(animationRef.current);
  }, [analyser, isActive, variant]);

  return <canvas ref={canvasRef} width={variant === 'sides' ? 120 : 400} height={variant === 'sides' ? 100 : 240} className="w-full h-full" />;
};

export default AudioVisualizer;