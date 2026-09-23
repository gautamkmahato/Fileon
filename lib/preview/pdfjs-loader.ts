/** Lazy-load pdfjs-dist + worker (client-only; keeps it out of the initial bundle). */

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export async function loadPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (typeof window === "undefined") {
    throw new Error("PDF.js can only load in the browser");
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      }
      return pdfjs;
    });
  }
  return pdfjsPromise;
}
