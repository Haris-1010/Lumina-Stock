import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canCurrentUserAccessPage("inventory");
  if (!canAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
