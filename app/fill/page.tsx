"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useTemplateStore } from "@/store/templateStore";
import { fillPdfFromTemplate } from "@/lib/pdfEngine";
import type { PdfTemplate, PdfFieldType } from "@/types/pdf";

type ValueMap = Record<string, string | number | boolean>;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function FillPage() {
  const templates = useTemplateStore((state) => state.templates);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [values, setValues] = useState<ValueMap>({});
  const [isFilling, setIsFilling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const selectedTemplate: PdfTemplate | null = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  // Map each schema key to its primary field type
  const keyTypes: Record<string, PdfFieldType> = useMemo(() => {
    const map: Record<string, PdfFieldType> = {};
    if (!selectedTemplate) return map;
    for (const field of selectedTemplate.fields) {
      if (!map[field.key]) {
        map[field.key] = field.type;
      }
    }
    return map;
  }, [selectedTemplate]);

  const handleValueChange = (key: string, type: PdfFieldType, value: any) => {
    setValues((prev) => ({
      ...prev,
      [key]:
        type === "number"
          ? value === ""
            ? ""
            : Number.isNaN(Number(value))
            ? value
            : Number(value)
          : type === "checkbox"
          ? Boolean(value)
          : value,
    }));
  };

  const handleCheckboxChange = (key: string, checked: boolean) => {
    setValues((prev) => ({
      ...prev,
      [key]: checked,
    }));
  };

  const handleGenerate = async () => {
    setErrorMessage(null);

    if (!selectedTemplate) {
      setErrorMessage("Select a template first.");
      return;
    }

    try {
      setIsFilling(true);

      // Build the data object: use values, but fallback to empty string
      const data: ValueMap = {};
      for (const key of selectedTemplate.schemaKeys) {
        const v = values[key];
        data[key] = v ?? "";
      }

      if (!selectedTemplate.pdfDataBase64) {
        setErrorMessage("This template has no PDF data attached.");
        return;
      }

      const pdfBytes = base64ToUint8Array(selectedTemplate.pdfDataBase64);

      const filledBytes = await fillPdfFromTemplate({
        pdfBytes,
        fields: selectedTemplate.fields,
        data,
      });

      const blob = new Blob([filledBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedTemplate.name || "filled-form"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to generate filled PDF. Check console for details.");
    } finally {
      setIsFilling(false);
    }
  };

  const handlePreview = async () => {
    setErrorMessage(null);

    if (!selectedTemplate) {
      setErrorMessage("Select a template first.");
      return;
    }

    if (!selectedTemplate.pdfDataBase64) {
      setErrorMessage("This template has no PDF data attached.");
      return;
    }

    try {
      setIsFilling(true);

      const data: ValueMap = {};
      for (const key of selectedTemplate.schemaKeys) {
        const v = values[key];
        data[key] = v ?? "";
      }

      const pdfBytes = base64ToUint8Array(selectedTemplate.pdfDataBase64);

      const filledBytes = await fillPdfFromTemplate({
        pdfBytes,
        fields: selectedTemplate.fields,
        data,
      });

      const blob = new Blob([filledBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);

      // Revoke old preview URL if present
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      setPreviewUrl(url);
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to generate preview. Check console for details.");
    } finally {
      setIsFilling(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h1 className="text-2xl font-semibold">Fill & Review</h1>
          <p className="text-sm text-slate-400">
            Select a saved template, enter values, and generate a filled PDF.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Templates: {templates.length}</span>
          <Link
            href="/designer"
            className="px-3 py-1 rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
          >
             Back to Designer
          </Link>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[1.5fr,1.2fr] gap-4">
        {/* Left: Template selection + info */}
        <section className="border border-slate-800 rounded-lg p-3 space-y-3">
          <h2 className="text-lg font-medium">1. Choose a Template</h2>

          {templates.length === 0 ? (
            <p className="text-sm text-slate-400">
              No templates found. Go to the Designer, upload a PDF, define fields, and
              save a template first.
            </p>
          ) : (
            <>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.schemaKeys.length} keys, {t.fields.length} fields)
                  </option>
                ))}
              </select>

              {selectedTemplate && (
                <div className="text-xs text-slate-400 space-y-1">
                  <div>
                    <span className="font-semibold text-slate-200">Name:</span>{" "}
                    {selectedTemplate.name}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-200">Created:</span>{" "}
                    {new Date(selectedTemplate.createdAt).toLocaleString()}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Right: Data entry + generate */}
        <section className="border border-slate-800 rounded-lg p-3 space-y-3">
          <h2 className="text-lg font-medium">2. Enter Values</h2>

          {!selectedTemplate ? (
            <p className="text-sm text-slate-400">
              Select a template to see its data keys and enter values.
            </p>
          ) : selectedTemplate.schemaKeys.length === 0 ? (
            <p className="text-sm text-slate-400">
              This template has no schema keys defined. Add fields in the Designer and
              save again.
            </p>
          ) : (
            <>
              <div className="max-h-[55vh] overflow-auto space-y-2 pr-1">
                {selectedTemplate.schemaKeys.map((key) => {
                  const type = keyTypes[key] ?? "text";
                  const value = values[key] ?? (type === "checkbox" ? false : "");

                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 border border-slate-800 rounded px-2 py-1"
                    >
                      <div className="flex-1">
                        <div className="text-[11px] font-mono text-slate-300">
                          {key}
                          <span className="ml-1 text-slate-500">({type})</span>
                        </div>
                      </div>

                      {type === "checkbox" ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={Boolean(value)}
                          onChange={(e) =>
                            handleCheckboxChange(key, e.target.checked)
                          }
                        />
                      ) : (
                        <input
                          className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                          value={String(value)}
                          onChange={(e) =>
                            handleValueChange(key, type, e.target.value)
                          }
                          placeholder="Value"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {errorMessage && (
                <p className="text-xs text-red-400">{errorMessage}</p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2">
                <div className="flex items-center gap-2">
                  <button
                    className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white disabled:opacity-50"
                    onClick={handleGenerate}
                    disabled={!selectedTemplate || isFilling}
                  >
                    {isFilling ? "Working…" : "Download Filled PDF"}
                  </button>
                  <button
                    className="px-3 py-2 rounded border border-slate-600 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                    onClick={handlePreview}
                    disabled={!selectedTemplate || isFilling}
                  >
                    Preview
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Download or preview the filled PDF.
                </p>
              </div>

              {previewUrl && (
                <div className="mt-3 border border-slate-800 rounded bg-slate-950 overflow-hidden h-80">
                  <iframe
                    src={previewUrl}
                    className="w-full h-full"
                    title="Filled PDF Preview"
                  />
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
