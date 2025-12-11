// app/designer/page.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import PdfCanvas from "@/components/PdfCanvas";
import { useTemplateStore } from "@/store/templateStore";
import { exportFillablePdfFromTemplate } from "@/lib/pdfEngine";
import { v4 as uuidv4 } from "uuid";

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}


export default function DesignerPage() {

  const templates = useTemplateStore((state) => state.templates);
  const activeTemplateId = useTemplateStore((state) => state.activeTemplateId);
  const currentFields = useTemplateStore((state) => state.currentFields);
  const updateCurrentField = useTemplateStore((state) => state.updateCurrentField);
  const removeCurrentField = useTemplateStore((state) => state.removeCurrentField);
  const currentPdfDataBase64 = useTemplateStore((state) => state.currentPdfDataBase64);
  const currentPdfName = useTemplateStore((state) => state.currentPdfName);
  const addTemplate = useTemplateStore((state) => state.addTemplate);
  const updateTemplate = useTemplateStore((state) => state.updateTemplate);
  const setActiveTemplate = useTemplateStore((state) => state.setActiveTemplate);
  const setCurrentFields = useTemplateStore((state) => state.setCurrentFields);
  const setCurrentPdf = useTemplateStore((state) => state.setCurrentPdf);
  const clearCurrent = useTemplateStore((state) => state.clearCurrent);

  const [templateName, setTemplateName] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autoDetectFields, setAutoDetectFields] = useState(true);

  const activeTemplate = useMemo(
    () =>
      activeTemplateId
        ? templates.find((t) => t.id === activeTemplateId) ?? null
        : null,
    [activeTemplateId, templates]
  );

  const hasUnsavedChanges = useMemo(() => {
    const trimmedName = templateName.trim();

    // Nothing loaded or typed yet
    if (!currentPdfDataBase64 && currentFields.length === 0 && !trimmedName) {
      return false;
    }

    // New, unsaved template
    if (!activeTemplate) {
      return (
        !!currentPdfDataBase64 ||
        currentFields.length > 0 ||
        trimmedName.length > 0
      );
    }

    // Compare against active template
    if (currentPdfDataBase64 !== activeTemplate.pdfDataBase64) return true;
    if (trimmedName && trimmedName !== activeTemplate.name) return true;
    if (currentFields.length !== activeTemplate.fields.length) return true;

    for (const field of currentFields) {
      const original = activeTemplate.fields.find((f) => f.id === field.id);
      if (!original) return true;
      if (
        original.key !== field.key ||
        original.type !== field.type ||
        original.page !== field.page ||
        original.x !== field.x ||
        original.y !== field.y ||
        original.width !== field.width ||
        original.height !== field.height
      ) {
        return true;
      }
    }

    return false;
  }, [
    activeTemplate,
    currentFields,
    currentPdfDataBase64,
    templateName,
  ]);

  const handleSelectTemplate = (id: string) => {
    console.log("[Designer] TODO remove debug: handleSelectTemplate", { id });

    // Clear any prior status messages when switching
    setSaveMessage(null);
    setSaveError(null);

    // If changing selection and there are unsaved edits, confirm first
    const targetId = id || null;
    if (targetId !== (activeTemplateId ?? null) && hasUnsavedChanges) {
      const confirmSwitch = window.confirm(
        "You have unsaved changes for this template. Switch templates and discard those changes?"
      );
      if (!confirmSwitch) {
        return;
      }
    }

    if (!id) {
      setActiveTemplate(null);
      clearCurrent();
      setTemplateName("");
      return;
    }

    setActiveTemplate(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;

    console.log("[Designer] TODO remove debug: selected template", {
      id: template.id,
      name: template.name,
      fieldsCount: template.fields.length,
      hasPdf: !!template.pdfDataBase64,
    });

    setTemplateName(template.name);
    // Load the template's PDF into the designer first
    const bytes = base64ToUint8Array(template.pdfDataBase64);
    setCurrentPdf(bytes.buffer as ArrayBuffer, template.name);
    // Then restore its fields
    setCurrentFields(template.fields);
  };

  // When landing on the Designer with an activeTemplateId (e.g. after refresh
  // or navigating back from Fill), load that template's PDF and fields if the
  // working state is empty.
  useEffect(() => {
    if (!activeTemplateId) return;
    if (currentPdfDataBase64 && currentFields.length > 0) return;

    const template = templates.find((t) => t.id === activeTemplateId);
    if (!template) return;

    console.log("[Designer] TODO remove debug: rehydrating active template", {
      id: template.id,
      name: template.name,
      fieldsCount: template.fields.length,
      hasPdf: !!template.pdfDataBase64,
    });

    setTemplateName(template.name);
    const bytes = base64ToUint8Array(template.pdfDataBase64);
    setCurrentPdf(bytes.buffer as ArrayBuffer, template.name);
    setCurrentFields(template.fields);
  }, [activeTemplateId, templates, currentPdfDataBase64, currentFields.length, setCurrentPdf, setCurrentFields]);

  const handleSaveTemplate = () => {
    setSaveMessage(null);
    setSaveError(null);

    if (!currentPdfDataBase64) {
      setSaveError("Upload a PDF before saving a template.");
      return;
    }

    const trimmedName = templateName.trim() || currentPdfName || "Untitled Template";

    // Build a list of unique keys from fields
    const schemaKeys = Array.from(
      new Set(
        currentFields
          .map((f) => f.key.trim())
          .filter((key) => key.length > 0)
      )
    );

    const existing = activeTemplateId
      ? templates.find((t) => t.id === activeTemplateId)
      : undefined;

    const id = existing ? existing.id : uuidv4();
    const now = new Date().toISOString();
    const createdAt = existing ? existing.createdAt : now;

    const newTemplate = {
      id,
      name: trimmedName,
      pdfDataBase64: currentPdfDataBase64!,
      fields: currentFields,
      schemaKeys,
      createdAt,
      updatedAt: now,
    };

    try {
      if (existing) {
        updateTemplate(newTemplate);
        setSaveMessage(`Template "${trimmedName}" updated.`);
      } else {
        addTemplate(newTemplate);
        setSaveMessage(`Template "${trimmedName}" saved.`);
      }

      setActiveTemplate(id);
      if (!templateName) {
        setTemplateName(trimmedName);
      }
    } catch (err: any) {
      if (err && typeof err === "object" && "name" in err && (err as any).name === "QuotaExceededError") {
        setSaveError(
          "Browser storage is full. Try deleting some templates or clearing localStorage (key: 'pdf-template-engine-store')."
        );
      } else {
        console.error(err);
        setSaveError("Failed to save template due to an unexpected error.");
      }
    }
  };

  // Auto-clear "saved" message after a delay when there are no further edits
  useEffect(() => {
    if (!saveMessage || hasUnsavedChanges) return;

    const timeout = setTimeout(() => {
      setSaveMessage(null);
    }, 4000);

    return () => clearTimeout(timeout);
  }, [saveMessage, hasUnsavedChanges]);

  const handleExportFillable = async () => {
    if (!activeTemplate) {
      setSaveError("Select or save a template before exporting a fillable PDF.");
      return;
    }
    try {
      const bytes = base64ToUint8Array(activeTemplate.pdfDataBase64);
      const exported = await exportFillablePdfFromTemplate({
        pdfBytes: bytes,
        fields: activeTemplate.fields,
      });

      const blob = new Blob([exported.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${activeTemplate.name || "template"}-fillable.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setSaveError("Failed to export fillable PDF. Check console for details.");
    }
  };


  return (
    <div className="min-h-screen flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h1 className="text-2xl font-semibold">PDF Template Designer</h1>
          <p className="text-sm text-slate-400">
            Upload a PDF, define fields, and save as a reusable template.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/templates"
            className="px-3 py-1 rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
          >
            Templates Library
          </Link>
          <Link
            href="/fill"
            className="px-3 py-1 rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
          >
            Go to Fill &amp; Review →
          </Link>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-4">
        <section className="border border-slate-800 rounded-lg p-3">
          <p className="text-sm text-slate-400 mb-2">PDF Canvas</p>
          <PdfCanvas enableAutoDetect={autoDetectFields} />
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                className="accent-sky-500"
                checked={autoDetectFields}
                onChange={(e) => setAutoDetectFields(e.target.checked)}
              />
              <span>Auto-detect form fields on upload</span>
            </label>
          </div>
        </section>

        <aside className="border border-slate-800 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium">Fields &amp; Data Keys</h2>
          </div>

          {/* Existing templates selector */}
          <div className="flex flex-col gap-2 border-b border-slate-800 pb-3 mb-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                Saved templates: {templates.length}
              </span>
              {activeTemplateId && (
                <span className="text-[11px] text-emerald-400">
                  Editing current template
                </span>
              )}
            </div>
            {templates.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                No saved templates yet. Create one by uploading a PDF and adding fields.
              </p>
            ) : (
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                value={activeTemplateId ?? ""}
                onChange={(e) => handleSelectTemplate(e.target.value)}
              >
                <option value="">New template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Template name + save button */}
          <div className="flex flex-col gap-2 border-b border-slate-800 pb-3 mb-2">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                placeholder={currentPdfName ? `Template name (default: ${currentPdfName})` : "Template name"}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <button
                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white disabled:opacity-50"
                onClick={handleSaveTemplate}
                disabled={!currentPdfDataBase64 || currentFields.length === 0}
              >
                Save Template
              </button>
              <button
                className="px-3 py-1 rounded border border-slate-600 text-xs font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-40"
                type="button"
                onClick={handleExportFillable}
                disabled={!activeTemplate || activeTemplate.fields.length === 0}
              >
                Export fillable PDF
              </button>
            </div>

            {saveError && (
              <p className="text-[11px] text-red-400">{saveError}</p>
            )}
            {!saveError && hasUnsavedChanges && (
              <p className="text-[11px] text-amber-400">
                You have unsaved changes.
              </p>
            )}
            {!saveError && !hasUnsavedChanges && saveMessage && (
              <p className="text-[11px] text-emerald-400">{saveMessage}</p>
            )}
          </div>

          {currentFields.length === 0 ? (
            <p className="text-sm text-slate-400">
              Click and drag on the PDF to create a field region. New fields will appear
              here with auto-generated keys. You can rename them and change types, then
              save the template when you're ready.
            </p>
          ) : (
            <div className="max-h-[55vh] overflow-auto pr-1">
              <ul className="space-y-2 text-sm">
                {currentFields.map((field) => (
                <li
                  key={field.id}
                  className="rounded border border-slate-700 px-2 py-2 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500"
                      value={field.key}
                      onChange={(e) =>
                        updateCurrentField(field.id, { key: e.target.value })
                      }
                      title="Field key used for data binding"
                    />

                    <select
                      className="bg-slate-900 border border-slate-700 rounded px-1 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-sky-500"
                      value={field.type}
                      onChange={(e) =>
                        updateCurrentField(field.id, {
                          type: e.target.value as any,
                        })
                      }
                    >
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="date">date</option>
                      <option value="checkbox">checkbox</option>
                    </select>

                    <button
                      className="text-[11px] text-red-400 hover:text-red-300 px-1"
                      onClick={() => removeCurrentField(field.id)}
                      title="Delete field"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="text-[10px] text-slate-500">
                    page {field.page + 1} • x={field.x.toFixed(2)}, y=
                    {field.y.toFixed(2)} • w={field.width.toFixed(2)}, h=
                    {field.height.toFixed(2)}
                  </div>
                </li>
                ))}
              </ul>
            </div>
          )}
        </aside>


      </main>
    </div>
  );
}
