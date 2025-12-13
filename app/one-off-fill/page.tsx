"use client";

import React, { useState } from "react";
import Link from "next/link";
import OneOffPdfCanvas from "@/components/OneOffPdfCanvas";
import { fillPdfFromTemplate } from "@/lib/pdfEngine";
import type { PdfField } from "@/types/pdf";
import type { OneOffField } from "@/components/OneOffOverlay";

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
  //TODO change this above to suggested javascript type, as btoa is no longer viable
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function OneOffFillPage() {
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [fields, setFields] = useState<OneOffField[]>([]);
  const [defaultFontSize, setDefaultFontSize] = useState<number>(12);
  const [defaultColor, setDefaultColor] = useState<string>("#000000");
  const [isFilling, setIsFilling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setErrorMessage(null);

    if (!pdfBase64) {
      setErrorMessage("Upload a PDF first.");
      return;
    }
    if (fields.length === 0) {
      setErrorMessage("Draw at least one field on the PDF.");
      return;
    }

    try {
      setIsFilling(true);

      const data: Record<string, string | boolean> = {};
      const effectiveFields: PdfField[] = fields.map((field) => {
        const style = field.style ?? {};
        const key = field.id;
        if (field.type === "checkbox") {
          // Treat missing "checked" as false so auto-detected
          // checkboxes are not assumed to be checked.
          data[key] = field.checked ?? false;
        } else {
          data[key] = field.value ?? "";
        }
        return {
          id: field.id,
          page: field.page,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          key,
          type: field.type || "text",
          style: {
            ...style,
            fontSize: style.fontSize ?? defaultFontSize,
            color: style.color ?? defaultColor,
          },
        };
      });
      const pdfBytes = base64ToUint8Array(pdfBase64);
      const filledBytes = await fillPdfFromTemplate({
        pdfBytes,
        fields: effectiveFields,
        data,
        removeFormFields: true,
      });

      const blob = new Blob([filledBytes.buffer as ArrayBuffer], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "filled-document.pdf";
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
          <h1 className="text-2xl font-semibold">One-off PDF Fill</h1>
          <p className="text-sm text-slate-400">
            Upload any PDF, draw fields directly on it, enter values, and download a
            flattened filled PDF without saving a reusable template.
          </p>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-4">
        <section className="border border-slate-800 rounded-lg p-3">
          <p className="text-sm text-slate-400 mb-2">Upload &amp; Place Fields</p>
          <OneOffPdfCanvas
            fields={fields}
            onFieldsChange={setFields}
            onPdfBytesChange={(bytes) => {
              setPdfBase64(bytes ? uint8ArrayToBase64(bytes) : null);
              setErrorMessage(null);
            }}
            defaultFontSize={defaultFontSize}
            defaultColor={defaultColor}
            selectedFieldId={selectedFieldId}
            onSelectField={setSelectedFieldId}
          />
        </section>

        <aside className="border border-slate-800 rounded-lg p-3 space-y-3">
          <h2 className="text-lg font-medium">Style &amp; Download</h2>

          {!pdfBase64 ? (
            <p className="text-sm text-slate-400">
              Upload a PDF in the panel on the left to start.
            </p>
          ) : fields.length === 0 ? (
            <p className="text-sm text-slate-400">
              Click and drag on the PDF to draw boxes. When you release the
              mouse, configure the value (for text) or checked state (for
              checkboxes) and style.
            </p>
          ) : (
            <>
              <div className="border border-slate-800 rounded-md p-2 text-xs space-y-2 bg-slate-950/80">
                <div className="font-semibold text-slate-200 text-[11px]">
                  Default text style
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 text-slate-400">Font size</span>
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
                  <span className="w-16 text-slate-400">Color</span>
                  <input
                    type="color"
                    className="w-8 h-5"
                    value={defaultColor}
                    onChange={(e) => setDefaultColor(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Used for all boxes when generating the filled PDF.
                </p>
              </div>

              {(() => {
                const field = fields.find((f) => f.id === selectedFieldId);
                if (!field) return null;

                const fieldFontSize = field.style?.fontSize ?? defaultFontSize;
                const fieldColor = field.style?.color ?? defaultColor;
                const fieldType = field.type || "text";

                return (
                  <div className="pt-2 border-t border-slate-800 space-y-2 mt-2">
                    <div className="font-semibold text-slate-200 text-[11px]">
                      Box value &amp; style
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-slate-400">Type</span>
                      <select
                        className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px]"
                        value={fieldType}
                        onChange={(e) => {
                          const nextType = e.target.value as "text" | "checkbox";
                          setFields((prev) =>
                            prev.map((f) =>
                              f.id === field.id
                                ? {
                                    ...f,
                                    type: nextType,
                                    ...(nextType === "checkbox"
                                      ? { checked: f.checked ?? true, value: "" }
                                      : {}),
                                  }
                                : f
                            )
                          );
                        }}
                      >
                        <option value="text">Text</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                      {fieldType === "checkbox" && (
                        <label className="flex items-center gap-1 text-[11px] text-slate-300">
                          <input
                            type="checkbox"
                            className="accent-emerald-500"
                            checked={field.checked ?? true}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFields((prev) =>
                                prev.map((f) =>
                                  f.id === field.id ? { ...f, checked } : f
                                )
                              );
                            }}
                          />
                          <span>Checked</span>
                        </label>
                      )}
                    </div>
                    {fieldType === "text" && (
                      <div className="space-y-1">
                        <span className="block text-[10px] text-slate-400">
                          Value
                        </span>
                        <input
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-sky-500"
                          value={field.value}
                          onChange={(e) => {
                            const next = e.target.value;
                            setFields((prev) =>
                              prev.map((f) =>
                                f.id === field.id ? { ...f, value: next } : f
                              )
                            );
                          }}
                          placeholder="Text to render inside this box"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-slate-400">Font size</span>
                      <input
                        type="number"
                        className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 w-20 text-[11px]"
                        value={fieldFontSize}
                        min={6}
                        max={72}
                        onChange={(e) => {
                          const n = Number(e.target.value) || defaultFontSize;
                          setFields((prev) =>
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
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-slate-400">Color</span>
                      <input
                        type="color"
                        className="w-8 h-5"
                        value={fieldColor}
                        onChange={(e) => {
                          const nextColor = e.target.value || defaultColor;
                          setFields((prev) =>
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
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              {errorMessage && (
                <p className="text-xs text-red-400 mt-2">{errorMessage}</p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2 mt-2">
                <button
                  className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white disabled:opacity-50"
                  onClick={handleGenerate}
                  disabled={!pdfBase64 || fields.length === 0 || isFilling}
                >
                  {isFilling ? "Working…" : "Download Filled PDF"}
                </button>
                <p className="text-[11px] text-slate-500">
                  Downloads a flattened PDF matching your drawn fields.
                </p>
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
