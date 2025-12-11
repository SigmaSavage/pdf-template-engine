"use client";

import { useEffect, useRef, useState } from "react";
import type { PdfField, PdfTemplate } from "@/types/pdf";
import FillOverlay from "@/components/FillOverlay";

type ValueMap = Record<string, string | number | boolean>;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface FillPreviewCanvasProps {
  template: PdfTemplate;
  fields: PdfField[];
  values: ValueMap;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  defaultFontSize: number;
  defaultColor: string;
  highlightKey: string | null;
  onUpdateField: (id: string, patch: Partial<PdfField>) => void;
}

export default function FillPreviewCanvas({
  template,
  fields,
  values,
  selectedFieldId,
  onSelectField,
  defaultFontSize,
  defaultColor,
  highlightKey,
  onUpdateField,
}: FillPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [pdfjs, setPdfjs] = useState<any | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [overlayVersion, setOverlayVersion] = useState(0);

  // Load pdf.js dynamically on the client and configure its worker
  useEffect(() => {
    let isMounted = true;

    const loadPdfJs = async () => {
      if (typeof window === "undefined") return;
      try {
        const lib: any = await import("pdfjs-dist/build/pdf");
        lib.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`;
        if (isMounted) {
          setPdfjs(lib);
        }
      } catch (err) {
        console.error("Failed to load pdfjs-dist for FillPreviewCanvas", err);
      }
    };

    loadPdfJs();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load PDF from template when pdfjs or template changes
  useEffect(() => {
    const loadFromTemplate = async () => {
      if (!pdfjs || !template.pdfDataBase64) {
        setPdfDoc(null);
        setNumPages(null);
        setPageNumber(1);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        const bytes = base64ToUint8Array(template.pdfDataBase64);
        const loadingTask = pdfjs.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setPageNumber(1);
      } catch (err) {
        console.error("Failed to load PDF for FillPreviewCanvas", err);
        setErrorMessage("Failed to load PDF for preview.");
      } finally {
        setIsLoading(false);
      }
    };

    loadFromTemplate();
  }, [pdfjs, template.id, template.pdfDataBase64]);

  // Render the current page whenever pdfDoc or pageNumber changes
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      if (renderTaskRef.current && typeof renderTaskRef.current.cancel === "function") {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }

      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.3 });

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport,
        canvas,
      } as any;

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
      if (renderTaskRef.current === task) {
        renderTaskRef.current = null;
      }
      // bump version so overlay can re-measure after canvas size changes
      setOverlayVersion((v) => v + 1);
    };

    renderPage().catch((err) => {
      if (
        !(
          err &&
          typeof err === "object" &&
          "name" in err &&
          (err as any).name === "RenderingCancelledException"
        )
      ) {
        console.error(err);
        setErrorMessage("Failed to render preview page.");
      }
    });

    return () => {
      if (renderTaskRef.current && typeof renderTaskRef.current.cancel === "function") {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNumber]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
        <span>Live PDF preview</span>
        {numPages && numPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
            >
              Prev
            </button>
            <span>
              Page {pageNumber} / {numPages}
            </span>
            <button
              className="px-2 py-1 border border-slate-700 rounded disabled:opacity-40"
              onClick={() =>
                setPageNumber((p) => (numPages ? Math.min(numPages, p + 1) : p))
              }
              disabled={numPages != null && pageNumber >= numPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <p className="text-[11px] text-sky-400 mb-1">Loading PDF…</p>
      )}
      {errorMessage && (
        <p className="text-[11px] text-red-400 mb-1">{errorMessage}</p>
      )}

      <div className="flex-1 border border-slate-800 rounded-md bg-slate-950 flex items-start justify-center overflow-auto">
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="block" />
          {pdfDoc && (
            <FillOverlay
              pageNumber={pageNumber}
              fields={fields}
              values={values}
              selectedFieldId={selectedFieldId}
              onSelectField={onSelectField}
              defaultFontSize={defaultFontSize}
              defaultColor={defaultColor}
              highlightKey={highlightKey}
              version={overlayVersion}
              onUpdateField={onUpdateField}
            />
          )}
        </div>
      </div>
    </div>
  );
}
