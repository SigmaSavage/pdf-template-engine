"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { PdfField } from "@/types/pdf";

interface FillOverlayProps {
  pageNumber: number; // 1-based page index
  fields: PdfField[];
  values: Record<string, string | number | boolean>;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  defaultFontSize: number;
  defaultColor: string;
  highlightKey: string | null;
  version: number;
  onUpdateField: (id: string, patch: Partial<PdfField>) => void;
}

export default function FillOverlay({
  pageNumber,
  fields,
  values,
  selectedFieldId,
  onSelectField,
  defaultFontSize,
  defaultColor,
  highlightKey,
  version,
  onUpdateField,
}: FillOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [overlayRect, setOverlayRect] = useState<DOMRect | null>(null);

  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<
    "move" | "nw" | "ne" | "se" | "sw" | null
  >(null);
  const [dragStart, setDragStart] = useState<
    | {
        mouseX: number;
        mouseY: number;
        rectPx: { x: number; y: number; width: number; height: number };
      }
    | null
  >(null);
  const [pendingRectPx, setPendingRectPx] = useState<
    | { x: number; y: number; width: number; height: number }
    | null
  >(null);

  useLayoutEffect(() => {
    if (!overlayRef.current) {
      setOverlayRect(null);
      return;
    }
    const rect = overlayRef.current.getBoundingClientRect();
    setOverlayRect(rect);
  }, [pageNumber, fields.length, version]);

  const pageFields = fields.filter((f) => f.page === pageNumber - 1);

  const beginDrag = (
    mode: NonNullable<typeof dragMode>,
    fieldId: string,
    rectPx: { x: number; y: number; width: number; height: number },
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    setDraggingFieldId(fieldId);
    setDragMode(mode);
    setDragStart({ mouseX: e.clientX, mouseY: e.clientY, rectPx });
    setPendingRectPx(rectPx);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRect || !dragMode || !dragStart || !pendingRectPx) return;

    const dx = e.clientX - dragStart.mouseX;
    const dy = e.clientY - dragStart.mouseY;

    let { x, y, width, height } = dragStart.rectPx;

    switch (dragMode) {
      case "move": {
        x += dx;
        y += dy;
        break;
      }
      case "se": {
        width = Math.max(8, width + dx);
        height = Math.max(8, height + dy);
        break;
      }
      case "nw": {
        x += dx;
        y += dy;
        width = Math.max(8, width - dx);
        height = Math.max(8, height - dy);
        break;
      }
      case "ne": {
        y += dy;
        width = Math.max(8, width + dx);
        height = Math.max(8, height - dy);
        break;
      }
      case "sw": {
        x += dx;
        width = Math.max(8, width - dx);
        height = Math.max(8, height + dy);
        break;
      }
      default:
        break;
    }

    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + width > overlayRect.width) x = overlayRect.width - width;
    if (y + height > overlayRect.height) y = overlayRect.height - height;

    width = Math.max(8, width);
    height = Math.max(8, height);

    setPendingRectPx({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (!overlayRect || !draggingFieldId || !pendingRectPx) {
      setDragMode(null);
      setDragStart(null);
      setDraggingFieldId(null);
      setPendingRectPx(null);
      return;
    }

    const { x, y, width, height } = pendingRectPx;
    const nx = x / overlayRect.width;
    const ny = y / overlayRect.height;
    const nWidth = width / overlayRect.width;
    const nHeight = height / overlayRect.height;

    onUpdateField(draggingFieldId, {
      x: nx,
      y: ny,
      width: nWidth,
      height: nHeight,
    });

    setDragMode(null);
    setDragStart(null);
    setDraggingFieldId(null);
    setPendingRectPx(null);
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-10 cursor-default"
      onMouseDown={() => {
        onSelectField(null);
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {overlayRect &&
        pageFields.map((field) => {
          const baseLeft = field.x * overlayRect.width;
          const baseTop = field.y * overlayRect.height;
          const baseWidth = field.width * overlayRect.width;
          const baseHeight = field.height * overlayRect.height;

          const isSelected = field.id === selectedFieldId;
          const isHighlighted = highlightKey === field.key;
          const isActiveDrag = draggingFieldId === field.id && pendingRectPx;

          const left = isActiveDrag ? pendingRectPx!.x : baseLeft;
          const top = isActiveDrag ? pendingRectPx!.y : baseTop;
          const width = isActiveDrag ? pendingRectPx!.width : baseWidth;
          const height = isActiveDrag ? pendingRectPx!.height : baseHeight;

          const rawValue = values[field.key];
          const value =
            rawValue == null
              ? ""
              : field.type === "checkbox"
              ? rawValue
                ? "✔"
                : ""
              : String(rawValue);

          const effectiveFontSize = field.style?.fontSize ?? defaultFontSize;
          const effectiveColor = field.style?.color ?? defaultColor;

          return (
            <div
              key={field.id}
              className={`absolute border pointer-events-auto transition-colors duration-150 ${
                isHighlighted
                  ? "border-sky-400 bg-sky-500/10"
                  : isSelected
                  ? "border-amber-400 bg-amber-500/10"
                  : "border-emerald-400 bg-emerald-500/10"
              }`}
              style={{ left, top, width, height }}
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelectField(field.id);
              }}
            >
              {isHighlighted && (
                <div className="absolute -top-4 left-0 text-[10px] px-1 rounded bg-slate-950/90 border border-sky-400/70 text-sky-200 font-mono pointer-events-none">
                  {field.key}
                </div>
              )}
              <div
                className="w-full h-full flex items-center justify-start px-1 text-[11px] overflow-hidden"
                style={{
                  color: effectiveColor,
                  fontSize: effectiveFontSize * 0.8,
                }}
              >
                {value}
              </div>

              {isSelected && (
                <>
                  <div
                    className="absolute inset-0 cursor-move"
                    onMouseDown={(e) =>
                      beginDrag(
                        "move",
                        field.id,
                        { x: left, y: top, width, height },
                        e
                      )
                    }
                  />
                  <div
                    className="absolute w-2 h-2 -left-1 -top-1 bg-sky-300 border border-slate-900 rounded-full cursor-nwse-resize"
                    onMouseDown={(e) =>
                      beginDrag(
                        "nw",
                        field.id,
                        { x: left, y: top, width, height },
                        e
                      )
                    }
                  />
                  <div
                    className="absolute w-2 h-2 -right-1 -top-1 bg-sky-300 border border-slate-900 rounded-full cursor-nesw-resize"
                    onMouseDown={(e) =>
                      beginDrag(
                        "ne",
                        field.id,
                        { x: left, y: top, width, height },
                        e
                      )
                    }
                  />
                  <div
                    className="absolute w-2 h-2 -left-1 -bottom-1 bg-sky-300 border border-slate-900 rounded-full cursor-nesw-resize"
                    onMouseDown={(e) =>
                      beginDrag(
                        "sw",
                        field.id,
                        { x: left, y: top, width, height },
                        e
                      )
                    }
                  />
                  <div
                    className="absolute w-2 h-2 -right-1 -bottom-1 bg-sky-300 border border-slate-900 rounded-full cursor-nwse-resize"
                    onMouseDown={(e) =>
                      beginDrag(
                        "se",
                        field.id,
                        { x: left, y: top, width, height },
                        e
                      )
                    }
                  />
                </>
              )}
            </div>
          );
        })}
    </div>
  );
}
