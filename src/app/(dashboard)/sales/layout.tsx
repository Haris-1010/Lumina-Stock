import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function SalesHistoryLayout({ children }: { children: React.ReactNode }) {
  if (!(await canCurrentUserAccessPage("sales"))) redirect("/dashboard");
  return <>{children}</>;
}
