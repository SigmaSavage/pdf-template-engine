// app/api/templates/route.ts
import { NextResponse } from "next/server";
import { listTemplates } from "@/lib/templateStore";

export async function GET() {
  const templates = listTemplates();
  return NextResponse.json(templates);
}

// POST for creating templates will go here later
