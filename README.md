## pdf-template-engine

An in-browser PDF template designer and filler, built as a Next.js app and evolving into a reusable headless and UI library.

This repository currently serves two purposes:

- A **fully working web app** you can run today to design templates, fill them, and generate PDFs in the browser.
- The **reference implementation** for a future NPM package (`pdf-template-engine`) with:
	- A headless core `fillPdfFromTemplate` API.
	- A React store/hooks layer for managing templates.
	- Drop-in Designer and Filler UI components.

---

## Overview

### What this project solves

pdf-template-engine is for developers who need to turn static PDFs into dynamic, data-driven documents:

- Let non-technical users **upload a PDF** and **draw fields** visually on top of it.
- Save those fields as **normalized JSON templates** that are independent of pixel sizes.
- Later, **fill templates with data** to produce new PDFs entirely in the browser.

Typical use cases:

- SaaS apps that let customers design their own invoice, contract, or report layouts.
- Internal tools where operations teams maintain PDFs but engineers automate the filling.
- Automated workflows where you generate PDFs from structured data (CRM, forms, APIs, etc.).

### Normalized field mapping

Each field is stored with normalized coordinates relative to the page size:

- $x, y, width, height \in [0, 1]$ measured from the **top-left** of the page.
- These normalized values are then mapped to actual pixels when rendering or filling.

Benefits:

- Templates are **resolution-independent** and work across devices and render scales.
- You can resize the canvas or render thumbnails without changing the template JSON.

### UI vs headless modes

This repository currently provides:

- A **Designer UI** (at `/designer`):
	- Upload a PDF.
	- Draw fields visually.
	- Name and type each field (text, number, date, checkbox).
	- Save reusable templates in local storage.

- A **Filler UI** (at `/fill`):
	- Choose a saved template.
	- Enter values for each field.
	- Generate and preview/download the filled PDF.

- A **headless core engine** (already implemented internally in `lib/pdfEngine.ts`):
	- `fillPdfFromTemplate({ pdfBytes, fields, data })` uses pdf-lib to write values into a PDF.

In the future, these pieces will be exposed as a **proper NPM package** so you can:

- Use the **headless engine** in Node.js or the browser without this app.
- Use the **store/hooks** to build your own custom UIs.
- Drop in ready-made **Designer** and **Filler** components.

---

## Running the app locally

This repo is currently a Next.js 16 app (App Router) that doubles as a playground for the future package.

### Prerequisites

- Node.js 18+ recommended.

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

Key routes:

- `/designer` – PDF Template Designer.
- `/fill` – PDF Filler using saved templates.
- `/templates` – Template Library (thumbnails, duplicate, delete, edit).

---

## Current architecture

At a high level, the app is organized as:

- `app/` – Next.js App Router pages:
	- `app/designer/page.tsx` – main Designer UI.
	- `app/fill/page.tsx` – main Filler UI.
	- `app/templates/page.tsx` – Template Library / management.

- `components/` – Reusable UI pieces:
	- `PdfCanvas` – renders PDFs (via pdf.js) and hosts the field overlay.
	- `FieldOverlay` – interactive overlay for drawing, selecting, moving, resizing fields.
	- `FieldEditorModal`, `KeySelector`, etc. – support components for editing fields.

- `store/` – Global state (Zustand):
	- `store/templateStore.ts` – manages templates, the active template, and current designer state.

- `lib/` – Core logic:
	- `lib/pdfEngine.ts` – headless filling engine using pdf-lib.

- `types/` – Shared types:
	- `types/pdf.ts` – `PdfField`, `PdfTemplate`, and related types.

---

## Template JSON format

The core template shape is defined in `types/pdf.ts`.

### Fields

```ts
export type PdfFieldType = "text" | "number" | "date" | "checkbox";

export interface PdfField {
	id: string;
	page: number;
	x: number;      // 0..1, left
	y: number;      // 0..1, top
	width: number;  // 0..1, relative to page width
	height: number; // 0..1, relative to page height
	key: string;    // schema key
	type: PdfFieldType;
}
```

Notes:

- `page` is zero-based (0 = first page).
- `x, y` are normalized from the **top-left** corner of the page.
- `width, height` are normalized against the full page size.
- `key` is the logical name used when you later fill the template (e.g. `customerName`).

### Templates

```ts
export interface PdfTemplate {
	id: string;
	name: string;
	pdfDataBase64: string; // base64-encoded PDF bytes
	fields: PdfField[];
	schemaKeys: string[];
	createdAt: string;
	updatedAt?: string;
}
```

How it is used today:

- The Designer stores templates in a persisted Zustand store.
- `pdfDataBase64` contains the original uploaded PDF.
- `fields` is the full list of positioned fields.
- `schemaKeys` is a deduplicated list of all field keys for quick access.

How you might store templates in your own backend:

- Save the template object as a JSON document in your database.
- Store `pdfDataBase64` as-is, or convert it back to a binary blob.
- On retrieval, decode `pdfDataBase64` to bytes, and pass the bytes + `fields` into the filling engine.

---

## Headless filling engine (current implementation)

The core filling logic already exists in `lib/pdfEngine.ts` as `fillPdfFromTemplate`.

```ts
import { fillPdfFromTemplate } from "./lib/pdfEngine";

const filledBytes = await fillPdfFromTemplate({
	pdfBytes,   // Uint8Array | ArrayBuffer of the base PDF
	fields,     // PdfField[] from your template
	data: {
		customerName: "Alice",
		total: 123.45,
		accepted: true,
	},
});
```

Behavior:

