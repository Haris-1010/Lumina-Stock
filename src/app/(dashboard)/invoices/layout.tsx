import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function InvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canCurrentUserAccessPage("invoices");
  if (!canAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
