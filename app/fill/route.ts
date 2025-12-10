// app/api/fill/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  // Later: accept { templateId, data }, run pdfEngine, return PDF
  return NextResponse.json({ ok: true, message: "Fill endpoint stub" });
}
