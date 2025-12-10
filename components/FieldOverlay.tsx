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

export default function FieldOverlay({ pageNumber }: FieldOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const addCurrentField = useTemplateStore((state) => state.addCurrentField);
  const currentFields = useTemplateStore((state) => state.currentFields);

  const [isDragging, setIsDragging] = useState(false);
  const [start, setStart] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);

  const overlayRect = overlayRef.current?.getBoundingClientRect();

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);
    setStart({ x, y });
    setCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !overlayRef.current || !start) return;
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

    // Compute box in overlay pixel space
    const x1 = Math.min(start.x, current.x);
    const y1 = Math.min(start.y, current.y);
    const x2 = Math.max(start.x, current.x);
    const y2 = Math.max(start.y, current.y);

    const width = x2 - x1;
    const height = y2 - y1;

    // Ignore tiny drags
    if (width > 8 && height > 8) {
      // Normalize to [0,1] relative to overlay size
      const nx = x1 / rect.width;
      const ny = y1 / rect.height;
      const nWidth = width / rect.width;
      const nHeight = height / rect.height;

      // Temporary default field info
      const defaultType: PdfFieldType = "text";
      const id = uuidv4();
      const key = `field_${id.slice(0, 6)}`;

      addCurrentField({
        id,
        page: pageNumber - 1, // store as 0-based internally
        x: nx,
        y: ny,
        width: nWidth,
        height: nHeight,
        key,
        type: defaultType,
      });
    }

    setIsDragging(false);
    setStart(null);
    setCurrent(null);
  };

  // Compute preview rect (in pixels) for drawing
  let previewStyle: React.CSSProperties | undefined;
  if (isDragging && start && current && overlayRef.current) {
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
    </div>
  );
}
