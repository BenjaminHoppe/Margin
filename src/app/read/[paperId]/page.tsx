import { studies } from "@/lib/catalog";
import { redirect } from "next/navigation";
import ReaderClient from "@/components/production/reader-client";
export default async function ReadPage({
  params,
}: {
  params: Promise<{ paperId: string }>;
}) {
  const { paperId } = await params;
  const study = studies.find((s) => s.slug === paperId);
  if (!study) redirect("/");
  return <ReaderClient study={study} />;
}
