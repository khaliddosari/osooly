import { redirect } from "next/navigation";

/** The dashboard is the home of the app (PRD §3.4). */
export default function Home() {
  redirect("/dashboard");
}
