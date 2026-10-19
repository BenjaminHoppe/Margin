"use client";
import Reader from "./reader";
import { NEPTUNE } from "@/lib/study";
// Fixed study for this pass. Document-specific persistence remains intact.
export default function DocumentWorkspace() {
  return <Reader study={NEPTUNE} focused />;
}
