/**
 * API client — all backend communication goes through here.
 */

export async function uploadVideo(file) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return res.json();
}

export async function submitROI(jobId, { x, y, w, h, preset, low_hz, high_hz, alpha }) {
  const res = await fetch(`/api/jobs/${jobId}/roi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y, w, h, preset, low_hz, high_hz, alpha }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ROI submission failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function startProcessing(jobId) {
  const res = await fetch(`/api/jobs/${jobId}/process`, { method: 'POST' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Processing request failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function getJobStatus(jobId) {
  const res = await fetch(`/api/jobs/${jobId}/status`);
  if (!res.ok) throw new Error(`Status check failed (${res.status})`);
  return res.json();
}

export async function getJobResult(jobId) {
  const res = await fetch(`/api/jobs/${jobId}/result`);
  if (!res.ok) throw new Error(`Result fetch failed (${res.status})`);
  return res.json();
}

export async function getJobFrame(jobId) {
  const res = await fetch(`/api/jobs/${jobId}/frame`);
  if (!res.ok) throw new Error(`Frame fetch failed (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Poll job status every `intervalMs` until 'done' or 'failed'.
 * Calls `onStatus(status)` on every poll.
 * Returns the final status.
 */
export function pollUntilDone(jobId, onStatus, intervalMs = 2000) {
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

export async function getJobs() {
  const res = await fetch('/api/jobs');
  if (!res.ok) throw new Error(`Jobs fetch failed (${res.status})`);
  return res.json();
}
