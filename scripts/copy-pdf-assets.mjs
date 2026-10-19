import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { cpSync, mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const root = dirname(require.resolve("pdfjs-dist/package.json"));
mkdirSync("public/pdfjs", { recursive: true });
cpSync(
  join(root, "build/pdf.worker.min.mjs"),
  "public/pdfjs/pdf.worker.min.mjs",
);
for (const folder of ["cmaps", "standard_fonts", "wasm"])
  cpSync(join(root, folder), `public/pdfjs/${folder}`, { recursive: true });
