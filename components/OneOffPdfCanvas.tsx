"use client";

import { useEffect, useRef, useState } from "react";
import OneOffOverlay, { OneOffField } from "@/components/OneOffOverlay";
import { detectFormFieldsFromPdf } from "@/lib/pdfFormDetection";

function isLikelyPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  // PDF spec only requires the header to appear within the first 1KB,
  // so scan a small window instead of assuming offset 0.
  const max = Math.min(bytes.length - 4, 1024);
  for (let i = 0; i <= max; i++) {
    if (
      bytes[i] === 0x25 && // '%'
      bytes[i + 1] === 0x50 && // 'P'
      bytes[i + 2] === 0x44 && // 'D'
      bytes[i + 3] === 0x46 && // 'F'
      bytes[i + 4] === 0x2d // '-'
    ) {
      return true;
    }
  }
  return false;
}

async function detectFormFieldsForOneOff(
  bytes: Uint8Array,
  pdfjs: any
): Promise<OneOffField[]> {
  const pdfFields = await detectFormFieldsFromPdf(bytes, pdfjs);
  return pdfFields.map((f, index) => ({
    id: f.id ?? `auto_${f.page + 1}_${index}`,
    page: f.page,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    value: "",
    // one-off flow doesn't care about keys/types; user just sees boxes
  }));
}

interface OneOffPdfCanvasProps {
  fields: OneOffField[];
  onFieldsChange: (fields: OneOffField[]) => void;
  onPdfBytesChange: (bytes: Uint8Array | null, fileName: string | null) => void;
  defaultFontSize: number;
  defaultColor: string;
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
}

export default function OneOffPdfCanvas({
  fields,
  onFieldsChange,
  onPdfBytesChange,
  defaultFontSize,
  defaultColor,
  selectedFieldId,
  onSelectField,
}: OneOffPdfCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [pdfjs, setPdfjs] = useState<any | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

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
          console.log("[OneOffPdfCanvas] TODO remove debug: pdfjs loaded", {
            version: lib.version,
          });
        }
      } catch (err) {
        console.error("Failed to load pdfjs-dist for OneOffPdfCanvas", err);
      }
    };

    loadPdfJs();

    return () => {
      isMounted = false;
    };
  }, []);

  const processFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      setErrorMessage("Please upload a PDF file.");
      return;
    }

    setErrorMessage(null);

    try {
      console.log("[OneOffPdfCanvas] TODO remove debug: file selected", {
        name: file.name,
        type: file.type,
        size: file.size,
        hasPdfjs: !!pdfjs,
      });

      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      if (!isLikelyPdf(uint8)) {
        setErrorMessage("This file does not look like a valid PDF.");
        return;
      }
      onPdfBytesChange(uint8, file.name);

      if (!pdfjs) {
        console.warn(
          "[OneOffPdfCanvas] TODO remove debug: pdfjs not ready, skipping auto-detect"
        );
        return;
      }

      setIsLoading(true);
      const detectionBytes = new Uint8Array(uint8.length);
      detectionBytes.set(uint8);

      const autoFields = await detectFormFieldsForOneOff(detectionBytes, pdfjs);
      console.log("[OneOffPdfCanvas] TODO remove debug: auto-detect result", {
        detectedCount: autoFields.length,
      });
      if (autoFields.length > 0) {
        onFieldsChange(autoFields);
      } else {
        onFieldsChange([]);
      }

      const loadingTask = pdfjs.getDocument({ data: uint8 });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setPageNumber(1);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to load PDF. Check the console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
    event.target.value = "";
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const handleClear = () => {
    onPdfBytesChange(null, null);
    onFieldsChange([]);
    setPdfDoc(null);
    setNumPages(null);
    setPageNumber(1);
    setErrorMessage(null);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = 1;
        canvasRef.current.height = 1;
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Render the current page whenever pdfDoc or pageNumber changes
  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      if (renderTaskRef.current && typeof renderTaskRef.current.cancel === "function") {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancel errors
        }
      }

      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });

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
        // Bump version so the overlay remounts and measures the
        // final canvas dimensions after rendering.
        setCanvasVersion((v) => v + 1);
      }
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
        setErrorMessage("Failed to render PDF page.");
      }
    });

    return () => {
      if (renderTaskRef.current && typeof renderTaskRef.current.cancel === "function") {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancel errors
        }
      }
    };
  }, [pdfDoc, pageNumber]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-200 cursor-pointer">
            <span>Upload PDF</span>
            <span className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow-sm disabled:opacity-50">
              Browse…
            </span>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={!pdfjs || isLoading}
            />
          </label>
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-1.5 rounded border border-slate-600 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Clear
          </button>
        </div>

        {numPages && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
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
        <p className="text-xs text-sky-400 mb-2">Loading PDF…</p>
      )}
      {errorMessage && (
        <p className="text-xs text-red-400 mb-2">{errorMessage}</p>
      )}

      <div
        className={`border rounded-md bg-slate-950 min-h-[160px] flex items-center justify-center overflow-auto ${
          isDragOver ? "border-sky-500 bg-slate-900/80" : "border-slate-800"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="block" />
          {!pdfDoc && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-slate-400 pointer-events-none">
              <p>Drag and drop a PDF here</p>
              <p>or use the Browse button above.</p>
            </div>
          )}
          {pdfDoc && (
            <OneOffOverlay
              key={canvasVersion}
              pageNumber={pageNumber}
              fields={fields}
              onFieldsChange={onFieldsChange}
              defaultFontSize={defaultFontSize}
              defaultColor={defaultColor}
              selectedFieldId={selectedFieldId}
              onSelectField={onSelectField}
            />
          )}
        </div>
      </div>
    </div>
  );
}
