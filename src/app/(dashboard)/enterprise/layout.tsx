import { requireEnterpriseAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function EnterpriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireEnterpriseAdmin();
  } catch {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
