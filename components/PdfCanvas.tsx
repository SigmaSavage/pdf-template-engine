"use client";

import { useEffect, useRef, useState } from "react";

import * as pdfjsLib from "pdfjs-dist/build/pdf";
import FieldOverlay from "@/components/FieldOverlay";
import { useTemplateStore } from "@/store/templateStore";


// Configure worker to always match the installed pdfjs-dist version
pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;


interface PdfCanvasProps {
    className?: string;
}

export default function PdfCanvas({ className }: PdfCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null); // 'any' at the boundary for pdf.js
    const [pageNumber, setPageNumber] = useState(1);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const setCurrentPdf = useTemplateStore((state) => state.setCurrentPdf);

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
        setIsLoading(true);

        try {
            const arrayBuffer = await file.arrayBuffer();
            // Save PDF in global store so templates can use it
            setCurrentPdf(arrayBuffer, file.name);
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
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

    // Render the current page whenever pdfDoc or pageNumber changes
    useEffect(() => {
        const renderPage = async () => {
            if (!pdfDoc || !canvasRef.current) return;

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

            await page.render(renderContext).promise;
        };

        renderPage().catch((err) => {
            console.error(err);
            setErrorMessage("Failed to render PDF page.");
        });
    }, [pdfDoc, pageNumber]);

    return (
        <div className={className}>
            {/* File uploader */}
            <div className="flex items-center justify-between gap-3 mb-3">
                <label className="text-sm font-medium text-slate-200">
                    Upload PDF
                    <input
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
                    {pdfDoc && <FieldOverlay pageNumber={pageNumber} />}
                </div>
            </div>
        </div>
    );
}
