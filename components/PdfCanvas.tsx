"use client";

import { useEffect, useRef, useState } from "react";
import FieldOverlayFixed from "@/components/FieldOverlayFixed";
import { useTemplateStore } from "@/store/templateStore";
import type { PdfField } from "@/types/pdf";
import { detectFormFieldsFromPdf } from "@/lib/pdfFormDetection";

function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

interface PdfCanvasProps {
    className?: string;
    enableAutoDetect?: boolean;
}

export default function PdfCanvas({ className, enableAutoDetect = true }: PdfCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const renderTaskRef = useRef<any>(null);
    const [canvasVersion, setCanvasVersion] = useState(0);
    const [fileInputKey, setFileInputKey] = useState(0);
    const [pdfjs, setPdfjs] = useState<any | null>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null); // 'any' at the boundary for pdf.js
    const [pageNumber, setPageNumber] = useState(1);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const setCurrentPdf = useTemplateStore((state) => state.setCurrentPdf);
    const setCurrentFields = useTemplateStore((state) => state.setCurrentFields);
    const clearCurrent = useTemplateStore((state) => state.clearCurrent);
    const currentPdfDataBase64 = useTemplateStore((state) => state.currentPdfDataBase64);

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
                console.error("Failed to load pdfjs-dist", err);
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
            const arrayBuffer = await file.arrayBuffer();

            let autoFields: PdfField[] = [];
            if (pdfjs && enableAutoDetect) {
                autoFields = await detectFormFieldsFromPdf(arrayBuffer, pdfjs);
            }

            setCurrentPdf(arrayBuffer, file.name);

            if (enableAutoDetect && autoFields.length > 0) {
                setCurrentFields(autoFields);
            } else {
                setCurrentFields([]);
            }
        } catch (err) {
            console.error(err);
            setErrorMessage("Failed to load PDF. Check the console for details.");
        }
    };

    // Load PDF from file input
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
        clearCurrent();
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

    // Load or reload PDF whenever the stored base64 data changes
    useEffect(() => {
        const loadFromStore = async () => {
            if (!pdfjs || !currentPdfDataBase64) {
                if (!currentPdfDataBase64) {
                    console.log("[PdfCanvas] TODO remove debug: clearing PDF state (no currentPdfDataBase64)");
                    setPdfDoc(null);
                    setNumPages(null);
                    setPageNumber(1);
                    // Clear the rendered canvas and reset the file input
                    if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext("2d");
                        if (ctx) {
                            // Reset canvas back to a small placeholder size
                            canvasRef.current.width = 1;
                            canvasRef.current.height = 1;
                            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                        }
                    }
                    setFileInputKey((k) => k + 1);
                }
                return;
            }

            setIsLoading(true);
            try {
                console.log("[PdfCanvas] TODO remove debug: loading PDF from store", {
                    base64Length: currentPdfDataBase64.length,
                });
                const bytes = base64ToUint8Array(currentPdfDataBase64);
                const loadingTask = pdfjs.getDocument({ data: bytes });
                const pdf = await loadingTask.promise;
                console.log("[PdfCanvas] TODO remove debug: loaded PDF", {
                    numPages: pdf.numPages,
                });
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

        loadFromStore();
    }, [currentPdfDataBase64, pdfjs]);

    // Render the current page whenever pdfDoc or pageNumber changes
    useEffect(() => {
        const renderPage = async () => {
            if (!pdfDoc || !canvasRef.current) return;

            // Cancel any in-flight render on this canvas
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

            // Set canvas size to match the page
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // pdf.js RenderParameters now expects a `canvas` field as well.
            // We'll include it explicitly. If TS is still cranky, we can cast to `any`.
            const renderContext = {
                canvasContext: context,
                viewport,
                canvas,
            } as any;
            const task = page.render(renderContext);
            renderTaskRef.current = task;
            console.log("[PdfCanvas] TODO remove debug: rendering page", { pageNumber });
            await task.promise;
            // clear reference once done
            if (renderTaskRef.current === task) {
                renderTaskRef.current = null;
            }

            // Bump a version so overlay re-renders with correct dimensions
            setCanvasVersion((v) => v + 1);
        };

        renderPage().catch((err) => {
            // Ignore cancellations; surface real errors
            if (!(err && typeof err === "object" && "name" in err && (err as any).name === "RenderingCancelledException")) {
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
        <div className={className}>
            {/* File uploader */}
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-200 cursor-pointer">
                        <span>Upload PDF</span>
                        <span className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white shadow-sm">
                            Browse…
                        </span>
                        <input
                            key={fileInputKey}
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                            className="hidden"
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
                                setPageNumber((p) =>
                                    numPages ? Math.min(numPages, p + 1) : p
                                )
                            }
                            disabled={numPages != null && pageNumber >= numPages}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* Status / errors */}
            {isLoading && (
                <p className="text-xs text-sky-400 mb-2">Loading PDF…</p>
            )}
            {errorMessage && (
                <p className="text-xs text-red-400 mb-2">{errorMessage}</p>
            )}

            {/* Canvas area / drag-and-drop target */}
            <div
                    className={`border rounded-md bg-slate-950 min-h-[200px] flex items-center justify-center overflow-auto ${
                    isDragOver ? "border-sky-500 bg-slate-900/80" : "border-slate-800"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="relative inline-block">
                    <canvas ref={canvasRef} className="block" />
                    {!pdfDoc && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="flex flex-col items-center justify-center text-xs text-slate-400 text-center space-y-1 min-w-[400px] max-w-[60%]">
                                <p>Drag and drop a PDF here</p>
                                <p>or use the Browse button above.</p>
                            </div>
                        </div>
                    )}
                    {/* Only show overlay when a PDF is loaded */}
                    {pdfDoc && (
                        <FieldOverlayFixed
                            pageNumber={pageNumber}
                            key={canvasVersion}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
