"use client";

import { useEffect, useRef, useState } from "react";

interface TemplateThumbnailProps {
  pdfDataBase64: string;
  className?: string;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function TemplateThumbnail({
  pdfDataBase64,
  className,
}: TemplateThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfjs, setPdfjs] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadPdfJs = async () => {
      if (typeof window === "undefined") return;
      try {
        const lib: any = await import("pdfjs-dist/build/pdf");
        lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`;
        if (isMounted) {
          setPdfjs(lib);
        }
      } catch (err) {
        console.error("Failed to load pdfjs-dist for thumbnail", err);
      }
    };
    loadPdfJs();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const renderThumb = async () => {
      if (!pdfjs || !canvasRef.current || !pdfDataBase64) return;
      try {
        const bytes = base64ToUint8Array(pdfDataBase64);
        const loadingTask = pdfjs.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.4 });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: ctx,
          viewport,
          canvas,
        } as any;
        await page.render(renderContext).promise;
      } catch (err) {
        console.warn("Failed to render thumbnail", err);
      }
    };

    renderThumb();
  }, [pdfjs, pdfDataBase64]);

  return (
    <div
      className={
        className ??
        "w-24 h-32 border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden"
      }
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
