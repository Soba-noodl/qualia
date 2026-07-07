/**
 * Client-side text extraction from uploaded files.
 * Supports .txt, .md, .pdf and .docx files.
 */

const SUPPORTED_TEXT_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * Extract text content from a File.
 * - .txt / .md → read as UTF-8 text
 * - .pdf → extract via pdf.js
 * - .docx → extract via mammoth.js
 * Throws on unsupported types or extraction failure.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  let raw: string;

  if (
    file.type === "application/pdf" ||
    /\.pdf$/i.test(file.name)
  ) {
    raw = await extractTextFromPdf(file);
  } else if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(file.name)
  ) {
    raw = await extractTextFromDocx(file);
  } else if (
    SUPPORTED_TEXT_TYPES.includes(file.type) ||
    /\.(txt|md)$/i.test(file.name)
  ) {
    raw = await file.text();
  } else {
    throw new Error(`Unsupported file type: ${file.type || file.name}`);
  }

  // Strip null bytes — PostgreSQL TEXT columns cannot store \u0000
  return raw.replace(/\0/g, "");
}

async function extractTextFromPdf(file: File): Promise<string> {
  // Dynamic import so the 3 MB worker is only loaded when needed
  const pdfjsLib = await import("pdfjs-dist");

  // Use the bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n\n");
}

async function extractTextFromDocx(file: File): Promise<string> {
  // Dynamic import so the library is only loaded when needed
  const mammothModule = await import("mammoth/mammoth.browser");
  // Some bundlers expose the module as default, others as namespace; support both.
  const mammoth: typeof import("mammoth") =
    // @ts-expect-error - runtime fallback: bundlers differ on default vs namespace export
    (mammothModule.default as typeof import("mammoth")) ?? (mammothModule as typeof import("mammoth"));

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value ?? "";
}

/** File types accepted by the additional-context file picker. */
export const CONTEXT_FILE_ACCEPT = ".pdf,.txt,.md,.doc,.docx";

/** Max individual file size: 10 MB */
export const CONTEXT_FILE_MAX_SIZE = 10 * 1024 * 1024;

/** Validate a context file before extraction. Returns error message or null. */
export function validateContextFile(file: File): string | null {
  const validExtensions = /\.(pdf|txt|md|doc|docx)$/i;
  const validTypes = SUPPORTED_TEXT_TYPES;

  if (!validTypes.includes(file.type) && !validExtensions.test(file.name)) {
    return "Unsupported file type. Please upload PDF, TXT, MD, or Word (.docx) files.";
  }
  if (file.size > CONTEXT_FILE_MAX_SIZE) {
    return "File is too large. Maximum size is 10 MB.";
  }
  return null;
}
