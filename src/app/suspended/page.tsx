import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getServerTranslator } from "@/lib/i18n-server";
import { formatDate } from "@/lib/utils";

export default async function SuspendedAccessPage() {
  const t = await getServerTranslator();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (user.organization.status !== "SUSPENDED") {
    redirect("/dashboard");
  }

  const reason = user.organization.suspensionReason || t("suspended.defaultReason");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10">
      <Card className="w-full max-w-xl border-red-200">
        <CardHeader>
          <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
            <ShieldAlert className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-zinc-900">{t("suspended.title")}</CardTitle>
          <CardDescription>
            {t("suspended.description", { organizationName: user.organization.name })}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {reason}
          </div>

          {user.organization.suspendedAt && (
            <p className="text-xs text-zinc-500">
              {t("suspended.onDate", { date: formatDate(user.organization.suspendedAt) })}
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild>
              <Link href="mailto:support@lumina-stock.com?subject=Tenant%20Suspension%20Review">
                {t("suspended.contactSupport")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
