import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canCurrentUserAccessPage("search");
  if (!canAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
