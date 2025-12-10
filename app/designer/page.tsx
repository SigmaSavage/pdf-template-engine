// app/designer/page.tsx
import React from "react";

export default function DesignerPage() {
  return (
    <div className="min-h-screen flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h1 className="text-2xl font-semibold">PDF Template Designer</h1>
        <span className="text-sm text-slate-400">MVP • v0.1</span>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-4">
        <section className="border border-slate-800 rounded-lg p-3">
          <p className="text-sm text-slate-400 mb-2">PDF Canvas (coming soon)</p>
          {/* PdfCanvas and overlays will go here */}
          <div className="h-[70vh] flex items-center justify-center text-slate-500 text-sm border border-dashed border-slate-700 rounded">
            Upload a PDF to start designing fields.
          </div>
        </section>

        <aside className="border border-slate-800 rounded-lg p-3 space-y-3">
          <h2 className="text-lg font-medium">Fields & Data Keys</h2>
          <p className="text-sm text-slate-400">
            Here you’ll see a list of defined fields and their mapped keys.
          </p>
        </aside>
      </main>
    </div>
  );
}
