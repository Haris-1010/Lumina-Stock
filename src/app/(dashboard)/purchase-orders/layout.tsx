import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function PurchaseOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canCurrentUserAccessPage("purchaseOrders");
  if (!canAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
