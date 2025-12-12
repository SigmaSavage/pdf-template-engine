"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { PdfFieldStyle } from "@/types/pdf";

export interface OneOffField {
  id: string;
  page: number; // zero-based
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  style?: PdfFieldStyle;
}

interface OneOffOverlayProps {
  pageNumber: number; // 1-based page index
  fields: OneOffField[];
  onFieldsChange: (fields: OneOffField[]) => void;
  defaultFontSize: number;
  defaultColor: string;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
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

export default function OneOffOverlay({
  pageNumber,
  fields,
  onFieldsChange,
  defaultFontSize,
  defaultColor,
  selectedFieldId,
  onSelectField,
}: OneOffOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [overlayRect, setOverlayRect] = useState<DOMRect | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [start, setStart] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);

  const [pendingRectPx, setPendingRectPx] = useState<
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | null
  >(null);
  const [pendingRectNorm, setPendingRectNorm] = useState<NormRect | null>(
    null
  );
  const [pendingValue, setPendingValue] = useState<string>("");
  const [pendingFontSize, setPendingFontSize] = useState<string>("");
  const [pendingColor, setPendingColor] = useState<string>("");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

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
  const [dragRectPx, setDragRectPx] = useState<
    | { x: number; y: number; width: number; height: number }
    | null
  >(null);
  const [didDrag, setDidDrag] = useState(false);

  useLayoutEffect(() => {
    if (!overlayRef.current) {
      setOverlayRect(null);
      return;
    }
    const rect = overlayRef.current.getBoundingClientRect();
    setOverlayRect(rect);
  }, [pageNumber, fields.length]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;

    // If a popup is open, clicking elsewhere cancels it
    if (pendingRectPx) {
      resetPending();
      return;
    }

    onSelectField(null);

    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);
    setStart({ x, y });
    setCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (overlayRect && dragMode && dragStart && dragRectPx) {
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

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setDidDrag(true);
      }

