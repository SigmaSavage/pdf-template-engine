import { create } from "zustand";
import type { PdfField, PdfTemplate } from "@/types/pdf";

interface TemplateState {
  templates: PdfTemplate[];
  activeTemplateId: string | null;

  // PDF currently loaded in the designer
  currentPdfData: ArrayBuffer | null;
  currentPdfName: string | null;

  currentFields: PdfField[];

  setActiveTemplate: (id: string | null) => void;
  addTemplate: (template: PdfTemplate) => void;
  updateTemplateFields: (id: string, fields: PdfField[]) => void;

  setCurrentPdf: (data: ArrayBuffer, name: string) => void;

  setCurrentFields: (fields: PdfField[]) => void;
  addCurrentField: (field: PdfField) => void;
  updateCurrentField: (id: string, patch: Partial<PdfField>) => void;
  removeCurrentField: (id: string) => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  activeTemplateId: null,

  currentPdfData: null,
  currentPdfName: null,

  currentFields: [],

  setActiveTemplate: (id) => set({ activeTemplateId: id }),

  addTemplate: (template) =>
    set((state) => ({ templates: [...state.templates, template] })),

  updateTemplateFields: (id, fields) =>
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, fields } : t
      ),
    })),

  setCurrentPdf: (data, name) =>
    set({
      currentPdfData: data,
      currentPdfName: name,
      // optional: reset fields when new PDF is loaded
      currentFields: [],
    }),

  setCurrentFields: (fields) => set({ currentFields: fields }),

  addCurrentField: (field) =>
    set((state) => ({ currentFields: [...state.currentFields, field] })),

  updateCurrentField: (id, patch) =>
    set((state) => ({
      currentFields: state.currentFields.map((f) =>
        f.id === id ? { ...f, ...patch } : f
      ),
    })),

  removeCurrentField: (id) =>
    set((state) => ({
      currentFields: state.currentFields.filter((f) => f.id !== id),
    })),
}));
