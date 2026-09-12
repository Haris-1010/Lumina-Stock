import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

// Guards /marketing and all sub-pages (analytics, campaigns, content, email, seo).
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await canCurrentUserAccessPage("marketing"))) {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
