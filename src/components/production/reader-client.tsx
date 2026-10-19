"use client";
import type { Study } from "@/lib/study";
import dynamic from "next/dynamic";
const Reader = dynamic(() => import("./reader"), {
  ssr: false,
  loading: () => <div className="boot">Opening Margin…</div>,
});
export default function ReaderClient({ study }: { study: Study }) {
  return <Reader key={study.id} study={study} />;
}
