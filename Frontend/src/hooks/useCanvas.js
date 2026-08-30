import { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════
   useWaveCanvas — animated sine-wave on a <canvas>
   ═══════════════════════════════════════════════════════ */
export function useWaveCanvas(active = true, opts = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !active) return;

    const ctx = canvas.getContext('2d');
    let t = 0;
    let rafId;

    const {
      amplitude = 10,
      speed = 0.06,
      color = '#E8741A',
      shadow = false,
    } = opts;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';

      if (shadow) {
        ctx.shadowColor = 'rgba(232,116,26,0.4)';
        ctx.shadowBlur = 4;
      }

      for (let x = 0; x < canvas.width; x++) {
        const phase = (x / canvas.width) * Math.PI * 8 + t;
        const amp = amplitude + (shadow ? Math.sin(t * 0.4) * 4 : 0);
        const y = canvas.height / 2 + Math.sin(phase) * amp * 0.7 + Math.sin(phase * 1.8) * amp * 0.3;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }

      ctx.stroke();
      if (shadow) ctx.shadowBlur = 0;
      t += speed;
      rafId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [active, opts]);

  return ref;
}

/* ═══════════════════════════════════════════════════════
   useProgressBar — bounces a percentage 0↔100
   ═══════════════════════════════════════════════════════ */
export function useProgressBar(active = true) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    let pct = 0;
    let dir = 1;

    const id = setInterval(() => {
      pct += dir * 0.6;
      if (pct >= 100) { pct = 100; dir = -1; }
      if (pct <= 0)   { pct = 0;   dir = 1; }
      el.style.width = pct + '%';
    }, 50);

    return () => clearInterval(id);
  }, [active]);

  return ref;
}
