import { useState, useRef, useCallback, useEffect } from 'react';
import ROIRectangle from './ROIRectangle';
import IntensityChart from './IntensityChart';
import SpectrumChart from './SpectrumChart';
import { amplifiedVideoUrl } from '../api';

/**
 * ResultsStage — Final analysis results display.
 *
 * Props:
 *   result      — API result object
 *   roi         — { x, y, w, h } in native video pixels
 *   file        — original File object
 *   onNewAnalysis — () => void (full reset)
 */
export default function ResultsStage({ result, roi, file, originalUrl, onNewAnalysis }) {
  const [videoTab, setVideoTab] = useState('amplified');
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoReady, setVideoReady] = useState(false);

  const isDetected = result.flag === 'periodic_vibration_detected';
  const ampUrl = amplifiedVideoUrl(result.amplified_video_url);
  const freqHz = result.dominant_freq_hz != null ? Number(result.dominant_freq_hz).toFixed(2) : '—';

  /* Compute detailed report metrics */
  let report = null;
  const spec = result.frequency_spectrum;
  if (spec && spec.amplitudes && spec.amplitudes.length > 0) {
    const maxAmp = Math.max(...spec.amplitudes);
    const meanAmp = spec.amplitudes.reduce((a, b) => a + b, 0) / spec.amplitudes.length;
    const snr = meanAmp > 0 ? (maxAmp / meanAmp) : 0;
    const isConfident = isDetected && snr >= 3.0;

    let text = '';
    if (isConfident) {
      text = `The system confidently detected a distinct periodic motion at ${freqHz} Hz. The peak signal strength is ${snr.toFixed(1)}x higher than the background noise floor, indicating a clear, sustained vibration rather than random movement or camera shake.`;
    } else if (isDetected) {
      text = `The system detected a potential periodic motion at ${freqHz} Hz, but the signal-to-noise ratio (${snr.toFixed(1)}x) is relatively low. This suggests a weak vibration or a signal heavily obscured by background noise.`;
    } else {
      text = `No significant periodic motion was detected. The highest signal peak (${snr.toFixed(1)}x noise floor) did not exceed the confidence threshold, suggesting only random noise or transient movements in the specified frequency band.`;
    }
    
    report = { snr: snr.toFixed(1), text, isConfident, maxAmp: maxAmp.toFixed(5) };
  }

  const onVideoLoaded = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      setDuration(v.duration);
      setVideoReady(true);
    }
  }, []);

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
  }, [videoTab]);

  /* Reset video state on tab switch */
  useEffect(() => {
    setVideoReady(false);
    setPlaying(false);
    setCurrentTime(0);
  }, [videoTab]);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <div className="pt-4 pb-12">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-7 gap-6 flex-wrap">
        <div>
          <div
            className="uppercase tracking-[0.18em] mb-2"
            style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#E8741A' }}
          >
            Analysis Complete
          </div>

          {/* Badge + Frequency */}
          <div className="flex items-center gap-5 mt-2 flex-wrap">
            {isDetected ? (
              <span
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-white font-semibold uppercase tracking-wider"
                style={{
                  background: '#E8741A',
                  fontFamily: "'DM Mono', monospace", fontSize: 12,
                }}
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                ⚠ Periodic Vibration Detected
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-semibold uppercase tracking-wider"
                style={{
                  border: '1.5px solid #D1CFCA', color: '#6B7280',
                  fontFamily: "'DM Mono', monospace", fontSize: 12,
                }}
              >
                ✓ No Vibration Detected
              </span>
            )}

            {/* Dominant frequency */}
            <div className="flex items-baseline gap-1">
              <span
                className="text-4xl font-bold leading-none"
                style={{ fontFamily: "'Playfair Display', serif", color: '#0D1B2A' }}
              >
                {freqHz}
              </span>
              <span
                style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: '#6B7280' }}
              >
                Hz
              </span>
            </div>
          </div>
        </div>

        {/* Meta cards */}
        <div className="flex gap-3.5 flex-shrink-0">
          <div className="bg-white border rounded-xl px-5 py-3.5 flex flex-col gap-1" style={{ borderColor: '#E5E3DC' }}>
            <span
              className="uppercase tracking-wider"
              style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9CA3AF' }}
            >
              Detection Flag
            </span>
            <span
              className="text-lg font-semibold"
              style={{ fontFamily: "'Playfair Display', serif", color: '#0D1B2A' }}
            >
              {isDetected ? 'Detected' : 'Clean'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Video panel ── */}
      <div className="mb-7">
        {/* Tab toggle */}
        <div className="flex gap-1 mb-3">
          {['original', 'amplified'].map((tab) => (
            <button
              key={tab}
              className={`
                px-5 py-2 rounded-xl border-[1.5px] cursor-pointer font-medium uppercase tracking-wider transition-all
                ${videoTab === tab ? 'text-white' : ''}
              `}
              style={{
                fontFamily: "'DM Mono', monospace", fontSize: 12,
                borderColor: videoTab === tab ? '#0D1B2A' : '#E5E3DC',
                background: videoTab === tab ? '#0D1B2A' : '#fff',
                color: videoTab === tab ? '#fff' : '#6B7280',
              }}
              onClick={() => setVideoTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Video module */}
        <div className="rounded-3xl overflow-hidden" style={{ background: '#0D1B2A', boxShadow: '0 8px 32px rgba(13,27,42,0.12)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="relative bg-black flex justify-center items-center" style={{ maxHeight: '550px' }}>
            <video
              ref={videoRef}
              key={videoTab} /* force remount on tab switch */
              src={videoTab === 'original' ? originalUrl : ampUrl}
              muted loop playsInline
              onLoadedMetadata={onVideoLoaded}
              className="block"
              style={{ maxWidth: '100%', maxHeight: '550px', objectFit: 'contain' }}
            />

            {/* ROI overlay (only on original tab, or amplified if coordinates apply) */}
            {videoReady && videoTab === 'original' && roi.w > 2 && (
              <ROIRectangle
                videoRef={videoRef}
                roi={roi}
                onRoiChange={() => {}}
                label="Vibration Zone"
                color={isDetected ? 'orange' : 'gray'}
                interactive={false}
              />
            )}
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-3 px-5 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-none flex-shrink-0"
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
                type="range" min={0} max={duration || 0} step={0.01}
                value={currentTime} onChange={onSeek}
                className="w-full h-1 cursor-pointer"
                style={{ accentColor: '#E8741A' }}
              />
            </div>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.35)', minWidth: 80, textAlign: 'right' }}>
              {fmtTime(currentTime)} / {fmtTime(duration)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
        {/* Intensity chart */}
        <div className="rounded-2xl p-5" style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 16px rgba(13,27,42,0.10)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3
              className="text-base font-semibold text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Motion Intensity Over Time
            </h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: '#E8741A' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Signal</span>
              <span className="w-2 h-2 rounded-full" style={{ background: '#2E7D52' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Mean</span>
            </div>
          </div>
          <IntensityChart data={result.intensity_series} fps={30} />
        </div>

        {/* Spectrum chart */}
        <div className="rounded-2xl p-5" style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 16px rgba(13,27,42,0.10)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3
              className="text-base font-semibold text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Frequency Spectrum
            </h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: '#E8741A' }} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Peak</span>
            </div>
          </div>
          <SpectrumChart
            frequencies={result.frequency_spectrum?.frequencies_hz}
            amplitudes={result.frequency_spectrum?.amplitudes}
            peakHz={result.dominant_freq_hz}
          />
        </div>
      </div>

      {/* ── Detailed Report ── */}
      {report && (
        <div className="bg-white border rounded-3xl p-7 mb-7 flex flex-col md:flex-row gap-8 items-start" style={{ borderColor: '#E5E3DC' }}>
          <div className="flex-1">
            <h3
              className="text-xl font-bold mb-3"
              style={{ fontFamily: "'Playfair Display', serif", color: '#0D1B2A' }}
            >
              Analysis Report
            </h3>
            <p className="text-base leading-relaxed" style={{ color: '#6B7280' }}>
              {report.text}
            </p>
          </div>
          
          <div className="flex gap-6 flex-wrap md:flex-nowrap shrink-0 p-5 rounded-2xl" style={{ background: '#F5F3EE' }}>
            <div className="flex flex-col gap-1">
              <span className="uppercase tracking-wider" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9CA3AF' }}>
                Signal-to-Noise
              </span>
              <span className="text-xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color: report.isConfident ? '#E8741A' : '#0D1B2A' }}>
                {report.snr}x
              </span>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="flex flex-col gap-1">
              <span className="uppercase tracking-wider" style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#9CA3AF' }}>
                Peak Amplitude
              </span>
              <span className="text-xl font-bold" style={{ fontFamily: "'DM Mono', monospace", color: '#0D1B2A' }}>
                {report.maxAmp}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex gap-3.5 flex-wrap">
        <button
          className="px-7 py-3 rounded-full text-sm font-semibold tracking-wider uppercase text-white cursor-pointer border-none transition-colors"
          style={{ background: '#0D1B2A', fontFamily: "'Inter', sans-serif" }}
          onClick={onNewAnalysis}
        >
          New Analysis
        </button>
        {result.amplified_video_url && (
          <a
            className="px-7 py-3 rounded-full text-sm font-semibold tracking-wider uppercase cursor-pointer no-underline transition-colors"
            style={{
              border: '1.5px solid #E5E3DC', color: '#0D1B2A', background: 'transparent',
              fontFamily: "'Inter', sans-serif",
            }}
            href={ampUrl}
            download
          >
            Download Amplified Video
          </a>
        )}
      </div>
    </div>
  );
}
