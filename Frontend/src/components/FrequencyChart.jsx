import { useEffect, useRef } from 'react';

/**
 * FrequencyChart — canvas-based frequency spectrum bar chart.
 *
 * Takes the same intensity_series data and computes a simple FFT-like
 * magnitude display. The detected dominant peak is highlighted in orange
 * and a dashed noise-floor line is drawn.
 *
 * Props:
 *   data      — array of time-domain motion-intensity values
 *   fps       — frames per second (for x-axis Hz labelling)
 *   peakHz    — dominant frequency to highlight
 */
export default function FrequencyChart({ data, fps = 60, peakHz }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data || data.length < 4) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.clientWidth || canvas.offsetWidth || 700;
    const H = 160;
    canvas.width = W;
    canvas.height = H;

    const N = data.length;

    /* ── Compute magnitude spectrum (DFT magnitudes) ── */
    const halfN = Math.floor(N / 2);
    const magnitudes = [];

    for (let k = 1; k <= halfN; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        re += data[n] * Math.cos(angle);
        im -= data[n] * Math.sin(angle);
      }
      magnitudes.push(Math.sqrt(re * re + im * im) / N);
    }

    const maxMag = Math.max(...magnitudes) || 1;
    const freqRes = fps / N; // Hz per bin

    /* ── Chart layout ── */
    const padLeft = 40;
    const padRight = 16;
    const padTop = 16;
    const padBot = 28;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBot;

    /* ── Background grid lines ── */
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const gy = padTop + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, gy);
      ctx.lineTo(W - padRight, gy);
      ctx.stroke();
    }

    /* ── Draw bars ── */
    const maxBins = Math.min(magnitudes.length, Math.floor(fps / 2 / freqRes));
    const barW = Math.max(1, (chartW / maxBins) - 1);

    /* Determine peak bin index */
    let peakBin = -1;
    if (peakHz) {
      peakBin = Math.round(peakHz / freqRes) - 1;
    }

    /* Noise floor: mean of magnitudes excluding ±2 bins around peak */
    let noiseSum = 0, noiseCount = 0;
    for (let i = 0; i < maxBins; i++) {
      if (peakBin >= 0 && Math.abs(i - peakBin) <= 2) continue;
      noiseSum += magnitudes[i];
      noiseCount++;
    }
    const noiseFloor = noiseCount > 0 ? noiseSum / noiseCount : 0;

    for (let i = 0; i < maxBins; i++) {
      const mag = magnitudes[i];
      const h = (mag / maxMag) * chartH;
      const x = padLeft + (i / maxBins) * chartW;
      const y = padTop + chartH - h;

      const isPeak = peakBin >= 0 && Math.abs(i - peakBin) <= 1;

      if (isPeak) {
        const grad = ctx.createLinearGradient(x, y, x, padTop + chartH);
        grad.addColorStop(0, 'rgba(232,116,26,0.9)');
        grad.addColorStop(1, 'rgba(232,116,26,0.2)');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = 'rgba(143,163,184,0.35)';
      }

      ctx.fillRect(x, y, barW, h);
    }

    /* ── Peak label ── */
    if (peakBin >= 0 && peakBin < maxBins) {
      const px = padLeft + (peakBin / maxBins) * chartW + barW / 2;
      const peakMag = magnitudes[peakBin] || 0;
      const py = padTop + chartH - (peakMag / maxMag) * chartH - 8;

      ctx.fillStyle = '#E8741A';
      ctx.font = 'bold 10px "DM Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${peakHz?.toFixed(1)} Hz`, px, Math.max(py, padTop + 10));

      /* Peak dot */
      ctx.beginPath();
      ctx.arc(px, padTop + chartH - (peakMag / maxMag) * chartH, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#E8741A';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    /* ── Noise floor line ── */
    if (noiseFloor > 0) {
      const nfY = padTop + chartH - (noiseFloor / maxMag) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, nfY);
      ctx.lineTo(W - padRight, nfY);
      ctx.strokeStyle = 'rgba(220,53,69,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(220,53,69,0.6)';
      ctx.font = '9px "DM Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('Noise Floor', W - padRight - 4, nfY - 4);
    }

    /* ── X-axis labels ── */
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px "DM Mono", monospace';
    ctx.textAlign = 'center';

    const maxHz = maxBins * freqRes;
    const tickCount = Math.min(8, maxBins);
    for (let i = 0; i <= tickCount; i++) {
      const hz = (i / tickCount) * maxHz;
      const tx = padLeft + (i / tickCount) * chartW;
      ctx.fillText(`${hz.toFixed(0)}`, tx, H - 4);
    }

    /* Hz unit label */
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '9px "DM Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Hz', W - padRight, H - 4);

    /* ── Y-axis labels ── */
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '9px "DM Mono", monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = ((4 - i) / 4 * 100).toFixed(0);
      const gy = padTop + (i / 4) * chartH;
      ctx.fillText(`${val}%`, padLeft - 6, gy + 3);
    }

  }, [data, fps, peakHz]);

  return <canvas ref={ref} className="frequency-chart" height={160} />;
}