- Uses pdf-lib to load the PDF.
- For each field, computes the text/checkbox position from normalized coordinates.
- For `checkbox` fields, interprets a variety of truthy values (`true`, `"yes"`, `1`, `"on"`, etc.).
- Draws text or an `X` at the calculated position.
- Returns a `Uint8Array` of the filled PDF.

> Note: This function is currently imported locally inside the app. In the future NPM package, it will be exposed as a first-class export.

---

## React store / hooks (current implementation)

The global template state is powered by Zustand in `store/templateStore.ts`.

Key ideas:

- Persists **only** `templates` and `activeTemplateId` to localStorage.
- Keeps `currentPdfDataBase64` and `currentFields` **ephemeral** so the Designer can reset state cleanly.

Selected APIs (current, internal):

- `useTemplateStore()` – main hook.
	- `templates: PdfTemplate[]` – all saved templates.
	- `activeTemplateId: string | null` – which template is currently selected.
	- `currentPdfDataBase64: string | null` – PDF currently open in Designer.
	- `currentFields: PdfField[]` – fields currently being edited.

- Actions for templates:
	- `addTemplate(template)`
	- `updateTemplate(template)`
	- `updateTemplateFields(id, fields)`
	- `deleteTemplate(id)`
	- `duplicateTemplate(id)`

- Actions for the current Designer session:
	- `setCurrentPdf(data, name)`
	- `setCurrentFields(fields)`
	- `addCurrentField(field)`
	- `updateCurrentField(id, patch)`
	- `removeCurrentField(id)`
	- `clearCurrent()`

> In the future package, these will be reshaped into a public `useTemplateStore` API exported from a `/react` entrypoint.

---

## UI components and flows

Although currently wired as Next.js pages, the Designer and Filler are intentionally structured so they can be extracted into reusable components later.

### Designer

The Designer combines:

- `PdfCanvas` – Renders the PDF using pdf.js and manages page navigation.
- `FieldOverlay` – Lets users draw, move, and resize fields directly on top of the PDF.
- A side panel for:
	- Listing fields.
	- Editing keys and types.
	- Saving/updating templates.

It also supports:

- Optional auto-detection of fillable fields from PDFs that contain AcroForm widgets.
- Unsaved-change detection when switching templates.
- A Template selector and a "New template" option.

### Filler

The Filler page:

- Lets users choose a saved template.
- Renders a form based on the template fields.
- Uses the core engine to generate a filled PDF.
- Shows a live preview of the generated PDF in-browser.

### Template Library

The Templates page:

- Shows all saved templates with thumbnails of the first page.
- Displays `createdAt` and `updatedAt` timestamps and field counts.
- Lets you **Edit**, **Duplicate**, or **Delete** templates.

---

## Planned NPM package structure

This repo is evolving toward a published package. The intended public API (subject to change) is:

### 1) Core engine

```ts
import { fillPdfFromTemplate } from "pdf-template-engine"; // planned entrypoint
```

Status:

- Implementation exists internally (`lib/pdfEngine.ts`).
- TODO: Extract to a proper package entrypoint and add tests.

### 2) React store / hooks

```ts
import { useTemplateStore } from "pdf-template-engine/react"; // planned
```

Status:

- Implementation exists internally (`store/templateStore.ts`).
- TODO: Define and document a stable public API surface.

### 3) UI components

```tsx
import { PdfDesigner, PdfFiller } from "pdf-template-engine/ui"; // planned

export default function MyPage() {
	return <PdfDesigner />;
}
```

Status:

- Functionality exists as Next.js pages and shared components.
- TODO: Extract into standalone React components and package entrypoints.

---

## Integration ideas for SaaS / backend developers

Once the package API is finalized, a typical multi-tenant flow could look like:

1. **Builder flow (in your admin UI)**
	 - Embed `PdfDesigner` in an admin-only route.
	 - When a user saves a template, send the template JSON to your backend.
	 - Store templates keyed by tenant and use-case.

2. **Filler flow (in your app)**
	 - Fetch a template for the current tenant.
	 - Render a custom form or embed `PdfFiller`.
	 - On submit, call `fillPdfFromTemplate` with the template fields and user data.
	 - Return the resulting PDF to the browser or email it to the user.

3. **Fully headless (e.g., cron jobs, webhooks)**
	 - In a backend job, load the base PDF and template fields.
	 - Call `fillPdfFromTemplate` with data from your database or external APIs.
	 - Store the resulting PDF or send it downstream (e.g., S3, email, e-sign).

---

## Licensing (planned)

The long-term plan is to release this project under a **dual-license** model:

- **Noncommercial use** under the Polyform Noncommercial License 1.0.0.
- **Commercial use** under a separate paid commercial license.

Intended behavior:

- Personal, educational, and non-commercial projects may use the library for free under the Noncommercial license.
- Commercial usage (SaaS, internal line-of-business apps, client work, etc.) will require a purchased license.

Status:

- TODO: Add `LICENSE` (Polyform Noncommercial 1.0.0).
- TODO: Add `LICENSE-COMMERCIAL` with the commercial terms and purchase/contact information.

Until those files are added, treat the licensing model as **work in progress**.

---

## Project status and future work

Current status:

- Core app flows (Designer, Filler, Template Library) are working end-to-end.
- Headless `fillPdfFromTemplate` engine is implemented and used by the app.
- Templates are persisted locally using Zustand + localStorage.

Planned work:

- Extract and stabilize the package entrypoints (`core`, `/react`, `/ui`).
- Add tests around the headless engine and template store.
- Finalize and document the dual-license model.
- Publish the NPM package and provide hosted demos.

Contributions and feedback are welcome as the project moves from "app only" to a reusable library.
