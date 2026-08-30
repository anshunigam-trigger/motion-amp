/**
 * IntensityChart — SVG line chart for motion intensity over time.
 *
 * Props:
 *   data — array of numbers (motion intensity per frame pair)
 *   fps  — frames per second (for time axis labeling)
 */
export default function IntensityChart({ data, fps = 30 }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
        No intensity data available
      </div>
    );
  }

  const W = 700;
  const H = 160;
  const padL = 45;
  const padR = 10;
  const padT = 10;
  const padB = 25;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;

  const toX = (i) => padL + (i / (data.length - 1)) * chartW;
  const toY = (v) => padT + chartH - ((v - min) / range) * chartH;

  /* Main line points */
  const points = data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

  /* Gradient fill points (close the polygon at the bottom) */
  const fillPoints = `${toX(0)},${padT + chartH} ${points} ${toX(data.length - 1)},${padT + chartH}`;

  /* Mean line y */
  const meanY = toY(mean);

  /* Grid lines (4 horizontal) */
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    y: padT + (1 - f) * chartH,
    label: (min + f * range).toFixed(1),
  }));

  /* X-axis labels (every ~20% of duration) */
  const xLabels = [];
  const totalSec = data.length / fps;
  for (let i = 0; i <= 4; i++) {
    const t = (i / 4) * totalSec;
    const idx = Math.round((i / 4) * (data.length - 1));
    xLabels.push({ x: toX(idx), label: `${t.toFixed(1)}s` });
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 160 }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="intensityFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8741A" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#E8741A" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridLines.map(({ y, label }, i) => (
        <g key={i}>
          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={padL - 6} y={y + 3} fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="'DM Mono', monospace" textAnchor="end">
            {label}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xLabels.map(({ x, label }, i) => (
        <text key={i} x={x} y={H - 4} fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="'DM Mono', monospace" textAnchor="middle">
          {label}
        </text>
      ))}

      {/* Gradient fill */}
      <polygon points={fillPoints} fill="url(#intensityFill)" />

      {/* Main line */}
      <polyline
        points={points}
        fill="none"
        stroke="#E8741A"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Mean line */}
      <line
        x1={padL} y1={meanY} x2={W - padR} y2={meanY}
        stroke="#2E7D52" strokeWidth="1" strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
      />
      <text x={W - padR - 2} y={meanY - 4} fill="#2E7D52" fontSize="8" fontFamily="'DM Mono', monospace" textAnchor="end" opacity="0.7">
        MEAN
      </text>
    </svg>
  );
}
