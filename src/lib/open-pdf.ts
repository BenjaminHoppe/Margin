import { pdfjs } from "react-pdf";
import {
  BUILTIN_STUDIES,
  documentId,
  filenameTitle,
  type Study,
} from "./study";
import {
  storeDocument,
  openStoredDocument,
  type StoredDocument,
} from "./document-store";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
export async function inspectPdf(
  file: File,
): Promise<{ study: Study; warning: string; stored?: StoredDocument }> {
  if (!file.size)
    throw new Error("This file is empty. Choose a PDF with at least one page.");
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const builtin = BUILTIN_STUDIES.find((study) => study.hash === hash);
  if (builtin) return { study: builtin, warning: "" };
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    cMapUrl: "/pdfjs/cmaps/",
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
  });
  try {
    const pdf = await task.promise;
    const metadata = await pdf.getMetadata().catch(() => null);
    const info = metadata?.info as
      { Title?: string; Author?: string; CreationDate?: string } | undefined;
    const metadataTitle =
      typeof info?.Title === "string" ? info.Title.trim() : "";
    const title =
      metadataTitle && !/^untitled$/i.test(metadataTitle)
        ? metadataTitle
        : filenameTitle(file.name);
    const author = typeof info?.Author === "string" ? info.Author.trim() : "";
    const year = info?.CreationDate?.match(/^(?:D:)?(\d{4})/)?.[1];
    const stored: StoredDocument = {
      id: documentId(hash),
      hash,
      title,
      shortTitle: title,
      subtitle: [author, year].filter(Boolean).join(" · ") || file.name,
      pageCount: pdf.numPages,
      fileName: file.name,
      sections: [],
      uploaded: true,
      blob: file,
    };
    let warning = "";
    try {
      await storeDocument(stored);
    } catch {
      warning =
        "This PDF is open for this tab only because browser file storage is unavailable. Reselect it after reload to recover its saved notes.";
    }
    return {
      study: openStoredDocument(stored),
      warning,
      stored: warning ? undefined : stored,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The PDF could not be opened.";
    throw new Error(
      /password/i.test(message)
        ? "Password-protected PDFs are not supported yet. Choose an unlocked copy."
        : `Could not open this PDF. ${message}`,
    );
  } finally {
    await task.destroy();
  }
}
