import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function LabourLayout({ children }: { children: React.ReactNode }) {
  if (!(await canCurrentUserAccessPage("labour"))) redirect("/dashboard");
  return <>{children}</>;
}
