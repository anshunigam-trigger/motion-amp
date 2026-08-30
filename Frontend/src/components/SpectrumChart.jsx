/**
 * SpectrumChart — SVG line chart for frequency spectrum.
 *
 * Props:
 *   frequencies — array of Hz values (x-axis)
 *   amplitudes  — array of amplitude values (y-axis)
 *   peakHz      — dominant frequency to highlight
 */
export default function SpectrumChart({ frequencies, amplitudes, peakHz }) {
  if (!frequencies || !amplitudes || frequencies.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Mono', monospace" }}>
        Frequency spectrum data not available
      </div>
    );
  }

  const W = 700;
  const H = 160;
  const padL = 45;
  const padR = 14;
  const padT = 14;
  const padB = 25;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxFreq = Math.max(...frequencies);
  const maxAmp = Math.max(...amplitudes) || 1;

  const toX = (f) => padL + (f / maxFreq) * chartW;
  const toY = (a) => padT + chartH - (a / maxAmp) * chartH;

  /* Main line points */
  const points = frequencies.map((f, i) => `${toX(f)},${toY(amplitudes[i])}`).join(' ');

  /* Find peak index */
  let peakIdx = -1;
  if (peakHz != null) {
    let minDist = Infinity;
    frequencies.forEach((f, i) => {
      const d = Math.abs(f - peakHz);
      if (d < minDist) { minDist = d; peakIdx = i; }
    });
  }

  const peakX = peakIdx >= 0 ? toX(frequencies[peakIdx]) : 0;
  const peakY = peakIdx >= 0 ? toY(amplitudes[peakIdx]) : 0;

  /* Grid lines */
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => padT + (1 - f) * chartH);

  /* X-axis labels */
  const xLabels = [];
  const tickCount = Math.min(6, Math.floor(maxFreq));
  for (let i = 0; i <= tickCount; i++) {
    const hz = (i / tickCount) * maxFreq;
    xLabels.push({ x: toX(hz), label: `${hz.toFixed(0)}` });
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 160 }}
      preserveAspectRatio="none"
    >
      {/* Grid */}
      {gridLines.map((y, i) => (
        <line key={i} x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}

      {/* X-axis labels */}
      {xLabels.map(({ x, label }, i) => (
        <text key={i} x={x} y={H - 4} fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="'DM Mono', monospace" textAnchor="middle">
          {label}
        </text>
      ))}

      {/* Hz unit */}
      <text x={W - padR} y={H - 4} fill="rgba(255,255,255,0.2)" fontSize="9" fontFamily="'DM Mono', monospace" textAnchor="end">
        Hz
      </text>

      {/* Main line — muted */}
      <polyline
        points={points}
        fill="none"
        stroke="rgba(143,163,184,0.5)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Peak vertical guide line */}
      {peakIdx >= 0 && (
        <>
          <line
            x1={peakX} y1={padT} x2={peakX} y2={padT + chartH}
            stroke="#E8741A" strokeWidth="1" strokeDasharray="4 3" opacity="0.5"
            vectorEffect="non-scaling-stroke"
          />

          {/* Peak dot */}
          <circle cx={peakX} cy={peakY} r="4" fill="#E8741A" stroke="#fff" strokeWidth="1.5" />

          {/* Peak label */}
          <text
            x={peakX} y={Math.max(peakY - 8, padT + 10)}
            fill="#E8741A" fontSize="10" fontFamily="'DM Mono', monospace" fontWeight="bold" textAnchor="middle"
          >
            {peakHz?.toFixed(1)} Hz
          </text>
        </>
      )}
    </svg>
  );
}
