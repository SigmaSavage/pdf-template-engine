// app/fill/page.tsx
import React from "react";

export default function FillPage() {
  return (
    <div className="min-h-screen flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h1 className="text-2xl font-semibold">Fill & Review</h1>
        <span className="text-sm text-slate-400">Use saved templates to fill PDFs</span>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[2fr,1fr] gap-4">
        <section className="border border-slate-800 rounded-lg p-3">
          <p className="text-sm text-slate-400 mb-2">Filled PDF Preview (coming soon)</p>
          <div className="h-[70vh] flex items-center justify-center text-slate-500 text-sm border border-dashed border-slate-700 rounded">
            Select a template + data to see the filled PDF here.
          </div>
        </section>

        <aside className="border border-slate-800 rounded-lg p-3 space-y-3">
          <h2 className="text-lg font-medium">Values</h2>
          <p className="text-sm text-slate-400">
            You’ll be able to edit final values here before exporting.
          </p>
        </aside>
      </main>
    </div>
  );
}
