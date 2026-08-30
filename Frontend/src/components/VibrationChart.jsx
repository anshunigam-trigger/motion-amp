import { useEffect, useRef } from 'react';

/**
 * VibrationChart — draws a real vibration-over-time canvas chart.
 *
 * Props:
 *   data     — array of motion-intensity values (from backend)
 *   fps      — frames per second (for x-axis labelling)
 *   freqHz   — dominant frequency to mark as threshold reference
 */
export default function VibrationChart({ data, fps = 60 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.clientWidth || canvas.offsetWidth || 700;
    const H = 120;
    canvas.width = W;
    canvas.height = H;

    const N = data.length;
    const max = Math.max(...data) || 1;

    const xOf = (i) => (i / (N - 1)) * W;
    const yOf = (v) => H - 14 - (v / max) * (H - 28);

    /* Background grid lines */
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const gy = 14 + (i / 4) * (H - 28);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    /* Gradient fill under the curve */
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(232,116,26,0.25)');
    grad.addColorStop(1, 'rgba(232,116,26,0.01)');

    ctx.beginPath();
    data.forEach((v, i) => {
      i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v));
    });
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    /* Main signal line */
    ctx.beginPath();
    data.forEach((v, i) => {
      i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v));
    });
    ctx.strokeStyle = '#E8741A';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    /* Peak dot */
    const peakIdx = data.indexOf(max);
    ctx.beginPath();
    ctx.arc(xOf(peakIdx), yOf(max), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#E8741A';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* X-axis labels */
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px "DM Mono", monospace';
    ctx.textAlign = 'center';

    const totalSec = N / fps;
    const ticks = Math.min(8, N);
    for (let i = 0; i <= ticks; i++) {
      const xi = Math.round((i / ticks) * (N - 1));
      const sec = ((i / ticks) * totalSec).toFixed(1);
      ctx.fillText(`${sec}s`, xOf(xi), H - 1);
    }

    /* Mean line */
    const mean = data.reduce((a, b) => a + b, 0) / N;
    const my = yOf(mean);
    ctx.beginPath();
    ctx.moveTo(0, my);
    ctx.lineTo(W, my);
    ctx.strokeStyle = 'rgba(46,125,82,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(46,125,82,0.6)';
    ctx.font = '9px "DM Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Mean', W - 4, my - 4);
  }, [data, fps]);

  return <canvas ref={ref} className="vibration-chart" height={120} />;
}
