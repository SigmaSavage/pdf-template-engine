"use client";

import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="min-h-screen px-4 py-10 flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-400">
            About this project
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            pdf-template-engine
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-3xl">
            A Next.js demo that treats PDFs as designable canvases: visually place
            normalized fields, store them as JSON templates, and fill them with data
            using a headless engine that can be packaged for real products.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/70 space-y-2">
            <h2 className="font-semibold text-slate-100">What it solves</h2>
            <p className="text-slate-400">
              Many products still rely on static PDFs for invoices, contracts, and forms.
              pdf-template-engine demonstrates how to turn those PDFs into dynamic,
              data-driven documents that non-developers can layout visually while
              engineers integrate with APIs and backends.
            </p>
          </div>
          <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/70 space-y-2">
            <h2 className="font-semibold text-slate-100">Core ingredients</h2>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              <li>Next.js App Router + React</li>
              <li>pdf.js canvas rendering for previews</li>
              <li>pdf-lib for headless PDF manipulation</li>
              <li>Zustand store for templates and designer state</li>
              <li>Normalized field coordinates for resolution independence</li>
            </ul>
          </div>
        </section>

        <section className="border border-slate-800 rounded-lg p-4 bg-slate-950/70 space-y-3 text-xs sm:text-sm">
          <h2 className="font-semibold text-slate-100">Current features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <h3 className="text-[13px] font-semibold text-slate-100">Template Designer</h3>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Upload any PDF and navigate pages with pdf.js.</li>
                <li>Draw, move, resize fields on a canvas overlay.</li>
                <li>Assign keys and types (text, number, date, checkbox).</li>
                <li>Auto-detect existing AcroForm fields when possible.</li>
                <li>Save templates with timestamps and schema key lists.</li>
              </ul>
            </div>
            <div className="space-y-1">
              <h3 className="text-[13px] font-semibold text-slate-100">Template Library</h3>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Thumbnail previews of saved templates.</li>
                <li>Edit, duplicate, or delete templates.</li>
                <li>Jump directly into Designer or Fill with a selected template.</li>
                <li>Export any template as a proper fillable (AcroForm) PDF.</li>
              </ul>
            </div>
            <div className="space-y-1">
              <h3 className="text-[13px] font-semibold text-slate-100">Fill &amp; Review</h3>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Live pdf.js canvas preview with overlayed fields.</li>
                <li>Data-entry card driven by template schema keys.</li>
                <li>Hover and click rows to highlight/select fields in the preview.</li>
                <li>Adjust field layout and per-field font size/color while filling.</li>
                <li>Save layout changes back to the template or branch as a new one.</li>
              </ul>
            </div>
            <div className="space-y-1">
              <h3 className="text-[13px] font-semibold text-slate-100">One-off Fill (DocHub-style)</h3>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                <li>Upload a plain PDF with no saved template.</li>
                <li>Draw fields visually and assign simple keys.</li>
                <li>Enter values once in a side card.</li>
                <li>Download a flattened filled PDF without storing anything.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="border border-slate-800 rounded-lg p-4 bg-slate-950/70 space-y-3 text-xs sm:text-sm">
          <h2 className="font-semibold text-slate-100">Headless engine vision</h2>
          <p className="text-slate-400">
            Underneath the UI is a pdf-lib based function,
            <span className="font-mono text-slate-200"> fillPdfFromTemplate </span>, that
            takes raw PDF bytes, an array of normalized fields, and a data object, and
            returns a filled PDF. Paired with the Zustand template store, this is intended
            to evolve into a small NPM package with three entrypoints: a core engine,
            React hooks/store, and ready-made Designer/Filler components.
          </p>
        </section>

        <section className="flex flex-wrap gap-3 text-xs sm:text-sm">
          <Link
            href="/examples"
            className="px-3 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium"
          >
            Browse the examples
          </Link>
          <Link
            href="/designer"
            className="px-3 py-2 rounded-md border border-slate-700 hover:border-sky-500 text-slate-100"
          >
            Jump into the Designer
          </Link>
          <Link
            href="/fill"
            className="px-3 py-2 rounded-md border border-slate-700 hover:border-sky-500 text-slate-100"
          >
            Try Fill &amp; Review
          </Link>
          <Link
            href="/one-off-fill"
            className="px-3 py-2 rounded-md border border-slate-700 hover:border-sky-500 text-slate-100"
          >
            Try one-off filling
          </Link>
        </section>
      </div>
    </main>
  );
}
