// store/templateStore.ts
import { create } from "zustand";
import type { PdfField, PdfTemplate } from "@/types/pdf";

interface TemplateState {
  templates: PdfTemplate[];
  activeTemplateId: string | null;
  setActiveTemplate: (id: string | null) => void;
  addTemplate: (template: PdfTemplate) => void;
  updateTemplateFields: (id: string, fields: PdfField[]) => void;
}

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  activeTemplateId: null,
  setActiveTemplate: (id) => set({ activeTemplateId: id }),
  addTemplate: (template) =>
    set((state) => ({ templates: [...state.templates, template] })),
  updateTemplateFields: (id, fields) =>
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === id ? { ...t, fields } : t
      ),
    })),
}));
