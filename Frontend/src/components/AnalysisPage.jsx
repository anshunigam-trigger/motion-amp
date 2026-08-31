import { useState, useCallback } from 'react';
import Navbar from './Navbar';
import Logo from './Logo';
import UploadStage from './UploadStage';
import ConfigureStage from './ConfigureStage';
import ProcessingStage from './ProcessingStage';
import ResultsStage from './ResultsStage';

/**
 * AnalysisPage — 4-stage state machine.
 *
 * Stages: "upload" → "configure" → "processing" → "results"
 * Also handles "error" state with a retry option.
 */
export default function AnalysisPage({ onNavigate }) {
  const [stage, setStage]   = useState('upload');
  const [jobId, setJobId]   = useState(null);
  const [file, setFile]     = useState(null);
  const [result, setResult] = useState(null);
  const [roi, setRoi]       = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [error, setError]   = useState(null);
  const [fileUrl, setFileUrl] = useState('');

  /* ── Stage transitions ── */
  const onUploaded = useCallback(({ jobId: id, file: f }) => {
    setJobId(id);
    setFile(f);
    setFileUrl(URL.createObjectURL(f));
    setStage('configure');
    setError(null);
  }, []);

  const onProcessing = useCallback(() => {
    setStage('processing');
    setError(null);
  }, []);

  const onDone = useCallback((res) => {
    setResult(res);
    setStage('results');
  }, []);

  const onFailed = useCallback((msg) => {
    setError(msg);
    setStage('error');
  }, []);

  const onConfigError = useCallback((msg) => {
    setError(msg);
    // Stay on configure stage, just show the error banner
  }, []);

  const resetAll = useCallback(() => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setStage('upload');
    setJobId(null);
    setFile(null);
    setFileUrl('');
    setResult(null);
    setRoi({ x: 0, y: 0, w: 0, h: 0 });
    setError(null);
  }, [fileUrl]);

  /* ── Shared ROI setter for ConfigureStage → ResultsStage ── */
  const handleRoiFromConfigure = useCallback((r) => setRoi(r), []);

  return (
    <div>
      {/* ── NAVBAR ── */}
      <Navbar onNavigate={onNavigate}>
        <div className="nav-links">
          <button className="nav-link" onClick={() => onNavigate('landing')}>How It Works</button>
          <button className="nav-link" onClick={() => onNavigate('dashboard')}>Dashboard</button>
          <button className="nav-link nav-link--active" onClick={() => onNavigate('analysis')}>Analysis</button>
        </div>
        <button className="btn-primary" onClick={resetAll}>
          Start Analysis
        </button>
      </Navbar>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-[1200px] mx-auto px-12 pb-16" style={{ minHeight: 'calc(100vh - 64px - 80px)' }}>

        {/* Error banner (dismissible) */}
        {error && stage !== 'error' && (
          <div
            className="flex items-center justify-between px-5 py-3 rounded-xl mt-4 mb-2 text-sm"
            style={{ background: '#FDE8EA', color: '#DC3545', border: '1px solid rgba(220,53,69,0.2)' }}
          >
            <span>{error}</span>
            <button
              className="ml-4 cursor-pointer border-none bg-transparent font-semibold"
              style={{ color: '#DC3545' }}
              onClick={() => setError(null)}
            >
              ✕
            </button>
          </div>
        )}

        {/* Stage rendering */}
        {stage === 'upload' && (
          <UploadStage onUploaded={onUploaded} />
        )}

        {stage === 'configure' && (
          <ConfigureStage
            file={file}
            videoUrl={fileUrl}
            jobId={jobId}
            onProcessing={onProcessing}
            onGoBack={resetAll}
            onError={onConfigError}
            onRoiChange={handleRoiFromConfigure}
          />
        )}

        {stage === 'processing' && (
          <ProcessingStage
            jobId={jobId}
            fileName={file?.name}
            onDone={onDone}
            onFailed={onFailed}
          />
        )}

        {stage === 'results' && result && (
          <ResultsStage
            result={result}
            roi={roi}
            file={file}
            originalUrl={fileUrl}
            onNewAnalysis={resetAll}
          />
        )}

        {/* Full error state (from failed processing) */}
        {stage === 'error' && (
          <div className="flex flex-col items-center justify-center pt-20 pb-16">
            <div
              className="flex flex-col items-center gap-4 max-w-md w-full p-12 rounded-3xl border text-center"
              style={{ background: '#fff', borderColor: '#E5E3DC' }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#DC3545" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <h2
                className="text-2xl font-semibold"
                style={{ fontFamily: "'Playfair Display', serif", color: '#DC3545' }}
              >
                Processing Failed
              </h2>
              <p className="text-sm" style={{ color: '#6B7280' }}>
                {error || 'An unknown error occurred.'}
              </p>
              <button
                className="px-7 py-3 rounded-full text-sm font-semibold tracking-wider uppercase text-white cursor-pointer border-none mt-2"
                style={{ background: '#0D1B2A', fontFamily: "'Inter', sans-serif" }}
                onClick={resetAll}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>

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
