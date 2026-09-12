import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function RecordControlsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canCurrentUserAccessPage("recordControls");
  if (!canAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