      setDragRectPx({ x, y, width, height });
      return;
    }

    if (!isDragging || !overlayRef.current || !start || pendingRectPx) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (overlayRect && draggingFieldId && dragRectPx) {
      if (dragMode === "move" && !didDrag) {
        const field = fields.find((f) => f.id === draggingFieldId);
        if (field) {
          beginEditField(field);
        }
      } else {
        const { x, y, width, height } = dragRectPx;
        const nx = x / overlayRect.width;
        const ny = y / overlayRect.height;
        const nWidth = width / overlayRect.width;
        const nHeight = height / overlayRect.height;

        onFieldsChange(
          fields.map((f) =>
            f.id === draggingFieldId
              ? { ...f, x: nx, y: ny, width: nWidth, height: nHeight }
              : f
          )
        );
      }

      setDragMode(null);
      setDragStart(null);
      setDraggingFieldId(null);
      setDragRectPx(null);
      setDidDrag(false);
      return;
    }

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
      const nx = x1 / rect.width;
      const ny = y1 / rect.height;
      const nWidth = width / rect.width;
      const nHeight = height / rect.height;

      setPendingRectNorm({ x: nx, y: ny, width: nWidth, height: nHeight });
      setPendingRectPx({ x: x1, y: y1, width, height });
      setPendingValue("");
      setPendingFontSize(String(defaultFontSize));
      setPendingColor(defaultColor);
      setEditingFieldId(null);
    }

    setIsDragging(false);
    setStart(null);
    setCurrent(null);
  };

  const resetPending = () => {
    setPendingRectPx(null);
    setPendingRectNorm(null);
    setPendingValue("");
    setPendingFontSize("");
    setPendingColor("");
    setEditingFieldId(null);
  };

  const handleConfirm = () => {
    if (!pendingRectNorm) {
      resetPending();
      return;
    }

    let style: PdfFieldStyle | undefined;
    const size = parseFloat(pendingFontSize);
    const hasSize = !Number.isNaN(size) && Number.isFinite(size);
    const hasColor = pendingColor.trim().length > 0;

    if (hasSize || hasColor) {
      style = {};
      if (hasSize) {
        style.fontSize = size;
      }
      if (hasColor) {
        style.color = pendingColor.trim();
      }
    }

    const base: OneOffField = {
      id: editingFieldId || uuidv4(),
      page: pageNumber - 1,
      x: pendingRectNorm.x,
      y: pendingRectNorm.y,
      width: pendingRectNorm.width,
      height: pendingRectNorm.height,
      value: pendingValue,
      ...(style ? { style } : {}),
    };

    if (editingFieldId) {
      onFieldsChange(
        fields.map((f) => (f.id === editingFieldId ? { ...f, ...base } : f))
      );
    } else {
      onFieldsChange([...fields, base]);
    }

    resetPending();
  };

  const handleDelete = () => {
    if (!editingFieldId) {
      resetPending();
      return;
    }
    onFieldsChange(fields.filter((f) => f.id !== editingFieldId));
    resetPending();
  };

  const beginEditField = (field: OneOffField) => {
    if (!overlayRect) return;

    const left = field.x * overlayRect.width;
    const top = field.y * overlayRect.height;
    const width = field.width * overlayRect.width;
    const height = field.height * overlayRect.height;

    setEditingFieldId(field.id);
    setPendingRectNorm({
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
    });
    setPendingRectPx({ x: left, y: top, width, height });
    setPendingValue(field.value);
    setPendingFontSize(
      field.style?.fontSize != null
        ? String(field.style.fontSize)
        : String(defaultFontSize)
    );
    setPendingColor(field.style?.color ?? defaultColor);
    onSelectField(field.id);
  };

  const beginDrag = (
    mode: NonNullable<typeof dragMode>,
    fieldId: string,
    rectPx: { x: number; y: number; width: number; height: number },
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    setDraggingFieldId(fieldId);
    onSelectField(fieldId);
    setDragMode(mode);
    setDragStart({ mouseX: e.clientX, mouseY: e.clientY, rectPx });
    setDragRectPx(rectPx);
    setDidDrag(false);
  };

  // Drag preview while drawing
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

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 cursor-crosshair z-10"
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
        fields
          .filter((field) => field.page === pageNumber - 1)
          .map((field) => {
            const baseLeft = field.x * overlayRect.width;
            const baseTop = field.y * overlayRect.height;
            const baseWidth = field.width * overlayRect.width;
            const baseHeight = field.height * overlayRect.height;

            const isActiveDrag = draggingFieldId === field.id && dragRectPx;
            const isSelected = field.id === selectedFieldId;

            const left = isActiveDrag ? dragRectPx!.x : baseLeft;
            const top = isActiveDrag ? dragRectPx!.y : baseTop;
            const width = isActiveDrag ? dragRectPx!.width : baseWidth;
            const height = isActiveDrag ? dragRectPx!.height : baseHeight;

            return (
              <div
                key={field.id}
                className={`absolute border cursor-pointer overflow-hidden pointer-events-auto transition-colors duration-150 ${
                  isSelected
                    ? "border-amber-400 bg-amber-500/10"
                    : "border-emerald-400 bg-emerald-500/10"
                }`}
                style={{ left, top, width, height }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  beginEditField(field);
                }}
              >
                {field.value && (
                  <div
                    className="w-full h-full flex items-center justify-start px-1 leading-snug break-words"
                    style={{
                      fontSize:
                        field.style?.fontSize != null
                          ? `${field.style.fontSize}px`
                          : "14px",
                      color: field.style?.color || "#000000",
                    }}
                  >
                    {field.value}
                  </div>
                )}

                {/* Drag/resize affordances similar to fill mode */}
                <div
                  className="absolute inset-0 cursor-move"
                  onMouseDown={(e) =>
                    beginDrag("move", field.id, { x: left, y: top, width, height }, e)
                  }
                />
                <div
                  className="absolute w-2 h-2 -left-1 -top-1 bg-sky-300 border border-slate-900 rounded-full cursor-nwse-resize"
                  onMouseDown={(e) =>
                    beginDrag("nw", field.id, { x: left, y: top, width, height }, e)
                  }
                />
                <div
                  className="absolute w-2 h-2 -right-1 -top-1 bg-sky-300 border border-slate-900 rounded-full cursor-nesw-resize"
                  onMouseDown={(e) =>
                    beginDrag("ne", field.id, { x: left, y: top, width, height }, e)
                  }
                />
                <div
                  className="absolute w-2 h-2 -right-1 -bottom-1 bg-sky-300 border border-slate-900 rounded-full cursor-nwse-resize"
                  onMouseDown={(e) =>
                    beginDrag("se", field.id, { x: left, y: top, width, height }, e)
                  }
                />
                <div
                  className="absolute w-2 h-2 -left-1 -bottom-1 bg-sky-300 border border-slate-900 rounded-full cursor-nesw-resize"
                  onMouseDown={(e) =>
                    beginDrag("sw", field.id, { x: left, y: top, width, height }, e)
                  }
                />
              </div>
            );
          })}

      {/* New / edit field prompt overlay at the pending rect */}
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
          >
            <div className="flex flex-col gap-1">
              <input
                className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] min-w-[160px] focus:outline-none focus:border-sky-500"
                placeholder="Text to render in this box"
                value={pendingValue}
                onChange={(e) => setPendingValue(e.target.value)}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[10px] text-slate-300">
                  <span>Size</span>
                  <input
                    type="number"
                    min={6}
                    max={72}
                    className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] focus:outline-none focus:border-sky-500"
                    value={pendingFontSize}
                    onChange={(e) => setPendingFontSize(e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-1 text-[10px] text-slate-300">
                  <span>Color</span>
                  <input
                    type="color"
                    className="w-6 h-4 border border-slate-700 rounded bg-slate-900"
                    value={pendingColor || "#000000"}
                    onChange={(e) => setPendingColor(e.target.value)}
                  />
                </label>
              </div>
            </div>
            <button
              type="button"
              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-medium"
              onClick={handleConfirm}
            >
              Save
            </button>
            <button
              type="button"
              className="px-1 py-0.5 text-[11px] text-slate-400 hover:text-slate-200"
              onClick={resetPending}
            >
              Cancel
            </button>
            {editingFieldId && (
              <button
                type="button"
                className="px-1 py-0.5 text-[11px] text-red-400 hover:text-red-300"
                onClick={handleDelete}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
