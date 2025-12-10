// lib/templateStore.ts
import type { PdfTemplate } from "@/types/pdf";

const inMemoryTemplates = new Map<string, PdfTemplate>();

export function saveTemplate(template: PdfTemplate) {
  inMemoryTemplates.set(template.id, template);
}

export function getTemplate(id: string) {
  return inMemoryTemplates.get(id) ?? null;
}

export function listTemplates() {
  return Array.from(inMemoryTemplates.values());
}
