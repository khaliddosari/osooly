import type { Metadata } from "next";
import { NamthegPreview } from "@/components/namtheg/preview";

export const metadata: Metadata = {
  title: "Dataset preview - Osooly",
};

/** Step 2 of the Namtheg flow (PRD 3.7): inspect the dataset, pick a target. */
export default async function NamthegPreviewPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <NamthegPreview runId={runId} />;
}
