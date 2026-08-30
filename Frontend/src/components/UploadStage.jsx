import { useState, useRef, useCallback } from 'react';
import { uploadVideo } from '../api';

/**
 * UploadStage — Drag-and-drop upload zone.
 *
 * Props:
 *   onUploaded — ({ jobId, file }) => void — called on successful upload
 */
export default function UploadStage({ onUploaded }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('video/')) {
      setError('Please select a valid video file.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const data = await uploadVideo(file);
      onUploaded({ jobId: data.job_id, file });
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setUploading(false);
    }
  }, [onUploaded]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  }, [handleFile]);

  return (
    <div className="flex flex-col items-center pt-16 pb-10">

      {/* Eyebrow */}
      <div
        className="uppercase tracking-[0.18em] mb-3"
        style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#E8741A' }}
      >
        New Analysis
      </div>

      {/* Heading */}
      <h1
        className="text-4xl font-bold mb-2"
        style={{ fontFamily: "'Playfair Display', serif", color: '#0D1B2A' }}
      >
        Upload a Video
      </h1>

      <p className="text-base mb-10" style={{ color: '#6B7280' }}>
        Select a recording to begin motion amplification analysis.
      </p>

      {/* Drop zone */}
      <div
        className={`
          relative flex flex-col items-center justify-center
          w-full max-w-[640px] min-h-[280px] p-12
          border-2 border-dashed rounded-3xl cursor-pointer
          transition-all duration-300
          ${dragOver
            ? 'border-[#E8741A] bg-[#FEF0E3]'
            : 'border-[#D1CFCA] bg-white hover:border-[#E8741A] hover:bg-[#FEF0E3]'}
        `}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {uploading ? (
          /* Spinner */
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-10 h-10 border-3 border-[#E5E3DC] border-t-[#E8741A] rounded-full animate-spin"
            />
            <span className="text-sm" style={{ color: '#6B7280' }}>
              Uploading…
            </span>
          </div>
        ) : (
          <>
            {/* Upload icon */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-5 transition-colors"
              style={{ background: dragOver ? 'rgba(232,116,26,0.15)' : '#FEF0E3' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8741A" strokeWidth="2" strokeLinecap="round">
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            </div>

            <h3 className="text-base font-medium mb-2" style={{ color: '#0D1B2A' }}>
              Drag and drop a video, or click to browse
            </h3>

            <span
              className="uppercase tracking-[0.1em]"
              style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#9CA3AF' }}
            >
              Supported formats: MP4 · MOV · AVI
            </span>
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 flex items-center gap-2 text-sm" style={{ color: '#DC3545' }}>
          <span>{error}</span>
          <button
            className="underline cursor-pointer"
            style={{ color: '#DC3545' }}
            onClick={() => { setError(null); setUploading(false); }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
