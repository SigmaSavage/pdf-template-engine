// lib/pdfEngine.ts
import { PDFDocument } from "pdf-lib";
import type { PdfField } from "@/types/pdf";

export async function fillPdfFromTemplate(options: {
  pdfBytes: Uint8Array | ArrayBuffer;
  fields: PdfField[];
  data: Record<string, string | number | boolean>;
}) {
  const { pdfBytes, fields, data } = options;

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  // TODO: implement coordinate conversion properly
  for (const field of fields) {
    const page = pages[field.page] ?? pages[0];
    const value = data[field.key];
    if (value == null) continue;

    page.drawText(String(value), {
      x: field.x,
      y: field.y,
      size: 10,
    });
  }

  const filledPdfBytes = await pdfDoc.save();
  return filledPdfBytes;
}
