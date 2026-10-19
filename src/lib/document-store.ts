import type { Study } from "./study";
export type StoredDocument = Omit<Study, "url"> & { blob: Blob };
export const ACTIVE_DOCUMENT_KEY = "margin:active-document:v2";
const DB_NAME = "margin-documents";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("pdfs", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Browser storage is busy in another tab."));
  });
}
export async function storeDocument(document: StoredDocument) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("pdfs", "readwrite");
      tx.objectStore("pdfs").put(document);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error ?? new Error("PDF storage was interrupted."));
    });
  } finally {
    db.close();
  }
}
export async function storedDocuments(): Promise<StoredDocument[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("pdfs", "readonly")
        .objectStore("pdfs")
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export function openStoredDocument({
  blob,
  ...metadata
}: StoredDocument): Study {
  return { ...metadata, url: URL.createObjectURL(blob), uploaded: true };
}
