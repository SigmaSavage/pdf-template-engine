"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import PdfCanvas from "@/components/PdfCanvas";
import { fillPdfFromTemplate } from "@/lib/pdfEngine";
import { useTemplateStore } from "@/store/templateStore";
import type { PdfField, PdfFieldType } from "@/types/pdf";

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

export default function OneOffFillPage() {
  const currentPdfDataBase64 = useTemplateStore(
    (state) => state.currentPdfDataBase64
  );
  const currentFields = useTemplateStore((state) => state.currentFields);

  const [values, setValues] = useState<ValueMap>({});
  const [defaultFontSize, setDefaultFontSize] = useState<number>(10);
  const [defaultColor, setDefaultColor] = useState<string>("#000000");
  const [isFilling, setIsFilling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const schemaKeys: string[] = useMemo(() => {
    const unique = new Set<string>();
    for (const f of currentFields) {
      const key = f.key.trim();
      if (key) unique.add(key);
    }
    return Array.from(unique);
  }, [currentFields]);

  const keyTypes: Record<string, PdfFieldType> = useMemo(() => {
    const map: Record<string, PdfFieldType> = {};
    for (const field of currentFields) {
      if (!map[field.key]) {
        map[field.key] = field.type;
      }
    }
    return map;
  }, [currentFields]);

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

    if (!currentPdfDataBase64) {
      setErrorMessage("Upload a PDF first.");
      return;
    }
    if (currentFields.length === 0) {
      setErrorMessage("Draw at least one field on the PDF.");
      return;
    }

    try {
      setIsFilling(true);

      const data: ValueMap = {};
      for (const key of schemaKeys) {
        const v = values[key];
        data[key] = v ?? "";
      }

      const pdfBytes = base64ToUint8Array(currentPdfDataBase64);
      const effectiveFields: PdfField[] = currentFields.map((field) => {
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
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/designer"
            className="px-3 py-1 rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
          >
            ← Back to Designer
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
          <p className="text-sm text-slate-400 mb-2">Upload &amp; Place Fields</p>
          <PdfCanvas enableAutoDetect={false} />
        </section>

        <aside className="border border-slate-800 rounded-lg p-3 space-y-3">
          <h2 className="text-lg font-medium">Enter Values &amp; Download</h2>

          {!currentPdfDataBase64 ? (
            <p className="text-sm text-slate-400">
              Upload a PDF in the panel on the left to start.
            </p>
          ) : currentFields.length === 0 ? (
            <p className="text-sm text-slate-400">
              Click and drag on the PDF to create one or more fields. Then enter
              values for each key here.
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
                  Used for all fields when generating the filled PDF.
                </p>
              </div>

              <div className="max-h-[55vh] overflow-auto space-y-2 pr-1 mt-2">
                {schemaKeys.map((key) => {
                  const type = keyTypes[key] ?? "text";
                  const value = values[key] ?? (type === "checkbox" ? false : "");

                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 border border-slate-800 rounded px-2 py-1 text-xs"
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
                <p className="text-xs text-red-400 mt-2">{errorMessage}</p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-2 mt-2">
                <button
                  className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-xs font-medium text-white disabled:opacity-50"
                  onClick={handleGenerate}
                  disabled={!currentPdfDataBase64 || currentFields.length === 0 || isFilling}
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
