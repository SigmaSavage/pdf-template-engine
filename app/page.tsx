// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-10 px-4 py-10">
      <section className="max-w-3xl text-center space-y-4">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Turn any PDF into a <span className="text-sky-400">designable, fillable</span> experience.
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          This portfolio project showcases a full PDF template engine: a visual designer,
          a live filler with canvas overlay, a template library, and a one-off "DocHub-style"
          fill experience, all powered by a reusable headless filling engine.
        </p>
      </section>

      <section className="flex flex-col sm:flex-row gap-4 items-center justify-center">
        <Link
          href="/examples"
          className="px-6 py-3 rounded-md bg-sky-600 hover:bg-sky-500 text-sm font-medium text-white text-center"
        >
          Explore UI examples
        </Link>
        <Link
          href="/about"
          className="px-6 py-3 rounded-md border border-slate-700 hover:border-slate-500 text-sm font-medium text-slate-100 text-center"
        >
          Read about the engine
        </Link>
      </section>

      <section className="max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-4 text-left text-xs sm:text-sm mt-4">
        <div className="border border-slate-800 rounded-lg p-3 bg-slate-950/70">
          <h2 className="font-semibold mb-1 text-slate-100">Visual template designer</h2>
          <p className="text-slate-400">
            Upload a PDF, draw normalized fields on a canvas, auto-detect existing form
            widgets, and save templates with schema keys for later reuse.
          </p>
        </div>
        <div className="border border-slate-800 rounded-lg p-3 bg-slate-950/70">
          <h2 className="font-semibold mb-1 text-slate-100">Live fill &amp; preview</h2>
          <p className="text-slate-400">
            Fill templates against a pdf.js canvas overlay, tweak layout and typography
            while you test, and download flattened or fillable PDFs.
          </p>
        </div>
        <div className="border border-slate-800 rounded-lg p-3 bg-slate-950/70">
          <h2 className="font-semibold mb-1 text-slate-100">Headless engine ready</h2>
          <p className="text-slate-400">
            Under the hood is a pdf-lib based engine and React store that can be
            extracted into an NPM package for real-world SaaS PDF workflows.
          </p>
        </div>
      </section>
    </main>
  );
}
