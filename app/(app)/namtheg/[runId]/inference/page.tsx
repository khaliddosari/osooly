import type { Metadata } from "next";
import { NamthegInference } from "@/components/namtheg/inference";

export const metadata: Metadata = {
  title: "Inference - Osooly",
};

/** Step 5 of the Namtheg flow (PRD 3.7): live predictions from the champion. */
export default async function NamthegInferencePage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <NamthegInference runId={runId} />;
}
