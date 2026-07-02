import type { Metadata } from "next";
import { NamthegUpload } from "@/components/namtheg/upload";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Namtheg - Osooly",
};

/**
 * The Namtheg tab (PRD 3.7): entry point of the ported AutoML flow
 * (upload -> preview -> running -> result -> inference). The pipeline runs
 * in the FastAPI sidecar; this page starts a run by uploading a CSV.
 */
export default async function NamthegPage() {
  const session = await auth();
  return <NamthegUpload canUse={Boolean(session?.user?.id)} />;
}
