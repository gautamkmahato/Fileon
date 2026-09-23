import { redirect } from "next/navigation";

/** Legacy route — redirects to Dashboard. */
export default function LegacyDrivePage() {
  redirect("/dashboard");
}
