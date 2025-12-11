"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import TemplateThumbnail from "@/components/TemplateThumbnail";
import { useTemplateStore } from "@/store/templateStore";

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function TemplatesLibraryPage() {
  const router = useRouter();
  const templates = useTemplateStore((state) => state.templates);
  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);
  const duplicateTemplate = useTemplateStore((state) => state.duplicateTemplate);
  const setActiveTemplate = useTemplateStore((state) => state.setActiveTemplate);
  const clearCurrent = useTemplateStore((state) => state.clearCurrent);

  const sorted = [...templates].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.createdAt);
    const bTime = Date.parse(b.updatedAt || b.createdAt);
    return bTime - aTime;
  });

  const handleEdit = (id: string) => {
    setActiveTemplate(id);
    // Ensure any in-progress PDF/fields from another template are cleared so
    // Designer rehydrates cleanly from this template instead of showing
    // stale data and unsaved-change warnings.
    clearCurrent();
    router.push("/designer");
  };

  const handleDelete = (id: string, name: string) => {
    const ok = window.confirm(
      `Delete template "${name}"? This cannot be undone.`
    );
    if (!ok) return;
    deleteTemplate(id);
  };

  const handleDuplicate = (id: string) => {
    duplicateTemplate(id);
  };

  return (
    <div className="min-h-screen flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h1 className="text-2xl font-semibold">Template Library</h1>
          <p className="text-sm text-slate-400">
            Manage saved templates: preview, edit, duplicate, or delete.
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

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-400 mt-4">
          No templates saved yet. Create one in the Designer.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((t) => (
            <div
              key={t.id}
              className="flex gap-3 border border-slate-800 rounded-lg p-3 bg-slate-950/80"
            >
              <TemplateThumbnail pdfDataBase64={t.pdfDataBase64} />
              <div className="flex-1 flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-medium truncate" title={t.name}>
                    {t.name}
                  </h2>
                  <span className="text-[11px] text-slate-500">
                    {t.fields.length} field{t.fields.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <div>Created: {formatDate(t.createdAt)}</div>
                  <div>Last edited: {formatDate(t.updatedAt || t.createdAt)}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <button
                    className="px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white"
                    onClick={() => handleEdit(t.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="px-2 py-1 rounded border border-slate-600 text-slate-100 hover:bg-slate-800"
                    onClick={() => handleDuplicate(t.id)}
                  >
                    Duplicate
                  </button>
                  <button
                    className="ml-auto px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white"
                    onClick={() => handleDelete(t.id, t.name)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
