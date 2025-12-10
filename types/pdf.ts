// types/pdf.ts

export type PdfFieldType = "text" | "number" | "date" | "checkbox";

export interface PdfField {
  id: string;
  page: number;
  x: number; // normalized coordinates (0–1)
  y: number;
  width: number;
  height: number;
  key: string;
  type: PdfFieldType;
}

export interface PdfTemplate {
  id: string;
  name: string;
  pdfPath: string; // where the original PDF is stored
  fields: PdfField[];
  schemaKeys: string[]; // e.g. ["owner_name", "address", ...]
  createdAt: string;
}
