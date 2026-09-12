import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function PlatformAuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canCurrentUserAccessPage("platformAudit");
  if (!canAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
