"use client";

import React, { useMemo, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTemplateStore } from "@/store/templateStore";
import { fillPdfFromTemplate } from "@/lib/pdfEngine";
import type { PdfTemplate, PdfFieldType } from "@/types/pdf";
import FillPreviewCanvas from "@/components/FillPreviewCanvas";
import { v4 as uuidv4 } from "uuid";

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

function FillPageInner() {
  const templates = useTemplateStore((state) => state.templates);
  const updateTemplateFields = useTemplateStore(
    (state) => state.updateTemplateFields
  );
  const addTemplate = useTemplateStore((state) => state.addTemplate);
  const updateTemplate = useTemplateStore((state) => state.updateTemplate);
  const setActiveTemplate = useTemplateStore((state) => state.setActiveTemplate);
  const clearCurrent = useTemplateStore((state) => state.clearCurrent);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [values, setValues] = useState<ValueMap>({});
  const [isFilling, setIsFilling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [defaultFontSize, setDefaultFontSize] = useState<number>(10);
  const [defaultColor, setDefaultColor] = useState<string>("#000000");
  const [workingFields, setWorkingFields] = useState<PdfTemplate["fields"]>([]);
  const [hasLayoutChanges, setHasLayoutChanges] = useState(false);
  const [layoutSaveMessage, setLayoutSaveMessage] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState<string>("");
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const selectedTemplate: PdfTemplate | null = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const searchParams = useSearchParams();

  useEffect(() => {
    const initialId = searchParams.get("templateId");
    if (!initialId) return;
    if (selectedTemplateId) return;
    const exists = templates.some((t) => t.id === initialId);
    if (!exists) return;
    setSelectedTemplateId(initialId);
    setActiveTemplate(initialId);
  }, [searchParams, selectedTemplateId, templates, setActiveTemplate]);

  // Keep a local, editable copy of fields for this template
  useEffect(() => {
    if (selectedTemplate) {
      setWorkingFields(selectedTemplate.fields.map((f) => ({ ...f })));
      setHasLayoutChanges(false);
      setLayoutSaveMessage(null);
      setNewTemplateName(`${selectedTemplate.name} (Adjusted)`);
      setHighlightKey(null);
    } else {
      setWorkingFields([]);
      setHasLayoutChanges(false);
      setLayoutSaveMessage(null);
      setNewTemplateName("");
      setHighlightKey(null);
    }
  }, [selectedTemplateId, selectedTemplate?.id, selectedTemplate?.name]);

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
      const effectiveFields = workingFields.map((field) => {
        const style = field.style ?? {};
        return {
          ...field,
          style: {
            ...style,
            fontSize: style.fontSize ?? defaultFontSize,
            color: style.color ?? defaultColor,
          },
        };
      });

      const filledBytes = await fillPdfFromTemplate({
        pdfBytes,
        fields: effectiveFields,
        data,
        // Always flatten/remove any AcroForm fields in the output so
        // filled PDFs from this flow are not fillable.
        removeFormFields: true,
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

      <main className="flex-1 flex flex-col gap-4">
        {/* 1: Template selection + info */}
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
        {/* 2: Live preview + style controls */}
        <section className="border border-slate-800 rounded-lg p-3 space-y-3">
          <h2 className="text-lg font-medium">2. Preview & Style</h2>

          {!selectedTemplate ? (
            <p className="text-sm text-slate-400">
              Select a template to see a live PDF preview and style controls.
            </p>
          ) : selectedTemplate.fields.length === 0 ? (
            <p className="text-sm text-slate-400">
              This template has no fields yet. Add fields in the Designer to see them
              here.
            </p>
          ) : (
            <div className="flex flex-col md:flex-row gap-3 h-80">
              <div className="flex-1 min-w-0">
                <FillPreviewCanvas
                  template={selectedTemplate}
                  fields={workingFields}
                  values={values}
                  selectedFieldId={selectedFieldId}
                  onSelectField={setSelectedFieldId}
                  defaultFontSize={defaultFontSize}
                  defaultColor={defaultColor}
                  highlightKey={highlightKey}
                  onUpdateField={(id, patch) => {
                    setWorkingFields((prev) =>
                      prev.map((f) => (f.id === id ? { ...f, ...patch } : f))
                    );
                    setHasLayoutChanges(true);
                    setLayoutSaveMessage(null);
                  }}
                />
              </div>

              <div className="w-full md:w-60 shrink-0 border border-slate-800 rounded-md p-2 text-xs space-y-3 bg-slate-950/80">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-200 text-[11px]">
                    Default text style
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-slate-400">Font size</span>
                    <input
                      type="number"
                      className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 w-20 text-[11px]"
                      value={defaultFontSize}
                      min={6}
                      max={48}
                      onChange={(e) => {
                        const n = Number(e.target.value) || 10;
                        setDefaultFontSize(n);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-14 text-slate-400">Color</span>
                    <input
                      type="color"
                      className="w-8 h-5"
                      value={defaultColor}
                      onChange={(e) => setDefaultColor(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Used when a field has no explicit style.
                  </p>
                </div>

                {(() => {
                  const field = workingFields.find(
                    (f) => f.id === selectedFieldId
                  );
                  if (!field) return null;
                  const fieldFontSize = field.style?.fontSize ?? defaultFontSize;
                  const fieldColor = field.style?.color ?? defaultColor;

                  return (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="font-semibold text-slate-200 text-[11px]">
                        Field style: <span className="font-mono">{field.key}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-slate-400">Font size</span>
                        <input
                          type="number"
                          className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 w-20 text-[11px]"
                          value={fieldFontSize}
                          min={6}
                          max={72}
                          onChange={(e) => {
                            const n = Number(e.target.value) || defaultFontSize;
                            setWorkingFields((prev) =>
                              prev.map((f) =>
                                f.id === field.id
                                  ? {
                                      ...f,
                                      style: {
                                        ...(f.style ?? {}),
                                        fontSize: n,
                                      },
                                    }
                                  : f
                              )
                            );
                            setHasLayoutChanges(true);
                            setLayoutSaveMessage(null);
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-slate-400">Color</span>
                        <input
                          type="color"
                          className="w-8 h-5"
                          value={fieldColor}
                          onChange={(e) => {
                            const nextColor = e.target.value || defaultColor;
                                setWorkingFields((prev) =>
                                  prev.map((f) =>
                                    f.id === field.id
                                      ? {
                                          ...f,
                                          style: {
                                            ...(f.style ?? {}),
                                            color: nextColor,
                                          },
                                        }
                                      : f
                                  )
                                );
                                setHasLayoutChanges(true);
                                setLayoutSaveMessage(null);
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {hasLayoutChanges && (
                  <div className="mt-3 pt-2 border-t border-slate-800 space-y-2 text-[11px]">
                    <div className="text-amber-300">
                      You have unsaved layout/style changes for this template.
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-medium text-white"
                          onClick={() => {
                            if (!selectedTemplate) return;
                            const now = new Date().toISOString();
                            updateTemplateFields(
                              selectedTemplate.id,
                              workingFields
                            );
                            updateTemplate({
                              ...selectedTemplate,
                              fields: workingFields,
                              updatedAt: now,
                            });
                            setActiveTemplate(selectedTemplate.id);
                            clearCurrent();
                            setHasLayoutChanges(false);
                            setLayoutSaveMessage("Template updated.");
                          }}
                        >
                          Save changes to current template
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-20 text-slate-400">New name</span>
                          <input
                            type="text"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-sky-500"
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="px-3 py-1 rounded border border-slate-600 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                          onClick={() => {
                            if (!selectedTemplate) return;
                            const trimmed = newTemplateName.trim();
                            if (!trimmed) {
                              setLayoutSaveMessage(
                                "Enter a name for the new template."
                              );
                              return;
                            }
                            const now = new Date().toISOString();
                            const id = uuidv4();
                            const schemaKeys = Array.from(
                              new Set(workingFields.map((f) => f.key))
                            );
                            const newTemplate: PdfTemplate = {
                              id,
                              name: trimmed,
                              pdfDataBase64: selectedTemplate.pdfDataBase64,
                              fields: workingFields,
                              schemaKeys,
                              createdAt: now,
                              updatedAt: now,
                            };
                            addTemplate(newTemplate);
                            setActiveTemplate(id);
                            setSelectedTemplateId(id);
                            clearCurrent();
                            setHasLayoutChanges(false);
                            setLayoutSaveMessage("New template created.");
                          }}
                        >
                          Save as new template
                        </button>
                      </div>
                      {layoutSaveMessage && (
                        <div className="text-[10px] text-slate-400">
                          {layoutSaveMessage}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 3: Data entry + generate */}
        <section className="border border-slate-800 rounded-lg p-3 space-y-3">
          <h2 className="text-lg font-medium">3. Enter Values & Download</h2>

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
                      className={`flex items-center gap-2 border rounded px-2 py-1 cursor-pointer transition-colors duration-150 ${
                        highlightKey === key
                          ? "border-sky-500 bg-sky-500/10"
                          : "border-slate-800 bg-transparent"
                      }`}
                      onMouseEnter={() => {
                        setHighlightKey(key);
                      }}
                      onMouseLeave={() => {
                        setHighlightKey((current) =>
                          current === key ? null : current
                        );
                      }}
                      onClick={() => {
                        setHighlightKey(key);
                        const fieldForKey = workingFields.find(
                          (f) => f.key === key
                        );
                        if (fieldForKey) {
                          setSelectedFieldId(fieldForKey.id);
                        }
                      }}
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
                </div>
                <p className="text-[11px] text-slate-500">
                  Download a flattened PDF that matches the live preview.
                </p>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
export default function FillPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 text-sm text-slate-400">
          Loading Fill &amp; Review…
        </div>
      }
    >
      <FillPageInner />
    </Suspense>
  );
}
