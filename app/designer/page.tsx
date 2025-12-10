// app/designer/page.tsx

"use client";

import React from "react";
import PdfCanvas from "@/components/PdfCanvas";
import { useTemplateStore } from "@/store/templateStore";


export default function DesignerPage() {

  const currentFields = useTemplateStore((state) => state.currentFields);

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
          <h2 className="text-lg font-medium">Fields & Data Keys</h2>

          {currentFields.length === 0 ? (
            <p className="text-sm text-slate-400">
              Click and drag on the PDF to create a field region. New fields will appear
              here with auto-generated keys. We’ll make them editable later.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {currentFields.map((field) => (
                <li
                  key={field.id}
                  className="flex items-center justify-between rounded border border-slate-700 px-2 py-1"
                >
                  <div>
                    <div className="font-mono text-xs text-sky-300">
                      {field.key} <span className="text-slate-500">({field.type})</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      page {field.page + 1} • x={field.x.toFixed(2)}, y={field.y.toFixed(
                        2
                      )} • w={field.width.toFixed(2)}, h={field.height.toFixed(2)}
                    </div>
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
