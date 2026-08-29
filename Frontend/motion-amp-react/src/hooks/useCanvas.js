import { useEffect, useRef } from 'react';

/**
 * useWaveCanvas — animates a sine-wave on a <canvas>
 */
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
        const phase =
          (x / canvas.width) * Math.PI * 8 + t;

        const amp =
          amplitude +
          (shadow ? Math.sin(t * 0.4) * 4 : 0);

        const y =
          canvas.height / 2 +
          Math.sin(phase) * amp * 0.7 +
          Math.sin(phase * 1.8) * amp * 0.3;

        x === 0
          ? ctx.moveTo(x, y)
          : ctx.lineTo(x, y);
      }

      ctx.stroke();

      if (shadow) {
        ctx.shadowBlur = 0;
      }

      t += speed;
      rafId = requestAnimationFrame(draw);
    }

    draw();

    return () => cancelAnimationFrame(rafId);
  }, [active, opts]);

  return ref;
}

/**
 * useProgressBar — bounces a percentage 0↔100
 */
export function useProgressBar(active = true) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;

    if (!el || !active) return;

    let pct = 0;
    let dir = 1;

    const id = setInterval(() => {
      pct += dir * 0.6;

      if (pct >= 100) {
        pct = 100;
        dir = -1;
      }

      if (pct <= 0) {
        pct = 0;
        dir = 1;
      }

      el.style.width = pct + '%';
    }, 50);

    return () => clearInterval(id);
  }, [active]);

  return ref;
}

/**
 * useVibrationChart — draws the vibration-over-time canvas chart
 */
export function useVibrationChart() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const W =
      canvas.clientWidth ||
      canvas.offsetWidth ||
      700;

    const H = 90;

    canvas.width = W;
    canvas.height = H;

    const N = 120;

    const data = generateVibrationData(N);
    const base = generateBaselineData(N);

    const max = Math.max(...data);

    const xOf = (i) =>
      (i / (N - 1)) * W;

    const yOf = (v) =>
      H - 10 - (v / max) * (H - 20);

    /* Baseline fill */
    ctx.beginPath();

    base.forEach((v, i) =>
      i === 0
        ? ctx.moveTo(xOf(i), yOf(v))
        : ctx.lineTo(xOf(i), yOf(v))
    );

    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();

    ctx.fillStyle = 'rgba(46,125,82,0.07)';
    ctx.fill();

    /* Baseline line */
    ctx.beginPath();

    base.forEach((v, i) =>
      i === 0
        ? ctx.moveTo(xOf(i), yOf(v))
        : ctx.lineTo(xOf(i), yOf(v))
    );

    ctx.strokeStyle = 'rgba(46,125,82,0.5)';
    ctx.lineWidth = 1.5;

    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    /* Detection fill */
    const grad =
      ctx.createLinearGradient(
        0,
        0,
        0,
        H
      );

    grad.addColorStop(
      0,
      'rgba(232,116,26,0.25)'
    );

    grad.addColorStop(
      1,
      'rgba(232,116,26,0.01)'
    );

    ctx.beginPath();

    data.forEach((v, i) =>
      i === 0
        ? ctx.moveTo(xOf(i), yOf(v))
        : ctx.lineTo(xOf(i), yOf(v))
    );

    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();

    /* Detection line */
    ctx.beginPath();

    data.forEach((v, i) =>
      i === 0
        ? ctx.moveTo(xOf(i), yOf(v))
        : ctx.lineTo(xOf(i), yOf(v))
    );

    ctx.strokeStyle = '#E8741A';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    /* Peak dot */
    const peakIdx = data.indexOf(max);

    ctx.beginPath();

    ctx.arc(
      xOf(peakIdx),
      yOf(max),
      4,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = '#E8741A';
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    /* X-axis labels */
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '10px DM Mono, monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i <= 6; i++) {
      const xi =
        Math.round(
          (i / 6) * (N - 1)
        );

      const sec =
        ((i / 6) * 12).toFixed(0);

      ctx.fillText(
        `${sec}s`,
        xOf(xi),
        H - 1
      );
    }

    /* Threshold line */
    const ty = yOf(max * 0.35);

    ctx.beginPath();
    ctx.moveTo(0, ty);
    ctx.lineTo(W, ty);

    ctx.strokeStyle =
      'rgba(201,87,26,0.3)';

    ctx.lineWidth = 1;

    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle =
      'rgba(201,87,26,0.6)';

    ctx.font =
      '9px DM Mono, monospace';

    ctx.textAlign = 'right';

    ctx.fillText(
      'Threshold',
      W - 4,
      ty - 3
    );
  }, []);

  return ref;
}

/**
 * useROICanvas — interactive region-of-interest canvas
 *
 * Returns:
 *   canvasRef → attach to <canvas>
 *   getROI()  → returns current ROI coordinates
 */
