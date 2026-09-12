import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function SocialAccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await canCurrentUserAccessPage("socialAccounts"))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
