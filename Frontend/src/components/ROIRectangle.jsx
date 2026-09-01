import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * ROIRectangle — Draggable / resizable region-of-interest overlay.
 *
 * All coordinates are tracked in NATIVE video pixels. Display position
 * is computed by scaling via (video.clientWidth / video.videoWidth).
 *
 * Props:
 *   videoRef    — ref to the <video> element
 *   roi         — { x, y, w, h } in native video pixels
 *   onRoiChange — (newRoi) => void
 *   label       — "Region of Interest" | "Vibration Zone"
 *   color       — "orange" | "gray"
 *   interactive — enable drag/resize
 */

const HANDLE_SIZE = 10; // px on screen
const MIN_SIZE = 20;    // minimum native-pixel dimension

export default function ROIRectangle({
  videoRef,
  roi,
  onRoiChange,
  label = 'Region of Interest',
  color = 'orange',
  interactive = true,
}) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // null | 'move' | 'nw' | 'ne' | 'sw' | 'se'
  const dragStart = useRef({ mx: 0, my: 0, roi: null });

  /* ── Scale factors ── */
  const getScale = useCallback(() => {
    const v = videoRef?.current;
    if (!v || !v.videoWidth || !v.videoHeight) return { sx: 1, sy: 1, ox: 0, oy: 0 };
    
    const vRatio = v.videoWidth / v.videoHeight;
    const cRatio = v.clientWidth / v.clientHeight;
    
    let rw, rh, ox = 0, oy = 0;
    if (vRatio > cRatio) {
      rw = v.clientWidth;
      rh = v.clientWidth / vRatio;
      oy = (v.clientHeight - rh) / 2;
    } else {
      rh = v.clientHeight;
      rw = v.clientHeight * vRatio;
      ox = (v.clientWidth - rw) / 2;
    }

    return {
      sx: rw / v.videoWidth,
      sy: rh / v.videoHeight,
      ox,
      oy
    };
  }, [videoRef]);

  /* ── Convert native roi to display px ── */
  const { sx, sy, ox, oy } = getScale();
  const dx = ox + roi.x * sx;
  const dy = oy + roi.y * sy;
  const dw = roi.w * sx;
  const dh = roi.h * sy;

  /* ── Clamp roi to video bounds ── */
  const clampRoi = useCallback((r) => {
    const v = videoRef?.current;
    if (!v) return r;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    let { x, y, w, h } = r;
    w = Math.max(MIN_SIZE, Math.min(w, vw));
    h = Math.max(MIN_SIZE, Math.min(h, vh));
    x = Math.max(0, Math.min(x, vw - w));
    y = Math.max(0, Math.min(y, vh - h));
    return {
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h),
    };
  }, [videoRef]);

  /* ── Mouse down ── */
  const onPointerDown = useCallback((e, mode) => {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(mode);
    dragStart.current = { mx: e.clientX, my: e.clientY, roi: { ...roi } };

    // Capture pointer for smooth tracking outside the element
    e.target.setPointerCapture?.(e.pointerId);
  }, [interactive, roi]);

  /* ── Mouse move ── */
  const onPointerMove = useCallback((e) => {
    if (!dragging) return;
    e.preventDefault();
    const { sx, sy } = getScale();
    const deltaX = (e.clientX - dragStart.current.mx) / sx; // screen px → native px
    const deltaY = (e.clientY - dragStart.current.my) / sy;
    const orig = dragStart.current.roi;

    let newRoi;

    if (dragging === 'move') {
      newRoi = { ...orig, x: orig.x + deltaX, y: orig.y + deltaY };
    } else if (dragging === 'se') {
      newRoi = { ...orig, w: orig.w + deltaX, h: orig.h + deltaY };
    } else if (dragging === 'sw') {
      newRoi = {
        ...orig,
        x: orig.x + deltaX,
        w: orig.w - deltaX,
        h: orig.h + deltaY,
      };
    } else if (dragging === 'ne') {
      newRoi = {
        ...orig,
        y: orig.y + deltaY,
        w: orig.w + deltaX,
        h: orig.h - deltaY,
      };
    } else if (dragging === 'nw') {
      newRoi = {
        x: orig.x + deltaX,
        y: orig.y + deltaY,
        w: orig.w - deltaX,
        h: orig.h - deltaY,
      };
    }

    if (newRoi) onRoiChange(clampRoi(newRoi));
  }, [dragging, getScale, clampRoi, onRoiChange]);

  /* ── Mouse up ── */
  const onPointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  /* ── Global listeners for move/up during drag ── */
  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => onPointerMove(e);
    const handleUp = () => onPointerUp();
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, onPointerMove, onPointerUp]);

  const borderColor = color === 'orange' ? '#E8741A' : '#9CA3AF';
  const fillColor = color === 'orange' ? 'rgba(232,116,26,0.08)' : 'rgba(156,163,175,0.08)';
  const labelBg = color === 'orange' ? 'rgba(232,116,26,0.9)' : 'rgba(107,114,128,0.8)';

  /* Don't render if ROI has no size */
  if (roi.w < 2 || roi.h < 2) return null;

  return (
    <div
      ref={containerRef}
      className="absolute pointer-events-none"
      style={{
        left: dx, top: dy, width: dw, height: dh,
      }}
    >
      {/* Label */}
      <div
        className="absolute -top-6 left-0 px-2 py-0.5 text-white uppercase tracking-widest pointer-events-none"
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '9px',
          background: labelBg,
          borderRadius: '3px',
        }}
      >
        {label}
      </div>

      {/* Rectangle body — draggable */}
      <div
        className={`absolute inset-0 border-2 ${interactive ? 'pointer-events-auto cursor-move' : ''}`}
        style={{
          borderColor,
          backgroundColor: fillColor,
        }}
        onPointerDown={(e) => onPointerDown(e, 'move')}
      />

      {/* Corner handles */}
      {interactive && (
        <>
          {/* NW */}
          <div
            className="absolute pointer-events-auto cursor-nw-resize"
            style={{
              left: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2,
              width: HANDLE_SIZE, height: HANDLE_SIZE,
              background: borderColor, border: '1.5px solid #fff',
            }}
            onPointerDown={(e) => onPointerDown(e, 'nw')}
          />
          {/* NE */}
          <div
            className="absolute pointer-events-auto cursor-ne-resize"
            style={{
              right: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2,
              width: HANDLE_SIZE, height: HANDLE_SIZE,
              background: borderColor, border: '1.5px solid #fff',
            }}
            onPointerDown={(e) => onPointerDown(e, 'ne')}
          />
          {/* SW */}
          <div
            className="absolute pointer-events-auto cursor-sw-resize"
            style={{
              left: -HANDLE_SIZE / 2, bottom: -HANDLE_SIZE / 2,
              width: HANDLE_SIZE, height: HANDLE_SIZE,
              background: borderColor, border: '1.5px solid #fff',
            }}
            onPointerDown={(e) => onPointerDown(e, 'sw')}
          />
          {/* SE */}
          <div
            className="absolute pointer-events-auto cursor-se-resize"
            style={{
              right: -HANDLE_SIZE / 2, bottom: -HANDLE_SIZE / 2,
              width: HANDLE_SIZE, height: HANDLE_SIZE,
              background: borderColor, border: '1.5px solid #fff',
            }}
            onPointerDown={(e) => onPointerDown(e, 'se')}
          />
        </>
      )}
    </div>
  );
}
