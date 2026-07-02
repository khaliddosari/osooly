import type { Metadata } from "next";
import { NamthegResult } from "@/components/namtheg/result";

export const metadata: Metadata = {
  title: "Model results - Osooly",
};

/** Step 4 of the Namtheg flow (PRD 3.7): the champion model's report card. */
export default async function NamthegResultPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <NamthegResult runId={runId} />;
}
