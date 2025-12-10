import { create } from "zustand";
import type { PdfField, PdfTemplate } from "@/types/pdf";

interface TemplateState {
  templates: PdfTemplate[];
  activeTemplateId: string | null;

  // NEW: fields you’re currently designing on the PDF
  currentFields: PdfField[];

  setActiveTemplate: (id: string | null) => void;
  addTemplate: (template: PdfTemplate) => void;
  updateTemplateFields: (id: string, fields: PdfField[]) => void;

  // NEW helpers
  setCurrentFields: (fields: PdfField[]) => void;
  addCurrentField: (field: PdfField) => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  activeTemplateId: null,
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

  setCurrentFields: (fields) => set({ currentFields: fields }),

  addCurrentField: (field) =>
    set((state) => ({ currentFields: [...state.currentFields, field] })),
}));
