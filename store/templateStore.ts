import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PdfField, PdfTemplate } from "@/types/pdf";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface TemplateState {
  templates: PdfTemplate[];
  activeTemplateId: string | null;

  // PDF currently loaded in the designer (as base64)
  currentPdfDataBase64: string | null;
  currentPdfName: string | null;

  currentFields: PdfField[];

  setActiveTemplate: (id: string | null) => void;
  addTemplate: (template: PdfTemplate) => void;
  updateTemplate: (template: PdfTemplate) => void;
  updateTemplateFields: (id: string, fields: PdfField[]) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => void;

  setCurrentPdf: (data: ArrayBuffer, name: string) => void;

  clearCurrent: () => void;

  setCurrentFields: (fields: PdfField[]) => void;
  addCurrentField: (field: PdfField) => void;
  updateCurrentField: (id: string, patch: Partial<PdfField>) => void;
  removeCurrentField: (id: string) => void;
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set) => ({
      templates: [],
      activeTemplateId: null,

      currentPdfDataBase64: null,
      currentPdfName: null,

      currentFields: [],

      setActiveTemplate: (id) => set({ activeTemplateId: id }),

      addTemplate: (template) =>
        set((state) => ({ templates: [...state.templates, template] })),

      updateTemplate: (template) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === template.id ? template : t
          ),
        })),

      updateTemplateFields: (id, fields) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, fields } : t
          ),
        })),

      deleteTemplate: (id) =>
        set((state) => {
          const remaining = state.templates.filter((t) => t.id !== id);

          // If we're deleting the active template, also clear the
          // currently loaded PDF and fields so the Designer doesn't show
          // "ghost" unsaved changes for a template that no longer exists.
          if (state.activeTemplateId === id) {
            return {
              templates: remaining,
              activeTemplateId: null,
              currentPdfDataBase64: null,
              currentPdfName: null,
              currentFields: [],
            };
          }

          return {
            templates: remaining,
          };
        }),

      duplicateTemplate: (id) =>
        set((state) => {
          const original = state.templates.find((t) => t.id === id);
          if (!original) return state;

          const now = new Date().toISOString();
          const copy: PdfTemplate = {
            ...original,
            id: `${original.id}-copy-${Date.now()}`,
            name: `${original.name} (Copy)`,
            createdAt: now,
            updatedAt: now,
          };

          return {
            ...state,
            templates: [...state.templates, copy],
          };
        }),

      setCurrentPdf: (data, name) =>
        set({
          currentPdfDataBase64: arrayBufferToBase64(data),
          currentPdfName: name,
        }),

      clearCurrent: () =>
        set({
          currentPdfDataBase64: null,
          currentPdfName: null,
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
    }),
    {
      name: "pdf-template-engine-store",
      // only persist templates + activeTemplateId; current fields/PDF are ephemeral
      partialize: (state) => ({
        templates: state.templates,
        activeTemplateId: state.activeTemplateId,
      }),
    }
  )
);
