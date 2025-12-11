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
  pdfDataBase64: string;   // base64-encoded PDF bytes
  fields: PdfField[];
  schemaKeys: string[];
  createdAt: string;
  updatedAt?: string;
}
