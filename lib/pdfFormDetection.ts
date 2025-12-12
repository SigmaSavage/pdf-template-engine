import type { PdfField, PdfFieldType } from "@/types/pdf";

// Shared helper to detect AcroForm fields using pdf.js annotations.
// Returns PdfField rectangles in normalized [0..1] top-left coordinates.
export async function detectFormFieldsFromPdf(
  data: Uint8Array | ArrayBuffer,
  pdfjs: any
): Promise<PdfField[]> {
  try {
    if (!pdfjs || typeof pdfjs.getDocument !== "function") {
      return [];
    }

    // Always work on a fresh copy of the bytes so we don't
    // run into issues with a shared ArrayBuffer being detached
    // by a pdf.js worker elsewhere.
    // First normalize the input into a Uint8Array view, then copy it
    // into a new buffer that we pass to pdf.js so the caller's
    // ArrayBuffer/Uint8Array cannot be detached by the worker.
    const srcBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const bytes = new Uint8Array(srcBytes.length);
    bytes.set(srcBytes);
    console.log("[pdfFormDetection] TODO remove debug: starting detection", {
      byteLength: bytes.byteLength,
      hasGetDocument: typeof pdfjs.getDocument === "function",
    });

    const loadingTask = pdfjs.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    console.log("[pdfFormDetection] TODO remove debug: loaded PDF for detection", {
      numPages: pdf.numPages,
    });
    const results: PdfField[] = [];

    for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
      const pageNumber = pageIndex + 1;
      const page = await pdf.getPage(pageNumber);
      const annotations = await page.getAnnotations();
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;

      console.log("[pdfFormDetection] TODO remove debug: page annotations", {
        pageIndex,
        pageNumber,
        totalAnnotations: annotations.length,
        widgetAnnotations: (annotations as any[]).filter(
          (a) => a && a.subtype === "Widget"
        ).length,
      });

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

        const detected: PdfField = {
          id: `auto_${pageIndex + 1}_${results.length}`,
          page: pageIndex,
          x: normX,
          y: normY,
          width: normW,
          height: normH,
          key,
          type,
        };

        console.log("[pdfFormDetection] TODO remove debug: detected field", {
          pageIndex,
          pageNumber,
          key: detected.key,
          type: detected.type,
          rect: { x1, y1, x2, y2 },
          norm: {
            x: detected.x,
            y: detected.y,
            width: detected.width,
            height: detected.height,
          },
        });

        results.push(detected);
      }
    }

    console.log("[pdfFormDetection] TODO remove debug: auto-detected form fields", {
      count: results.length,
    });
    return results;
  } catch (err) {
    console.warn("[pdfFormDetection] TODO remove debug: auto-detect form fields failed", err);
    return [];
  }
}
