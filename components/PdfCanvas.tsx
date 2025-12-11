"use client";

import { useEffect, useRef, useState } from "react";
import FieldOverlayFixed from "@/components/FieldOverlayFixed";
import { useTemplateStore } from "@/store/templateStore";
import type { PdfField, PdfFieldType } from "@/types/pdf";

function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Best-effort detection of AcroForm fields using pdf.js annotations.
// If anything fails, this simply returns an empty array and manual field
// drawing still works as before.
async function detectFormFieldsFromPdf(
    data: ArrayBuffer,
    pdfjs: any
): Promise<PdfField[]> {
    try {
        if (!pdfjs || typeof pdfjs.getDocument !== "function") {
            return [];
        }

        const bytes = new Uint8Array(data);
        const loadingTask = pdfjs.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        const results: PdfField[] = [];

        for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
            const page = await pdf.getPage(pageIndex + 1);
            const annotations = await page.getAnnotations();
            const viewport = page.getViewport({ scale: 1 });
            const pageWidth = viewport.width;
            const pageHeight = viewport.height;

            for (const annot of annotations as any[]) {
                if (!annot) continue;
                if (annot.subtype !== "Widget") continue;
                if (!annot.fieldName || !annot.rect) continue;

                const rect = annot.rect as number[];
                if (rect.length !== 4) continue;
                const [x1, y1, x2, y2] = rect;
                const w = x2 - x1;
                const h = y2 - y1;
                if (w <= 0 || h <= 0) continue;

                // Convert from PDF bottom-left origin to overlay's top-left
                // normalized coordinates.
                const normX = x1 / pageWidth;
                const normY = (pageHeight - y2) / pageHeight;
                const normW = w / pageWidth;
                const normH = h / pageHeight;

                let type: PdfFieldType = "text";
                const fieldType = (annot.fieldType || "").toString();
                if (fieldType === "Btn") {
                    // Treat button-type fields as checkboxes by default.
                    type = "checkbox";
                }

                const key = String(annot.fieldName);

                results.push({
                    id: `auto_${pageIndex + 1}_${results.length}`,
                    page: pageIndex,
                    x: normX,
                    y: normY,
                    width: normW,
                    height: normH,
                    key,
                    type,
                });
            }
        }

        console.log("[PdfCanvas] TODO remove debug: auto-detected form fields", {
            count: results.length,
        });
        return results;
    } catch (err) {
        console.warn("[PdfCanvas] auto-detect form fields failed", err);
        return [];
    }
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

    const setCurrentPdf = useTemplateStore((state) => state.setCurrentPdf);
    const setCurrentFields = useTemplateStore((state) => state.setCurrentFields);
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

    // Load PDF from file input
    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type !== "application/pdf") {
            setErrorMessage("Please upload a PDF file.");
            return;
        }

        setErrorMessage(null);

        try {
            const arrayBuffer = await file.arrayBuffer();

            // Use a copy of the buffer for auto-detection so the original
            // remains intact for storage/encoding.
            let autoFields: PdfField[] = [];
            if (pdfjs && enableAutoDetect) {
                const detectionBuffer = arrayBuffer.slice(0);
                autoFields = await detectFormFieldsFromPdf(
                    detectionBuffer,
                    pdfjs
                );
            }

            // Save PDF in global store so templates can use it; PdfCanvas will
            // react to currentPdfDataBase64 and load the document.
            setCurrentPdf(arrayBuffer, file.name);

            // If we found auto fields and auto-detect is enabled, use them;
            // otherwise start from a blank field set.
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
                <label className="text-sm font-medium text-slate-200">
                    Upload PDF
                    <input
                        key={fileInputKey}
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        className="block mt-1 text-xs text-slate-300"
                    />
                </label>

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

            {/* Canvas area */}
            <div className="border border-slate-800 rounded-md bg-slate-950 flex items-center justify-center overflow-auto">
                <div className="relative inline-block">
                    <canvas ref={canvasRef} className="block" />
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
