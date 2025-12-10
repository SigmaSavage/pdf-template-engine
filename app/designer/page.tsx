// app/designer/page.tsx

"use client";

import React from "react";
import PdfCanvas from "@/components/PdfCanvas";
import { useTemplateStore } from "@/store/templateStore";


export default function DesignerPage() {

  const currentFields = useTemplateStore((state) => state.currentFields);
  const updateCurrentField = useTemplateStore((state) => state.updateCurrentField);
  const removeCurrentField = useTemplateStore((state) => state.removeCurrentField)

  return (
    <div className="min-h-screen flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h1 className="text-2xl font-semibold">PDF Template Designer</h1>
        <span className="text-sm text-slate-400">MVP • v0.1</span>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-4">
        <section className="border border-slate-800 rounded-lg p-3">
          <p className="text-sm text-slate-400 mb-2">PDF Canvas</p>
          <PdfCanvas />
        </section>

        <aside className="border border-slate-800 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Fields & Data Keys</h2>
            {/* Future: Save template button could go here */}
          </div>

          {currentFields.length === 0 ? (
            <p className="text-sm text-slate-400">
              Click and drag on the PDF to create a field region. New fields will appear
              here with auto-generated keys. You can rename them and change types.
            </p>
          ) : (
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
          )}
        </aside>

      </main>
    </div>
  );
}
