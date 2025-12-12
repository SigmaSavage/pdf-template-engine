import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

function hexToRgbColor(hex?: string) {
  if (!hex) return rgb(0, 0, 0);
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return rgb(0, 0, 0);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return rgb(0, 0, 0);
  }
  return rgb(r / 255, g / 255, b / 255);
}

export async function fillPdfFromTemplate(options: {
  pdfBytes: Uint8Array | ArrayBuffer;
  fields: PdfField[];
  data: FillData;
  removeFormFields?: boolean;
}) {
  const { pdfBytes, fields, data, removeFormFields } = options;

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
    const fontSize = field.style?.fontSize ?? 10;
    const color = hexToRgbColor(field.style?.color);

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
          color,
        });
      }
    } else {
      const text = String(rawValue);
      page.drawText(text, {
        x: px,
        y: baselineY,
        size: fontSize,
        font,
        color,
      });
    }
  }

  if (removeFormFields) {
    try {
      const form = pdfDoc.getForm();
      // Flatten all form fields so their current visual appearance
      // is baked into the page content, and the interactive widgets
      // themselves are removed. This keeps any black checkbox boxes
      // or other visuals while stripping the form behavior.
      if (typeof (form as any).flatten === "function") {
        (form as any).flatten({ updateFieldAppearances: true });
      }
    } catch {
      // if the document has no form or pdf-lib changes behavior, ignore
    }
  }

  // Returns a Uint8Array of the filled PDF
  const filledPdfBytes = await pdfDoc.save();
  return filledPdfBytes;
}

export async function exportFillablePdfFromTemplate(options: {
  pdfBytes: Uint8Array | ArrayBuffer;
  fields: PdfField[];
}) {
  const { pdfBytes, fields } = options;
  const uint8 = toUint8Array(pdfBytes);
  const pdfDoc = await PDFDocument.load(uint8);
  const pages = pdfDoc.getPages();

  const form = pdfDoc.getForm();

  const nameCounts: Record<string, number> = {};

  // pdf-lib requires field names to have non-empty segments between
  // periods (used for hierarchical names), and they should avoid
  // odd characters. Normalize keys into safe base names.
  const makeSafeFieldBaseName = (raw: string | undefined | null) => {
    let base = (raw || "field").trim() || "field";
    // Allow letters, digits, underscores, and periods; replace others.
    base = base.replace(/[^A-Za-z0-9_.]/g, "_");
    // Collapse multiple periods to a single, and trim leading/trailing.
    base = base.replace(/\.+/g, ".");
    base = base.replace(/^\.+|\.+$/g, "");
    if (!base) base = "field";
    return base;
  };

  for (const field of fields) {
    const page = pages[field.page] ?? pages[0];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const baseName = makeSafeFieldBaseName(field.key);
    const count = nameCounts[baseName] ?? 0;
    nameCounts[baseName] = count + 1;
    const fieldName = count === 0 ? baseName : `${baseName}_${count + 1}`;

    const px = field.x * pageWidth;
    const rectWidth = field.width * pageWidth;
    const rectHeight = field.height * pageHeight;
    const pyTop = field.y * pageHeight;
    const y = pageHeight - pyTop - rectHeight;

    if (field.type === "checkbox") {
      const checkBox = form.createCheckBox(fieldName);
      checkBox.addToPage(page, {
        x: px,
        y,
        width: Math.max(12, rectWidth),
        height: Math.max(12, rectHeight),
      });
    } else {
      const textField = form.createTextField(fieldName);
      textField.addToPage(page, {
        x: px,
        y,
        width: rectWidth,
        height: rectHeight,
      });
    }
  }

  const exportedBytes = await pdfDoc.save();
  return exportedBytes;
}