export function useROICanvas() {
  const ref = useRef(null);
  const roiRef = useRef(null);

  useEffect(() => {
    const canvas = ref.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const W =
      canvas.clientWidth || 590;

    const H =
      canvas.clientHeight || 280;

    canvas.width = W;
    canvas.height = H;

    let roi = {
      x: W * 0.28,
      y: H * 0.18,
      w: W * 0.44,
      h: H * 0.64,
    };

    roiRef.current = roi;

    let dragging = null;

    const HANDLE_R = 7;

    const handles = () => [
      {
        id: 'tl',
        x: roi.x,
        y: roi.y,
      },
      {
        id: 'tr',
        x: roi.x + roi.w,
        y: roi.y,
      },
      {
        id: 'bl',
        x: roi.x,
        y: roi.y + roi.h,
      },
      {
        id: 'br',
        x: roi.x + roi.w,
        y: roi.y + roi.h,
      },
    ];

    function draw() {
      /* Grid background */
      ctx.fillStyle = '#1A2B3C';
      ctx.fillRect(
        0,
        0,
        W,
        H
      );

      ctx.strokeStyle =
        'rgba(255,255,255,0.06)';

      ctx.lineWidth = 1;

      for (
        let x = 0;
        x < W;
        x += 24
      ) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      for (
        let y = 0;
        y < H;
        y += 24
      ) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      /* Dark overlay outside ROI */
      ctx.fillStyle =
        'rgba(0,0,0,0.42)';

      ctx.fillRect(
        0,
        0,
        W,
        roi.y
      );

      ctx.fillRect(
        0,
        roi.y,
        roi.x,
        roi.h
      );

      ctx.fillRect(
        roi.x + roi.w,
        roi.y,
        W - roi.x - roi.w,
        roi.h
      );

      ctx.fillRect(
        0,
        roi.y + roi.h,
        W,
        H - roi.y - roi.h
      );

      /* ROI border */
      ctx.strokeStyle = '#E8741A';
      ctx.lineWidth = 1.5;

      ctx.strokeRect(
        roi.x,
        roi.y,
        roi.w,
        roi.h
      );

      /* ROI label */
      ctx.fillStyle =
        'rgba(232,116,26,0.85)';

      ctx.fillRect(
        roi.x,
        roi.y - 18,
        72,
        18
      );

      ctx.fillStyle = '#fff';
      ctx.font =
        '9px DM Mono, monospace';

      ctx.fillText(
        'ROI ACTIVE',
        roi.x + 6,
        roi.y - 6
      );

      /* Corner handles */
      handles().forEach((h) => {
        ctx.beginPath();

        ctx.arc(
          h.x,
          h.y,
          HANDLE_R,
          0,
          Math.PI * 2
        );

        ctx.fillStyle = '#E8741A';
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    const getHandle = (mx, my) =>
      handles().find(
        (h) =>
          Math.hypot(
            h.x - mx,
            h.y - my
          ) <
          HANDLE_R + 4
      );

    const pos = (e) => {
      const r =
        canvas.getBoundingClientRect();

      const t =
        e.touches
          ? e.touches[0]
          : e;

      return {
        x:
          t.clientX - r.left,
        y:
          t.clientY - r.top,
      };
    };

    const onDown = (e) => {
      const { x, y } = pos(e);

      const h =
        getHandle(x, y);

      if (h) {
        dragging = h.id;
      }
    };

    const onMove = (e) => {
      const { x, y } = pos(e);

      if (!dragging) {
        canvas.style.cursor =
          getHandle(x, y)
            ? 'pointer'
            : 'crosshair';

        return;
      }

      const min = 40;

      if (dragging === 'tl') {
        const nx = Math.min(
          x,
          roi.x + roi.w - min
        );

        const ny = Math.min(
          y,
          roi.y + roi.h - min
        );

        roi.w +=
          roi.x - nx;

        roi.h +=
          roi.y - ny;

        roi.x = nx;
        roi.y = ny;

      } else if (
        dragging === 'tr'
      ) {
        roi.w = Math.max(
          min,
          x - roi.x
        );

        const ny = Math.min(
          y,
          roi.y + roi.h - min
        );

        roi.h +=
          roi.y - ny;

        roi.y = ny;

      } else if (
        dragging === 'bl'
      ) {
        const nx = Math.min(
          x,
          roi.x + roi.w - min
        );

        roi.w +=
          roi.x - nx;

        roi.x = nx;

        roi.h = Math.max(
          min,
          y - roi.y
        );

      } else if (
        dragging === 'br'
      ) {
        roi.w = Math.max(
          min,
          x - roi.x
        );

        roi.h = Math.max(
          min,
          y - roi.y
        );
      }

      roiRef.current = {
        ...roi,
      };

      draw();
    };

    const onUp = () => {
      dragging = null;
    };

    canvas.addEventListener(
      'mousedown',
      onDown
    );

    canvas.addEventListener(
      'mousemove',
      onMove
    );

    canvas.addEventListener(
      'mouseup',
      onUp
    );

    canvas.addEventListener(
      'mouseleave',
      onUp
    );

    draw();

    return () => {
      canvas.removeEventListener(
        'mousedown',
        onDown
      );

      canvas.removeEventListener(
        'mousemove',
        onMove
      );

      canvas.removeEventListener(
        'mouseup',
        onUp
      );

      canvas.removeEventListener(
        'mouseleave',
        onUp
      );
    };
  }, []);

  return {
    canvasRef: ref,

    getROI: () =>
      roiRef.current,
  };
}

/* ── Data generators ── */

function generateVibrationData(n) {
  const d = [];

  for (let i = 0; i < n; i++) {
    const t = i / n;

    const base =
      20 +
      Math.sin(
        t * Math.PI * 12
      ) * 28;

    const spike =
      i > 38 && i < 82
        ? Math.sin(
            (t - 0.32) *
              Math.PI *
              18
          ) *
            38 +
          10
        : 5;

    const noise =
      (Math.random() - 0.5) *
      6;

    d.push(
      Math.max(
        0,
        base + spike + noise
      )
    );
  }

  return d;
}

function generateBaselineData(n) {
  return Array.from(
    { length: n },
    () =>
      8 +
      (Math.random() - 0.5) * 4
  );
}