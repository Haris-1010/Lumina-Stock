import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function PlatformTenantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canCurrentUserAccessPage("platformTenants");
  if (!canAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
