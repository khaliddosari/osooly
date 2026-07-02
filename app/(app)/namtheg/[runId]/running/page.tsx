import type { Metadata } from "next";
import { NamthegRunning } from "@/components/namtheg/running";

export const metadata: Metadata = {
  title: "Pipeline running - Osooly",
};

/** Step 3 of the Namtheg flow (PRD 3.7): watch the pipeline execute. */
export default async function NamthegRunningPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <NamthegRunning runId={runId} />;
}
