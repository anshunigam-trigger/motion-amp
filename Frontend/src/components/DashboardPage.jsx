import { useState, useEffect, useMemo } from 'react';
import Navbar from './Navbar';
import Logo from './Logo';
import { getJobs } from '../api/client';

/* ── Waveform icon for job rows ── */
function WaveIcon({ detected }) {
  const color = detected ? '#E8741A' : '#9CA3AF';
  return (
    <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
      <path
        d="M1 10 L5 4 L9 16 L13 6 L17 14 L21 8 L25 12 L29 10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Empty State ── */
function EmptyState({ onNavigate }) {
  return (
    <div className="dash-empty">
      <div className="dash-empty__icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1CFCA" strokeWidth="1.5" strokeLinecap="round">
          <rect x="2" y="2" width="20" height="20" rx="3" />
          <path d="M2 12 L6 6 L10 16 L14 4 L18 14 L22 8" />
        </svg>
      </div>
      <h3 className="dash-empty__title">No analyses yet</h3>
      <p className="dash-empty__text">Upload a video to reveal invisible vibrations.</p>
      <button className="btn-primary btn-primary--lg" onClick={() => onNavigate('analysis')}>
        Start Your First Analysis
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════ */
export default function DashboardPage({ onNavigate }) {
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all'); // all | detected | clean

  /* ── Fetch jobs with real-time live polling ── */
  useEffect(() => {
    let cancelled = false;

    const fetchJobs = async (isInitial = false) => {
      try {
        if (isInitial) setLoading(true);
        const data = await getJobs();
        if (!cancelled) setJobs(data.jobs || []);
      } catch {
        /* silently fail — will show empty state */
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    };

    fetchJobs(true);

    const intervalId = setInterval(() => {
      fetchJobs(false);
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  /* ── Derived stats ── */
  const stats = useMemo(() => {
    const total = jobs.length;
    const detected = jobs.filter(j => j.flag === 'periodic_vibration_detected').length;
    const clean = jobs.filter(j => j.flag === 'no_vibration_detected').length;
    return { total, detected, clean };
  }, [jobs]);

  /* ── Filtered + searched jobs ── */
  const filtered = useMemo(() => {
    let list = jobs;

    if (filter === 'detected') {
      list = list.filter(j => j.flag === 'periodic_vibration_detected');
    } else if (filter === 'clean') {
      list = list.filter(j => j.flag === 'no_vibration_detected');
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(j =>
        (j.filename || '').toLowerCase().includes(q) ||
        (j.job_id || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [jobs, filter, search]);

  /* ── Format timestamp to local real time ── */
  const fmtDate = (ts) => {
    if (!ts) return '—';
    try {
      let isoStr = String(ts);
      if (!isoStr.includes('T') && !isoStr.endsWith('Z')) {
        isoStr = isoStr.replace(' ', 'T') + 'Z';
      }
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      }) + ' · ' + d.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  return (
    <div className="page-enter">

      {/* ── NAVBAR ── */}
      <Navbar onNavigate={onNavigate}>
        <div className="nav-links">
          <button className="nav-link" onClick={() => onNavigate('landing')}>How It Works</button>
          <button className="nav-link nav-link--active" onClick={() => onNavigate('dashboard')}>Dashboard</button>
          <button className="nav-link" onClick={() => onNavigate('analysis')}>Analysis</button>
        </div>
        <button className="btn-primary" onClick={() => onNavigate('analysis')}>
          Start Analysis
        </button>
      </Navbar>

      {/* ── MAIN ── */}
      <div className="dash-page">

        {/* Page header */}
        <div className="dash-header">
          <div>
            <h1 className="dash-heading">Analysis Dashboard</h1>
            <p className="dash-subtitle">Review past scans, track results, and launch new analyses.</p>
          </div>
          <button className="btn-primary btn-primary--lg" onClick={() => onNavigate('analysis')}>
            New Analysis
          </button>
        </div>

        {/* Stat cards */}
        <div className="stat-cards">
          <div className="stat-card">
            <span className="stat-card__value">{stats.total}</span>
            <span className="stat-card__label">Total Scans</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value stat-card__value--orange">{stats.detected}</span>
            <span className="stat-card__label">Vibrations Detected</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value stat-card__value--sage">{stats.clean}</span>
            <span className="stat-card__label">Clean Results</span>
          </div>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div className="dash-loading">
            <div className="spinner spinner--light" />
          </div>
        )}

        {/* Empty state */}
        {!loading && jobs.length === 0 && (
          <EmptyState onNavigate={onNavigate} />
        )}

        {/* Job list */}
        {!loading && jobs.length > 0 && (
          <>
            {/* Search + filter */}
            <div className="dash-toolbar">
              <div className="dash-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by filename…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="dash-filter">
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All Results</option>
                  <option value="detected">Detected</option>
                  <option value="clean">Clean</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="job-table">
              <div className="job-table__head">
                <span className="job-col job-col--icon"></span>
                <span className="job-col job-col--name">Filename</span>
                <span className="job-col job-col--date">Date</span>
                <span className="job-col job-col--status">Status</span>
                <span className="job-col job-col--freq">Frequency</span>
                <span className="job-col job-col--action"></span>
              </div>
              {filtered.map((job) => {
                const isDetected = job.flag === 'periodic_vibration_detected';
                const isDone = job.status === 'done';
                const isProcessing = job.status === 'processing';

                return (
                  <div className="job-row" key={job.job_id}>
                    <span className="job-col job-col--icon">
                      <WaveIcon detected={isDetected} />
                    </span>
                    <span className="job-col job-col--name">
                      <span className="job-filename">
                        {job.filename && job.filename.toLowerCase() !== 'untitled'
                          ? job.filename
                          : `video_${(job.job_id || '').slice(0, 8)}.mp4`}
                      </span>
                      <span className="job-id">{job.job_id?.slice(0, 8)}</span>
                    </span>
                    <span className="job-col job-col--date">
                      {fmtDate(job.timestamp)}
                    </span>
                    <span className="job-col job-col--status">
                      {isDone && isDetected && (
                        <span className="pill pill--detected">
                          <span className="pill__dot" />
                          Detected
                        </span>
                      )}
                      {isDone && !isDetected && (
                        <span className="pill pill--clean">
                          No Vibration
                        </span>
                      )}
                      {isProcessing && (
                        <span className="pill pill--processing">
                          <span className="pill__dot pill__dot--spin" />
                          Processing
                        </span>
                      )}
                      {!isDone && !isProcessing && (
                        <span className="pill pill--queued">Queued</span>
                      )}
                    </span>
                    <span className="job-col job-col--freq">
                      {isDone && job.dominant_freq_hz != null ? (
                        <span className="freq-readout">
                          {Number(job.dominant_freq_hz).toFixed(2)}
                          <span className="freq-unit"> Hz</span>
                        </span>
                      ) : (
                        <span className="freq-readout freq-readout--na">—</span>
                      )}
                    </span>
                    <span className="job-col job-col--action">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* No-match message */}
            {filtered.length === 0 && (
              <div className="dash-no-match">
                <p>No results match your search.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-inner">
          <Logo small onClick={() => onNavigate('landing')} />
          <span className="footer-tagline">
            Motion Amplification &amp; Vibration Analysis System
          </span>
        </div>
      </footer>
    </div>
  );
}
