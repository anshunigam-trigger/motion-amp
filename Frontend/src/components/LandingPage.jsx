import { useMemo } from 'react';
import Navbar from './Navbar';
import Logo from './Logo';
import { useWaveCanvas, useProgressBar } from '../hooks/useCanvas';

/* ── Tower SVGs ── */
function StaticTower() {
  return (
    <svg viewBox="0 0 120 180" className="tower-svg">
      <line x1="60" y1="10" x2="20" y2="160" stroke="#8fa3b8" strokeWidth="2" />
      <line x1="60" y1="10" x2="100" y2="160" stroke="#8fa3b8" strokeWidth="2" />
      <line x1="30" y1="60" x2="90" y2="60" stroke="#8fa3b8" strokeWidth="1.5" />
      <line x1="25" y1="100" x2="95" y2="100" stroke="#8fa3b8" strokeWidth="1.5" />
      <line x1="20" y1="140" x2="100" y2="140" stroke="#8fa3b8" strokeWidth="1.5" />
      <line x1="20" y1="160" x2="100" y2="160" stroke="#8fa3b8" strokeWidth="2" />
    </svg>
  );
}

function AmpTower() {
  return (
    <svg viewBox="0 0 120 180" className="tower-svg amp-tower">
      <line x1="60" y1="10" x2="20" y2="160" stroke="#E8741A" strokeWidth="2.5" />
      <line x1="60" y1="10" x2="100" y2="160" stroke="#E8741A" strokeWidth="2.5" />
      <line x1="30" y1="60" x2="90" y2="60" stroke="#f0a050" strokeWidth="1.5" />
      <line x1="25" y1="100" x2="95" y2="100" stroke="#2E7D52" strokeWidth="1.5" />
      <line x1="20" y1="140" x2="100" y2="140" stroke="#3B5EA6" strokeWidth="1.5" />
      <line x1="20" y1="160" x2="100" y2="160" stroke="#2E7D52" strokeWidth="2" />
    </svg>
  );
}

/* ── Step card ── */
function StepCard({ iconClass, label, title, body, icon }) {
  return (
    <div className="step-card">
      <div className={`step-icon ${iconClass}`}>{icon}</div>
      <div className="step-label">{label}</div>
      <h3 className="step-title">{title}</h3>
      <p className="step-body">{body}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   LANDING PAGE
   ═══════════════════════════════════════════════════════ */
export default function LandingPage({ onNavigate }) {
  const waveOpts = useMemo(() => ({ amplitude: 10, speed: 0.06 }), []);
  const waveRef = useWaveCanvas(true, waveOpts);
  const progressRef = useProgressBar(true);

  return (
    <div className="page-enter">

      {/* ── NAVBAR ── */}
      <Navbar onNavigate={onNavigate}>
        <div className="nav-links">
          <a className="nav-link" href="#how-it-works">How It Works</a>
          <button className="nav-link" onClick={() => onNavigate('dashboard')}>Dashboard</button>
          <button className="nav-link" onClick={() => onNavigate('analysis')}>Analysis</button>
        </div>
        <button className="btn-primary" onClick={() => onNavigate('analysis')}>
          Start Analysis
        </button>
      </Navbar>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-tag">
            <span className="tag-dot" />
            Defence-Grade Motion Analysis
          </div>

          <h1 className="hero-heading">
            Reveal the Motion<br />
            <em>You Can't See</em>
          </h1>

          <p className="hero-body">
            Advanced video-based motion amplification reveals sub-millimetre
            vibrations invisible to the naked eye — enabling precision analysis
            of structures, machinery, and critical systems.
          </p>

          <div className="hero-actions">
            <button className="btn-primary btn-primary--lg" onClick={() => onNavigate('analysis')}>
              Analyze a Video
            </button>
            <a className="btn-ghost" href="#how-it-works">See How It Works →</a>
          </div>

          <div className="trust-bar">
            <span className="trust-item">• Computer Vision</span>
            <span className="trust-item">• Motion Amplification</span>
            <span className="trust-item">• FFT Analysis</span>
          </div>
        </div>

        {/* RIGHT — animated visual */}
        <div className="hero-right">
          <div className="hero-visual">
            <div className="visual-header">
              <span className="visual-label">ORIGINAL FOOTAGE</span>
              <span className="visual-label visual-label--orange">MOTION AMPLIFIED</span>
              <div className="freq-badge">
                <span className="freq-badge__label">DOMINANT</span>
                <span className="freq-badge__value">18.4 Hz</span>
              </div>
            </div>

            <div className="visual-stage">
              <div className="visual-panel">
                <StaticTower />
                <div className="flat-line" />
              </div>

              <div className="amp-badge">×8.4</div>

              <div className="visual-panel" style={{ position: 'relative' }}>
                <div className="tower-glow" />
                <AmpTower />
                <canvas ref={waveRef} className="wave-canvas" width={200} height={40} />
              </div>
            </div>

            <div className="visual-footer">
              <div className="progress-bar-wrap">
                <div ref={progressRef} className="progress-bar-fill" />
              </div>
              <span className="time-label">00:05 / 00:12</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="steps-section" id="how-it-works">
        <div className="section-eyebrow">PROCESS</div>
        <h2 className="section-heading">Three Steps to Insight</h2>
        <div className="steps-grid">
          <StepCard
            iconClass="step-icon--upload"
            label="STEP 01"
            title="Upload"
            body="Upload any video recording of a structure, machinery, or component. MP4, MOV, AVI supported."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            }
          />
          <StepCard
            iconClass="step-icon--analyze"
            label="STEP 02"
            title="Analyze"
            body="Our phase-based Riesz-pyramid algorithm amplifies subtle motions. Select frequency bands and regions of interest directly on the video."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            }
          />
          <StepCard
            iconClass="step-icon--discover"
            label="STEP 03"
            title="Discover"
            body="View original and amplified videos side-by-side. Identify dominant frequencies and vibration patterns with statistical confidence."
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
          />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section" id="cta">
        <div className="cta-inner">
          <div className="cta-eyebrow">READY TO BEGIN</div>
          <h2 className="cta-heading">Start Amplifying Motion Today</h2>
          <p className="cta-body">
            Upload a video and discover what's moving beneath the surface.<br />
            Real-time analysis, instant insights.
          </p>
          <button className="btn-saffron btn-saffron--lg" onClick={() => onNavigate('analysis')}>
            Analyze a Video →
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-inner">
          <Logo small onClick={() => onNavigate('landing')} />
          <span className="footer-tagline">
            Motion Amplification &amp; Vibration Analysis System — SIH 1415
          </span>
        </div>
      </footer>
    </div>
  );
}
