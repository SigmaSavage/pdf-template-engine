// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PDF Template Engine",
  description: "Designer + engine for turning PDFs into data-driven templates.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-slate-900/80 bg-slate-950/90 backdrop-blur">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="text-sm font-semibold tracking-wide text-sky-400 uppercase">
                  pdf-template-engine
                </span>
                
              </Link>
              <nav className="flex items-center gap-3 text-xs sm:text-sm">
                
                <Link
                  href="/about"
                  className="px-2 py-1 rounded hover:bg-slate-900 text-slate-200"
                >
                  About
                </Link>
                <Link
                  href="/examples"
                  className="px-2 py-1 rounded hover:bg-slate-900 text-slate-200"
                >
                  Examples
                </Link>
                <span className="hidden sm:inline-block h-5 w-px bg-slate-800" />
                <Link
                  href="/designer"
                  className="px-2 py-1 rounded border border-slate-700 hover:border-sky-500 text-slate-100"
                >
                  Open Designer
                </Link>
                <Link
                  href="/one-off-fill"
                  className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-slate-50 font-medium"
                >
                  Fill &amp; Download
                </Link>
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-slate-900/80 text-[11px] text-slate-500">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
              <span>PDF Template Engine · Portfolio prototype</span>
              <span className="hidden sm:inline">
                Built with Next.js, pdf.js, pdf-lib, and Zustand.
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
