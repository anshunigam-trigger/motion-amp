import { useState, useEffect, useRef } from 'react';
import Logo from './Logo';
import { useWaveCanvas, useVibrationChart } from '../hooks/useCanvas';

/* ── Animated count-up ── */
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf;
    const tick = now => {
      const t     = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(eased * target);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ── Results Tower (animated) ── */
function ResultTower({ className = '' }) {
  return (
    <svg viewBox="0 0 160 220" className={`demo-tower ${className}`}>
      <line x1="80" y1="14" x2="28"  y2="200" stroke="#4a6080" strokeWidth="2.5" />
      <line x1="80" y1="14" x2="132" y2="200" stroke="#4a6080" strokeWidth="2.5" />
      <line x1="42" y1="74" x2="118" y2="74"  stroke="#4a6080" strokeWidth="1.8" />
      <line x1="36" y1="124" x2="124" y2="124" stroke="#4a6080" strokeWidth="1.8" />
      <line x1="30" y1="174" x2="130" y2="174" stroke="#4a6080" strokeWidth="1.8" />
      <line x1="28" y1="200" x2="132" y2="200" stroke="#4a6080" strokeWidth="2.5" />
    </svg>
  );
}
function AmpResultTower() {
  return (
    <svg viewBox="0 0 160 220" className="demo-tower result-tower">
      <line x1="80" y1="14" x2="28"  y2="200" stroke="#E8741A" strokeWidth="2.5" />
      <line x1="80" y1="14" x2="132" y2="200" stroke="#E8741A" strokeWidth="2.5" />
      <line x1="42" y1="74" x2="118" y2="74"  stroke="#f0b060" strokeWidth="1.8" />
      <line x1="36" y1="124" x2="124" y2="124" stroke="#2E7D52" strokeWidth="1.8" />
      <line x1="30" y1="174" x2="130" y2="174" stroke="#3B5EA6" strokeWidth="1.8" />
      <line x1="28" y1="200" x2="132" y2="200" stroke="#2E7D52" strokeWidth="2.5" />
    </svg>
  );
}

/* ════════════════════════════════════════════════════════
   RESULTS PAGE
════════════════════════════════════════════════════════ */
export default function ResultsPage({ onNavigate }) {
  const freqValue    = useCountUp(18.4, 900);
  const chartRef     = useVibrationChart();
  const resultWaveRef = useWaveCanvas(true, { amplitude: 12, speed: 0.07, shadow: true });

  // Export stub
  const [exportLabel, setExportLabel] = useState('Export Report');
  const [exporting,   setExporting]   = useState(false);

  const handleExport = () => {
    if (exporting) return;
    setExporting(true);
    setExportLabel('Generating…');
    setTimeout(() => {
      setExportLabel('✓ Exported');
      setTimeout(() => { setExportLabel('Export Report'); setExporting(false); }, 2000);
    }, 1400);
  };

  return (
    <div className="results-page page-enter">

      {/* ── NAVBAR ── */}
      <nav className="navbar navbar--light">
        <div className="nav-inner">
          <Logo onClick={() => onNavigate('landing')} />
          <div className="results-nav-actions">
            <button className="btn-outline-sm" onClick={() => onNavigate('upload')}>
              New Analysis
            </button>
            <button className="btn-primary" onClick={handleExport} disabled={exporting}>
              {exportLabel}
            </button>
          </div>
        </div>
      </nav>

      <div className="results-layout">

        {/* STATUS ROW */}
        <div className="results-status-row">
          <span className="results-complete-label">Analysis Complete</span>
          <div className="vibration-status vibration-status--detected">
            <span className="status-dot" />
            VIBRATION DETECTED
          </div>
        </div>

        {/* DOMINANT FREQUENCY HERO */}
        <div className="freq-hero-section">
          <div className="freq-hero-grid">
            <div className="freq-hero-inner">
              <span className="freq-hero-label">DOMINANT FREQUENCY</span>
              <span className="freq-hero-number">{freqValue.toFixed(1)}</span>
              <span className="freq-hero-unit">Hz</span>
            </div>
            <div className="freq-meta-pills">
              <div className="freq-pill">
                <span className="pill-label">BAND</span>
                <span className="pill-value">Engine / Motor</span>
              </div>
              <div className="freq-pill">
                <span className="pill-label">CONFIDENCE</span>
                <span className="pill-value">94.2%</span>
              </div>
              <div className="freq-pill freq-pill--green">
                <span className="pill-label">STATUS</span>
                <span className="pill-value">Periodic</span>
              </div>
            </div>
          </div>
        </div>

        {/* VIDEO COMPARISON */}
        <div className="video-comparison-section">
          <div className="video-panel-wrap">

            {/* Original */}
            <div className="video-panel">
              <span className="video-panel-label">ORIGINAL FOOTAGE</span>
              <div className="video-placeholder video-placeholder--original">
                <div className="video-overlay-grid" />
                <ResultTower />
                <div className="flat-line-result" />
                <span className="video-timestamp">00:08</span>
              </div>
            </div>

            {/* Divider */}
            <div className="video-divider">
              <div className="divider-line" />
              <div className="amp-pill">×8.4</div>
              <div className="divider-line" />
            </div>

            {/* Amplified */}
            <div className="video-panel">
              <span className="video-panel-label video-panel-label--orange">MOTION AMPLIFIED</span>
              <div className="video-placeholder video-placeholder--amp">
                <div className="video-overlay-grid" />
                <div className="amp-glow-effect" />
                <AmpResultTower />
                <canvas
                  ref={resultWaveRef}
                  className="result-wave"
                  width={280}
                  height={48}
                />
                <span className="video-timestamp">00:08</span>
              </div>
            </div>
          </div>

          {/* METRICS */}
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-label">Dominant Frequency</div>
              <div className="metric-value metric-value--orange">18.4 Hz</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Vibration Intensity</div>
              <div className="metric-value">74.3 dB</div>
              <div className="metric-bar-wrap">
                <div className="metric-bar-fill" style={{ width: '74%' }} />
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Analysis Duration</div>
              <div className="metric-value">42.1 s</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Frequency Band</div>
              <div className="metric-value">10–200 Hz</div>
            </div>
          </div>
        </div>

        {/* VIBRATION CHART */}
        <div className="graph-section">
          <div className="graph-header">
            <div>
              <h3 className="graph-title">Vibration Intensity Over Time</h3>
              <p className="graph-sub">Frame-differencing + FFT — amplitude envelope</p>
            </div>
            <div className="graph-legend">
              <span className="legend-dot legend-dot--orange" />
              <span>Detected</span>
              <span className="legend-dot legend-dot--green" style={{ marginLeft: 8 }} />
              <span>Baseline</span>
            </div>
          </div>
          <canvas ref={chartRef} className="vibration-chart" height={90} />
        </div>

        {/* SUMMARY + ACTIONS */}
        <div className="summary-actions-row">
          <div className="summary-card">
            <h3 className="summary-title">Analysis Summary</h3>
            <p className="summary-body">
              Strong periodic vibration detected at <strong>18.4 Hz</strong>, consistent
              with rotating machinery in the Engine/Motor band (10–200 Hz). The amplified
              output shows clear, coherent oscillation across the upper structural zone with
              an intensity of 74.3 dB — significantly above the no-vibration threshold.
              Camera shake compensation applied; one pre-existing structural resonance
              identified at 6.2 Hz. Recommend further inspection of the identified zone.
            </p>
            <div className="summary-tags">
              <span className="tag tag--amber">Rotating Machinery</span>
              <span className="tag tag--blue">Engine Band</span>
              <span className="tag tag--green">High Confidence</span>
            </div>
          </div>

          <div className="actions-col">
            <button className="btn-primary" style={{ padding: 14, fontSize: 15, borderRadius: 12 }}
              onClick={() => onNavigate('upload')}>
              New Analysis
            </button>
            <button className="btn-outline" onClick={handleExport} disabled={exporting}>
              {exportLabel}
            </button>
            <button className="btn-ghost-sm">Download Amplified Video</button>
          </div>
        </div>

      </div>
    </div>
  );
}
