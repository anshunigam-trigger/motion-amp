# MOTION AMP — React Frontend

A pixel-faithful React port of the MOTION AMP prototype.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (opens at http://localhost:3000)
npm start

# 3. Production build
npm run build
```

---

## File-by-file mapping: Original → React

| Original file | React equivalent | Notes |
|---|---|---|
| `index.html` (page-landing) | `src/components/LandingPage.jsx` | Hero, Steps, CTA, Footer |
| `index.html` (page-upload)  | `src/components/UploadPage.jsx`  | Dropzone, ROI, Sidebar |
| `index.html` (page-results) | `src/components/ResultsPage.jsx` | Freq hero, chart, summary |
| `style.css`                 | `src/index.css`                  | 1:1 port, all CSS vars kept |
| `app.js` → `showPage()`     | `src/App.jsx` → `useState(page)` | React state routing |
| `app.js` → `animateWaveCanvas()` | `src/hooks/useCanvas.js → useWaveCanvas()` | RAF loop in useEffect |
| `app.js` → `animateProgressBar()` | `src/hooks/useCanvas.js → useProgressBar()` | setInterval in useEffect |
| `app.js` → `initROICanvas()` | `src/hooks/useCanvas.js → useROICanvas()` | Full drag handle logic |
| `app.js` → `drawVibrationChart()` | `src/hooks/useCanvas.js → useVibrationChart()` | Canvas chart |
| `app.js` → `animateFreqNumber()` | `src/components/ResultsPage.jsx → useCountUp()` | rAF count-up hook |
| `app.js` → `startAnalysis()` | `UploadPage.jsx → ProcessingOverlay` | Inline component |
| `app.js` → `exportReport()` | `ResultsPage.jsx → handleExport()` | Local state stub |

---

## Project structure

```
motion-amp/
├── public/
│   └── index.html          ← Single HTML shell (replaces multi-page index.html)
├── src/
│   ├── index.js            ← React entry point
│   ├── index.css           ← Full design system (1:1 from style.css)
│   ├── App.jsx             ← Page router (replaces showPage() in app.js)
│   ├── hooks/
│   │   └── useCanvas.js    ← All canvas/animation logic (ported from app.js)
│   └── components/
│       ├── Logo.jsx        ← Shared logo component
│       ├── LandingPage.jsx ← Page 1
│       ├── UploadPage.jsx  ← Page 2
│       └── ResultsPage.jsx ← Page 3
└── package.json
```

---

## Key patterns used

### 1. Page routing
The original `showPage()` toggled `.page.active` classes. In React:
```jsx
// App.jsx
const [page, setPage] = useState('landing');
const navigate = dest => setPage(dest);

// Renders one of three page components based on state
switch (page) {
  case 'upload':  return <UploadPage onNavigate={navigate} />;
  case 'results': return <ResultsPage onNavigate={navigate} />;
  default:        return <LandingPage onNavigate={navigate} />;
}
```

### 2. Canvas animations in React
All `requestAnimationFrame` / `setInterval` loops are wrapped in `useEffect` with cleanup:
```jsx
// hooks/useCanvas.js
export function useWaveCanvas(active, opts) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    let rafId;
    function draw() { /* ... draw ... */ rafId = requestAnimationFrame(draw); }
    draw();
    return () => cancelAnimationFrame(rafId); // ← cleanup prevents memory leaks
  }, [active]);
  return ref; // attach to <canvas ref={ref} />
}
```

### 3. ROI canvas with drag
The full `initROICanvas()` logic (mousedown, mousemove, mouseup) lives in `useROICanvas()`:
```jsx
const roiCanvasRef = useROICanvas();
// ...
<canvas ref={roiCanvasRef} className="roi-canvas" height={280} />
```

### 4. Animated frequency count-up
```jsx
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    // rAF loop with ease-out cubic — exact port of animateFreqNumber()
  }, [target, duration]);
  return value;
}
// Usage: <span>{freqValue.toFixed(1)}</span>
```

---

## Extending: connect a real backend

The `ProcessingOverlay` in `UploadPage.jsx` currently runs a timer simulation.
To hook it up to a real API:

```jsx
// Replace the setInterval block with:
const formData = new FormData();
formData.append('video', file);
formData.append('preset', preset);

const res  = await fetch('/api/analyze', { method: 'POST', body: formData });
const data = await res.json();
// Pass data to ResultsPage via state/context
onAnalysisComplete(data);
```

Then lift `analysisData` into `App.jsx` state and pass it down to `ResultsPage`.

---

## What to add next

| Feature | How |
|---|---|
| Real backend | Replace timer in `ProcessingOverlay` with `fetch('/api/analyze')` |
| Video scrubbing on results | Add `<video>` element in results page, sync with chart canvas |
| Auth / saved analyses | Add React Router + a context for user sessions |
| Deployment | `npm run build` → serve `build/` folder via Nginx or Vercel |
| Tests | Add `@testing-library/react` — each page component is independently testable |
