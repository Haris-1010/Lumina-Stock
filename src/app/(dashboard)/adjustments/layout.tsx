import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function AdjustmentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await canCurrentUserAccessPage("adjustments"))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
