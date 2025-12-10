// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">PDF Template Engine</h1>
        <p className="text-slate-400 max-w-xl">
          Turn static PDFs into data-driven templates. Start by designing fields on a PDF,
          then fill them programmatically or via a review screen.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/designer"
          className="px-5 py-3 rounded-md bg-sky-600 hover:bg-sky-500 text-sm font-medium text-white text-center"
        >
          Open Template Designer
        </Link>
        <Link
          href="/fill"
          className="px-5 py-3 rounded-md border border-slate-700 hover:border-slate-500 text-sm font-medium text-slate-100 text-center"
        >
          Go to Fill & Review
        </Link>
      </div>
    </main>
  );
}
