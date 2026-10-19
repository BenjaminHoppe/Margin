"use client";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
const options = {
  cMapUrl: "/pdfjs/cmaps/",
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  wasmUrl: "/pdfjs/wasm/",
};
export default function Thumbnail({
  url,
  title,
}: {
  url: string;
  title: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={host} className="thumbnail-host">
      {visible ? (
        <Document
          file={url}
          options={options}
          loading={<span className="thumbnail-placeholder">{title}</span>}
          error={<span className="thumbnail-placeholder">{title}</span>}
        >
          <Page
            pageNumber={1}
            width={280}
            devicePixelRatio={1.5}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      ) : (
        <span className="thumbnail-placeholder">{title}</span>
      )}
    </div>
  );
}
