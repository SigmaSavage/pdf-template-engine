// types/pdfjs-worker.d.ts

declare module "pdfjs-dist/build/pdf.worker.mjs" {
  const src: string;
  export default src;
}

declare module "pdfjs-dist/build/pdf" {
  const pdfjsLib: any;
  export = pdfjsLib;
}
