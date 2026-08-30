import { useState, useEffect, useRef, useCallback } from 'react';
import { pollStatus, getResult } from '../api';

const STATUS_TEXTS = [
  'Decomposing frames…',
  'Extracting phase signal…',
  'Running frequency analysis…',
  'Generating amplified output…',
];

/**
 * ProcessingStage — Animated waiting state with polling.
 *
 * Props:
 *   jobId     — string
 *   fileName  — string (for display)
 *   onDone    — (result) => void
 *   onFailed  — (errorMsg) => void
 */
export default function ProcessingStage({ jobId, fileName, onDone, onFailed }) {
  const [textIdx, setTextIdx] = useState(0);
  const [status, setStatus] = useState('processing');
  const pollStarted = useRef(false);

  /* Rotate status sub-text every 2.5s */
  useEffect(() => {
    const id = setInterval(() => {
      setTextIdx((i) => (i + 1) % STATUS_TEXTS.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  /* Poll and fetch result */
  useEffect(() => {
    if (pollStarted.current) return;
    pollStarted.current = true;

    (async () => {
      try {
        await pollStatus(jobId, (s) => setStatus(s));
        const result = await getResult(jobId);
        onDone(result);
      } catch (err) {
        onFailed(err.message || 'Processing failed.');
      }
    })();
  }, [jobId, onDone, onFailed]);

  return (
    <div className="flex flex-col items-center pt-20 pb-16">

      {/* Eyebrow */}
      <div
        className="uppercase tracking-[0.18em] mb-3"
        style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#E8741A' }}
      >
        Processing
      </div>

      <h2
        className="text-3xl font-bold mb-8"
        style={{ fontFamily: "'Playfair Display', serif", color: '#0D1B2A' }}
      >
        Analyzing Footage…
      </h2>

      {/* Card */}
      <div
        className="flex flex-col items-center gap-6 max-w-sm w-full p-12 rounded-3xl border"
        style={{ background: '#FFFFFF', borderColor: '#E5E3DC' }}
      >
        {/* Pulsing orange dot */}
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ background: '#E8741A' }}
          />
          <div
            className="w-5 h-5 rounded-full z-10"
            style={{ background: '#E8741A' }}
          />
        </div>

        {/* Rotating status text */}
        <span
          className="text-sm text-center transition-opacity duration-500"
          style={{ color: '#6B7280', minHeight: 20 }}
          key={textIdx}
        >
          {STATUS_TEXTS[textIdx]}
        </span>

        {/* File name */}
        <span
          className="tracking-wider"
          style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#9CA3AF' }}
        >
          {fileName}
        </span>
      </div>
    </div>
  );
}
