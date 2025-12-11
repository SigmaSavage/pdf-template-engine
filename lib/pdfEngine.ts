import { PDFDocument, StandardFonts } from "pdf-lib";
import type { PdfField } from "@/types/pdf";

type FillData = Record<string, string | number | boolean>;

function toUint8Array(bytes: Uint8Array | ArrayBuffer): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function parseCheckboxValue(value: string | number | boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const v = String(value).trim().toLowerCase();
  return ["true", "yes", "y", "1", "on", "x", "checked"].includes(v);
}

export async function fillPdfFromTemplate(options: {
  pdfBytes: Uint8Array | ArrayBuffer;
  fields: PdfField[];
  data: FillData;
}) {
  const { pdfBytes, fields, data } = options;

  const uint8 = toUint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(uint8);
  const pages = pdfDoc.getPages();

  // Simple font we can reuse on each page
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const field of fields) {
    const page = pages[field.page] ?? pages[0];
    const rawValue = data[field.key];

    if (rawValue == null) continue; // no data for this key

    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Your field.x/y/width/height are normalized [0..1] from top-left.
    const fontSize = 10;

    const px = field.x * pageWidth;
    const pyTop = field.y * pageHeight;

    // pdf-lib's origin is bottom-left, so we flip the Y axis
    const baselineY = pageHeight - pyTop - fontSize;

    if (field.type === "checkbox") {
      const checked = parseCheckboxValue(rawValue);
      const mark = checked ? "X" : ""; // Use ASCII to avoid WinAnsi encoding issues
      if (mark) {
        page.drawText(mark, {
          x: px,
          y: baselineY,
          size: fontSize,
          font,
        });
      }
    } else {
      const text = String(rawValue);
      page.drawText(text, {
        x: px,
        y: baselineY,
        size: fontSize,
        font,
      });
    }
  }

  // Returns a Uint8Array of the filled PDF
  const filledPdfBytes = await pdfDoc.save();
  return filledPdfBytes;
}
