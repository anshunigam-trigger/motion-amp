/**
 * api.js — Analysis page API client.
 * Wraps all fetch calls with proper error handling that extracts
 * backend `detail` messages from JSON error responses.
 */

const BACKEND = 'http://127.0.0.1:8000';

/** Parse error detail from a failed response */
async function parseError(res, fallback) {
  try {
    const body = await res.json();
    if (body.detail) return body.detail;
  } catch { /* ignore parse errors */ }
  return `${fallback} (${res.status})`;
}

/** Upload a video file. Returns { job_id, filename } */
export async function uploadVideo(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error(await parseError(res, 'Upload failed'));
  return res.json();
}

/** Submit ROI + frequency settings for a job */
export async function submitROI(jobId, { x, y, w, h, preset, low_hz, high_hz, alpha }) {
  const res = await fetch(`/api/jobs/${jobId}/roi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y, w, h, preset, low_hz, high_hz, alpha }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'ROI submission failed'));
  return res.json();
}

/** Start processing for a job */
export async function startProcessing(jobId) {
  const res = await fetch(`/api/jobs/${jobId}/process`, { method: 'POST' });
  if (!res.ok) throw new Error(await parseError(res, 'Processing request failed'));
  return res.json();
}

/** Check job status. Returns { job_id, status } */
export async function getJobStatus(jobId) {
  const res = await fetch(`/api/jobs/${jobId}/status`);
  if (!res.ok) throw new Error(await parseError(res, 'Status check failed'));
  return res.json();
}

/** Fetch completed job result */
export async function getResult(jobId) {
  const res = await fetch(`/api/jobs/${jobId}/result`);
  if (!res.ok) throw new Error(await parseError(res, 'Result fetch failed'));
  return res.json();
}

/**
 * Poll job status every `intervalMs` until 'done' or 'failed'.
 * Calls `onStatus(status)` on every poll.
 */
export function pollStatus(jobId, onStatus, intervalMs = 2000) {
  return new Promise((resolve, reject) => {
    const id = setInterval(async () => {
      try {
        const data = await getJobStatus(jobId);
        if (onStatus) onStatus(data.status);
        if (data.status === 'done') {
          clearInterval(id);
          resolve(data);
        } else if (data.status === 'failed') {
          clearInterval(id);
          reject(new Error('Processing failed on the server.'));
        }
      } catch (err) {
        clearInterval(id);
        reject(err);
      }
    }, intervalMs);
  });
}

/**
 * Build a full URL to the amplified video.
 * Normalizes backslashes to forward slashes (Windows paths from backend).
 */
export function amplifiedVideoUrl(relativePath) {
  if (!relativePath) return '';
  const normalized = relativePath.replace(/\\/g, '/');
  return `${BACKEND}/${normalized}`;
}
