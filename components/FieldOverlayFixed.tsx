"use client";

import { useRef, useState, useLayoutEffect } from "react";
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

type EditDragMode = "move" | "nw" | "ne" | "se" | "sw" | null;

export default function FieldOverlayFixed({ pageNumber }: FieldOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const currentFields = useTemplateStore((state) => state.currentFields);
  const addCurrentField = useTemplateStore((state) => state.addCurrentField);
  const updateCurrentField = useTemplateStore(
    (state) => state.updateCurrentField
  );

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

  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<PdfFieldType>("text");

  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const [editDragMode, setEditDragMode] = useState<EditDragMode>(null);
  const [editDragStart, setEditDragStart] = useState<
    | {
        mouseX: number;
        mouseY: number;
        rectPx: { x: number; y: number; width: number; height: number };
      }
    | null
  >(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;

    // If a popup is open (new or editing), clicking elsewhere cancels it
    if (pendingRectPx || editingFieldId) {
      handleCancelNewField();
      return;
    }

    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);
    setStart({ x, y });
    setCurrent({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // If we're adjusting an existing box, update pending rect based on drag
    if (editDragMode && editDragStart && overlayRect && pendingRectPx) {
      const dx = e.clientX - editDragStart.mouseX;
      const dy = e.clientY - editDragStart.mouseY;

      let { x, y, width, height } = editDragStart.rectPx;

      switch (editDragMode) {
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

      // Clamp to overlay bounds
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x + width > overlayRect.width) x = overlayRect.width - width;
      if (y + height > overlayRect.height) y = overlayRect.height - height;
      width = Math.max(8, width);
      height = Math.max(8, height);

      const newPx = { x, y, width, height };
      const newNorm: NormRect = {
        x: x / overlayRect.width,
        y: y / overlayRect.height,
        width: width / overlayRect.width,
        height: height / overlayRect.height,
      };

      setPendingRectPx(newPx);
      setPendingRectNorm(newNorm);
      return;
    }

    if (!isDragging || !overlayRef.current || !start || pendingRectPx) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrent({ x, y });
  };

  const handleMouseUp = () => {
    if (editDragMode) {
      setEditDragMode(null);
      setEditDragStart(null);
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
      setEditingFieldId(null);
    }

    setIsDragging(false);
    setStart(null);
    setCurrent(null);
  };

  const handleConfirmNewField = () => {
    if (!pendingRectNorm) {
      setPendingRectPx(null);
      setPendingRectNorm(null);
      setEditingFieldId(null);
      return;
    }

    const id = uuidv4();
    const generatedKey = `field_${id.slice(0, 6)}`;
    const finalKey = newKey.trim() || generatedKey;

    if (editingFieldId) {
      // Update existing field
      updateCurrentField(editingFieldId, {
        key: finalKey,
        type: newType || "text",
        x: pendingRectNorm.x,
        y: pendingRectNorm.y,
        width: pendingRectNorm.width,
        height: pendingRectNorm.height,
      });
    } else {
      // Create new field
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
    }

    setPendingRectPx(null);
    setPendingRectNorm(null);
    setNewKey("");
    setNewType("text");
    setEditingFieldId(null);
  };

  const handleCancelNewField = () => {
    setPendingRectPx(null);
    setPendingRectNorm(null);
    setNewKey("");
    setNewType("text");
    setEditingFieldId(null);
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

  // Measure overlay rect after layout so we have real dimensions
  const [overlayRect, setOverlayRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!overlayRef.current) {
      setOverlayRect(null);
      return;
    }
    const rect = overlayRef.current.getBoundingClientRect();
    setOverlayRect(rect);
  }, [pageNumber, currentFields.length]);

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

  const beginEditField = (field: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    key: string;
    type: PdfFieldType;
  }) => {
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
    setNewKey(field.key);
    setNewType(field.type);
  };

  const beginEditDrag = (
    mode: Exclude<EditDragMode, null>,
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    if (!pendingRectPx) return;
    e.stopPropagation();
    setEditDragMode(mode);
    setEditDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      rectPx: { ...pendingRectPx },
    });
  };

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
        currentFields
          .filter((field) => field.page === pageNumber - 1)
          .map((field) => {
            console.log("[FieldOverlayFixed] render field", {
              id: field.id,
              page: field.page,
              x: field.x,
              y: field.y,
              width: field.width,
              height: field.height,
            });
            const left = field.x * overlayRect.width;
            const top = field.y * overlayRect.height;
            const width = field.width * overlayRect.width;
            const height = field.height * overlayRect.height;

            return (
              <div
                key={field.id}
                className="absolute border border-emerald-400/80 bg-emerald-500/10 cursor-pointer"
                style={{ left, top, width, height }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  beginEditField(field as any);
                }}
              >
                <div className="absolute -top-4 left-0 text-[10px] px-1 rounded bg-slate-950/90 border border-emerald-500/60 text-emerald-300 font-mono pointer-events-none">
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
          {/* Move and resize handles for the active box */}
          <div
            className="absolute inset-0 cursor-move"
            onMouseDown={(e) => beginEditDrag("move", e)}
          />
          <div
            className="absolute w-2 h-2 -left-1 -top-1 bg-sky-300 border border-slate-900 rounded-full cursor-nwse-resize"
            onMouseDown={(e) => beginEditDrag("nw", e)}
          />
          <div
            className="absolute w-2 h-2 -right-1 -top-1 bg-sky-300 border border-slate-900 rounded-full cursor-nesw-resize"
            onMouseDown={(e) => beginEditDrag("ne", e)}
          />
          <div
            className="absolute w-2 h-2 -left-1 -bottom-1 bg-sky-300 border border-slate-900 rounded-full cursor-nesw-resize"
            onMouseDown={(e) => beginEditDrag("sw", e)}
          />
          <div
            className="absolute w-2 h-2 -right-1 -bottom-1 bg-sky-300 border border-slate-900 rounded-full cursor-nwse-resize"
            onMouseDown={(e) => beginEditDrag("se", e)}
          />
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
