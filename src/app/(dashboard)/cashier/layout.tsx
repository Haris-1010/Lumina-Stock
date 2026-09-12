import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function CashierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canCurrentUserAccessPage("cashier");
  if (!canAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
