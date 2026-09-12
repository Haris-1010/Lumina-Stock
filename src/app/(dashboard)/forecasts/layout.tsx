import { canCurrentUserAccessPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function ForecastsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const canAccess = await canCurrentUserAccessPage("forecasts");
  if (!canAccess) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
