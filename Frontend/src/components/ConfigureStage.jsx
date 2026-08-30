import { useState, useRef, useCallback, useEffect } from 'react';
import ROIRectangle from './ROIRectangle';
import { submitROI, startProcessing } from '../api';

/* ── Frequency presets ── */
const PRESETS = {
  engine:     { label: 'Engine / Motor', hz: '8–40 Hz', low: 8,  high: 40 },
  structural: { label: 'Structural Flex', hz: '1–6 Hz', low: 1,  high: 6 },
  custom:     { label: 'Custom', hz: null, low: null, high: null },
};

/**
 * ConfigureStage — Video + ROI panel (left) and settings sidebar (right).
 *
 * Props:
 *   file        — File object (for video preview)
 *   jobId       — string
 *   onProcessing — () => void — called when processing starts
 *   onGoBack    — () => void — go back to upload
 *   onError     — (msg) => void
 */
export default function ConfigureStage({ file, jobId, onProcessing, onGoBack, onError, onRoiChange }) {
  const videoRef = useRef(null);
  const [videoUrl] = useState(() => URL.createObjectURL(file));
  const [videoReady, setVideoReady] = useState(false);

  /* ROI state — native video pixels */
  const [roi, setRoi] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [hasDrawn, setHasDrawn] = useState(false);

  /* Settings */
  const [preset, setPreset] = useState('engine');
  const [customHz, setCustomHz] = useState({ low: '', high: '' });
  const [alpha, setAlpha] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  /* Playback */
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  /* Drawing state — for initial ROI draw via mouse on the video area */
  const [drawing, setDrawing] = useState(false);
  const drawStart = useRef({ x: 0, y: 0 });

  /* Cleanup blob URL */
  useEffect(() => {
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const onVideoLoaded = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      setDuration(v.duration);
      setVideoReady(true);
    }
  }, []);

  /* ── Initial ROI draw on the video stage ── */
  const getScale = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return { sx: 1, sy: 1 };
    return {
      sx: v.videoWidth / v.clientWidth,
      sy: v.videoHeight / v.clientHeight,
    };
  }, []);

  const onStagePointerDown = useCallback((e) => {
    if (hasDrawn) return; // once drawn, ROIRectangle handles interactions
    const rect = e.currentTarget.getBoundingClientRect();
    const { sx, sy } = getScale();
    drawStart.current = {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
    setDrawing(true);
  }, [hasDrawn, getScale]);

  const onStagePointerMove = useCallback((e) => {
    if (!drawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { sx, sy } = getScale();
    const mx = (e.clientX - rect.left) * sx;
    const my = (e.clientY - rect.top) * sy;

    const v = videoRef.current;
    const vw = v?.videoWidth || 1;
    const vh = v?.videoHeight || 1;

    setRoi({
      x: Math.round(Math.max(0, Math.min(drawStart.current.x, mx))),
      y: Math.round(Math.max(0, Math.min(drawStart.current.y, my))),
      w: Math.round(Math.min(Math.abs(mx - drawStart.current.x), vw)),
      h: Math.round(Math.min(Math.abs(my - drawStart.current.y), vh)),
    });
  }, [drawing, getScale]);

  const onStagePointerUp = useCallback(() => {
    if (drawing && roi.w > 10 && roi.h > 10) {
      setHasDrawn(true);
    }
    setDrawing(false);
  }, [drawing, roi]);

  /* ── Playback ── */
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  const onSeek = useCallback((e) => {
    const t = Number(e.target.value);
    const v = videoRef.current;
    if (v) v.currentTime = t;
    setCurrentTime(t);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const h = () => setCurrentTime(v.currentTime);
    v.addEventListener('timeupdate', h);
    return () => v.removeEventListener('timeupdate', h);
  }, [videoUrl]);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  /* ── Submit ── */
  const handleSubmit = useCallback(async () => {
    if (roi.w < 10 || roi.h < 10) return;
    const p = PRESETS[preset];
    let low_hz = p.low;
    let high_hz = p.high;

    if (preset === 'custom') {
      low_hz = Number(customHz.low);
      high_hz = Number(customHz.high);
      if (!low_hz || !high_hz || low_hz >= high_hz) {
        onError('Please enter valid min/max Hz values (low < high).');
        return;
      }
    }

    setSubmitting(true);
    try {
      await submitROI(jobId, { x: roi.x, y: roi.y, w: roi.w, h: roi.h, preset, low_hz, high_hz, alpha });
      await startProcessing(jobId);
      if (onRoiChange) onRoiChange(roi);
      onProcessing();
    } catch (err) {
      onError(err.message);
      setSubmitting(false);
    }
  }, [roi, preset, customHz, alpha, jobId, onProcessing, onError]);

  return (
    <div className="pt-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div
            className="uppercase tracking-[0.18em] mb-1"
            style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#E8741A' }}
          >
            Configure
          </div>
          <h2
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: "'Playfair Display', serif", color: '#0D1B2A' }}
          >
            Select Region &amp; Settings
          </h2>
          <p className="text-sm max-w-md" style={{ color: '#6B7280' }}>
            Draw a rectangle on the video to define the area of interest, then set analysis parameters.
          </p>
        </div>
        <button
          className="text-sm cursor-pointer border-none bg-transparent"
          style={{ color: '#6B7280' }}
          onClick={onGoBack}
        >
          ← Change Video
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-7 items-start" style={{ minHeight: 400 }}>

        {/* LEFT — Video + ROI (65%) */}
        <div className="flex-[65] min-w-0">
          <div className="rounded-3xl overflow-hidden" style={{ background: '#0D1B2A', boxShadow: '0 8px 32px rgba(13,27,42,0.12)', border: '1px solid rgba(255,255,255,0.06)' }}>

            {/* Video header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span
                className="uppercase tracking-[0.14em]"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.45)' }}
              >
                Source Video
              </span>
              <span
                style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.3)' }}
              >
                {file?.name}
              </span>
            </div>

            {/* Video + ROI overlay */}
            <div
              className="relative bg-black"
              style={{ cursor: hasDrawn ? 'default' : 'crosshair' }}
              onPointerDown={onStagePointerDown}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerUp}
              onPointerLeave={() => drawing && onStagePointerUp()}
            >
              <video
                ref={videoRef}
                src={videoUrl}
                muted loop playsInline
                onLoadedMetadata={onVideoLoaded}
                className="block w-full"
                style={{ height: 'auto' }}
              />

              {/* ROI rectangle overlay */}
              {videoReady && (roi.w > 2 || roi.h > 2) && (
                <ROIRectangle
                  videoRef={videoRef}
                  roi={roi}
                  onRoiChange={(r) => { setRoi(r); setHasDrawn(true); }}
                  label="Region of Interest"
                  color="orange"
                  interactive={hasDrawn}
                />
              )}

              {/* Instruction overlay when ROI not drawn */}
              {videoReady && !hasDrawn && roi.w < 2 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="px-4 py-2 rounded-lg text-white text-sm"
                    style={{ background: 'rgba(0,0,0,0.6)', fontFamily: "'DM Mono', monospace", fontSize: 12 }}
                  >
                    Click and drag to draw ROI
                  </div>
                </div>
              )}
            </div>

            {/* Playback controls */}
            <div className="flex items-center gap-3 px-5 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-none flex-shrink-0 transition-colors"
                style={{ background: '#E8741A' }}
                onClick={togglePlay}
              >
                {playing ? (
                  <svg width="14" height="14" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" fill="#fff"/><rect x="14" y="4" width="4" height="16" fill="#fff"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" fill="#fff"/></svg>
                )}
              </button>
              <div className="flex-1">
                <input
                  type="range"
                  min={0} max={duration || 0} step={0.01}
                  value={currentTime}
                  onChange={onSeek}
                  className="w-full h-1 cursor-pointer"
                  style={{ accentColor: '#E8741A' }}
                />
              </div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.35)', minWidth: 80, textAlign: 'right' }}>
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </span>
            </div>
          </div>

          {/* ROI readout */}
          {hasDrawn && (
            <div
              className="mt-2.5 tracking-wider"
              style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9CA3AF' }}
            >
              ROI: {roi.x},{roi.y} — {roi.w}×{roi.h}px
            </div>
          )}
        </div>

        {/* RIGHT — Settings sidebar (35%) */}
        <div className="flex-[35]">
          <div className="bg-white border rounded-2xl p-7" style={{ borderColor: '#E5E3DC' }}>

            {/* Frequency preset */}
            <div className="mb-6">
              <span
                className="block uppercase tracking-[0.14em] mb-3"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#6B7280' }}
              >
                Frequency Band
              </span>
              <div className="flex flex-col gap-2">
                {Object.entries(PRESETS).map(([key, val]) => (
                  <button
                    key={key}
                    className={`
                      flex items-center justify-between w-full px-4 py-3
                      rounded-xl border-[1.5px] cursor-pointer text-left transition-all
                      ${preset === key
                        ? 'border-[#E8741A] bg-[#FEF0E3]'
                        : 'border-[#E5E3DC] bg-[#F5F3EE] hover:border-[#D1CFCA]'}
                    `}
                    style={{ fontFamily: "'Inter', sans-serif" }}
                    onClick={() => setPreset(key)}
                  >
                    <span className="text-sm font-medium" style={{ color: '#0D1B2A' }}>{val.label}</span>
                    {val.hz && (
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9CA3AF' }}>
                        {val.hz}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {preset === 'custom' && (
                <div className="flex gap-2.5 items-end mt-3">
                  <div className="flex-1 flex flex-col gap-1">
                    <label
                      className="uppercase tracking-wider"
                      style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9CA3AF' }}
                    >
                      Low
                    </label>
                    <input
                      type="number"
                      placeholder="Hz"
                      value={customHz.low}
                      onChange={(e) => setCustomHz((p) => ({ ...p, low: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border outline-none transition-colors"
                      style={{
                        background: '#F5F3EE', borderColor: '#E5E3DC', color: '#0D1B2A',
                        fontFamily: "'DM Mono', monospace", fontSize: 14,
                      }}
                    />
                  </div>
                  <span className="pb-2" style={{ color: '#9CA3AF' }}>—</span>
                  <div className="flex-1 flex flex-col gap-1">
                    <label
                      className="uppercase tracking-wider"
                      style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9CA3AF' }}
                    >
                      High
                    </label>
                    <input
                      type="number"
                      placeholder="Hz"
                      value={customHz.high}
                      onChange={(e) => setCustomHz((p) => ({ ...p, high: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border outline-none transition-colors"
                      style={{
                        background: '#F5F3EE', borderColor: '#E5E3DC', color: '#0D1B2A',
                        fontFamily: "'DM Mono', monospace", fontSize: 14,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Alpha slider */}
            <div className="mb-7">
              <span
                className="block uppercase tracking-[0.14em] mb-3"
                style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#6B7280' }}
              >
                Amplification (α)
              </span>
              <div className="flex items-center gap-3.5">
                <input
                  type="range"
                  min={1} max={50} step={1}
                  value={alpha}
                  onChange={(e) => setAlpha(Number(e.target.value))}
                  className="flex-1 h-1 cursor-pointer"
                  style={{ accentColor: '#E8741A' }}
                />
                <span
                  className="font-medium min-w-9 text-right"
                  style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: '#E8741A' }}
                >
                  ×{alpha}
                </span>
              </div>
            </div>

            {/* Run button */}
            <button
              className={`
                w-full flex items-center justify-center py-3.5 rounded-full text-sm font-semibold
                tracking-wider uppercase border-none cursor-pointer transition-all
                ${hasDrawn && !submitting
                  ? 'text-white'
                  : 'text-gray-400 cursor-not-allowed'}
              `}
              style={{
                background: hasDrawn && !submitting ? '#0D1B2A' : '#D1CFCA',
                fontFamily: "'Inter', sans-serif",
              }}
              disabled={!hasDrawn || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin mr-2" />
                  Submitting…
                </>
              ) : (
                'Run Analysis'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
