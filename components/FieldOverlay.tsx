"use client";

import { useRef, useState } from "react";
import { useTemplateStore } from "@/store/templateStore";
import type { PdfFieldType } from "@/types/pdf";
import { v4 as uuidv4 } from "uuid";

interface FieldOverlayProps {
  pageNumber: number; // 1-based page index from PdfCanvas
}

interface Point {
  x: number;
  y: number;
}

interface NormRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function FieldOverlay({ pageNumber }: FieldOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const currentFields = useTemplateStore((state) => state.currentFields);
  const addCurrentField = useTemplateStore((state) => state.addCurrentField);

  const [isDragging, setIsDragging] = useState(false);
  const [start, setStart] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);

  // New: pending field rect and form state
  const [pendingRectPx, setPendingRectPx] = useState<NormRect | null>(null);
  const [pendingRectNorm, setPendingRectNorm] = useState<NormRect | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<PdfFieldType>("text");

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't start a new drag while the "new field" form is open
    if (pendingRectPx) return;
    if (!overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);
    setStart({ x, y });
    setCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !overlayRef.current || !start || pendingRectPx) return;
    const rect = overlayRef.current.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (!isDragging || !overlayRef.current || !start || !current) {
      setIsDragging(false);
      return;
    }

    const rect = overlayRef.current.getBoundingClientRect();

    const x1 = Math.min(start.x, current.x);
    const y1 = Math.min(start.y, current.y);
    const x2 = Math.max(start.x, current.x);
    const y2 = Math.max(start.y, current.y);

    const width = x2 - x1;
    const height = y2 - y1;

    // Ignore tiny drags
    if (width > 8 && height > 8) {
      // Normalized rect
      const nx = x1 / rect.width;
      const ny = y1 / rect.height;
      const nWidth = width / rect.width;
      const nHeight = height / rect.height;

      setPendingRectNorm({
        x: nx,
        y: ny,
        width: nWidth,
        height: nHeight,
      });

      setPendingRectPx({
        x: x1,
        y: y1,
        width,
        height,
      });

      // Reset form state for new field
      setNewKey("");
      setNewType("text");
    }

    setIsDragging(false);
    setStart(null);
    setCurrent(null);
  };

  const handleConfirmNewField = () => {
    if (!pendingRectNorm) {
      // Nothing to save
      setPendingRectPx(null);
      setPendingRectNorm(null);
      return;
    }

    const id = uuidv4();
    const generatedKey = `field_${id.slice(0, 6)}`;
    const finalKey = newKey.trim() || generatedKey;

    addCurrentField({
      id,
      page: pageNumber - 1, // store as 0-based internally
      x: pendingRectNorm.x,
      y: pendingRectNorm.y,
      width: pendingRectNorm.width,
      height: pendingRectNorm.height,
      key: finalKey,
      type: newType || "text",
    });

    // Clear pending state
    setPendingRectPx(null);
    setPendingRectNorm(null);
    setNewKey("");
    setNewType("text");
  };

  const handleCancelNewField = () => {
    setPendingRectPx(null);
    setPendingRectNorm(null);
    setNewKey("");
    setNewType("text");
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmNewField();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancelNewField();
    }
  };

  // Drag preview style
  let previewStyle: React.CSSProperties | undefined;
  if (isDragging && start && current && overlayRef.current && !pendingRectPx) {
    const x1 = Math.min(start.x, current.x);
    const y1 = Math.min(start.y, current.y);
    const x2 = Math.max(start.x, current.x);
    const y2 = Math.max(start.y, current.y);

    previewStyle = {
      left: x1,
      top: y1,
      width: x2 - x1,
      height: y2 - y1,
    };
  }

  const overlayRect = overlayRef.current?.getBoundingClientRect();

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Drag preview box */}
      {previewStyle && (
        <div
          className="absolute border border-sky-400/80 bg-sky-500/10 pointer-events-none"
          style={previewStyle}
        />
      )}

      {/* Persistent field rectangles for this page */}
      {overlayRect &&
        currentFields
          .filter((field) => field.page === pageNumber - 1)
          .map((field) => {
            const left = field.x * overlayRect.width;
            const top = field.y * overlayRect.height;
            const width = field.width * overlayRect.width;
            const height = field.height * overlayRect.height;

            return (
              <div
                key={field.id}
                className="absolute border border-emerald-400/80 bg-emerald-500/10 pointer-events-none"
                style={{ left, top, width, height }}
              >
                {/* Label tag */}
                <div className="absolute -top-4 left-0 text-[10px] px-1 rounded bg-slate-950/90 border border-emerald-500/60 text-emerald-300 font-mono">
                  {field.key}
                </div>
              </div>
            );
          })}

      {/* New field prompt overlay at the pending rect */}
      {pendingRectPx && (
        <div
          className="absolute border border-sky-400/80 bg-sky-500/10"
          style={{
            left: pendingRectPx.x,
            top: pendingRectPx.y,
            width: pendingRectPx.width,
            height: pendingRectPx.height,
          }}
        >
          <div
            className="absolute -top-1 left-0 translate-y-[-100%] bg-slate-950/95 border border-sky-500 rounded px-2 py-1 flex items-center gap-2 text-[11px] text-slate-100 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleFormKeyDown}
          >
            <input
              className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] font-mono min-w-[120px] focus:outline-none focus:border-sky-500"
              placeholder="Field name (optional)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              autoFocus
            />
            <select
              className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] focus:outline-none focus:border-sky-500"
              value={newType}
              onChange={(e) => setNewType(e.target.value as PdfFieldType)}
            >
              <option value="text">text</option>
              <option value="number">number</option>
              <option value="date">date</option>
              <option value="checkbox">checkbox</option>
            </select>
            <button
              type="button"
              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-medium"
              onClick={handleConfirmNewField}
            >
              Save
            </button>
            <button
              type="button"
              className="px-1 py-0.5 text-[11px] text-slate-400 hover:text-slate-200"
              onClick={handleCancelNewField}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
