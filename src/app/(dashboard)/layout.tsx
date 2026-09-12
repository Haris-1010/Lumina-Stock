import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { getNotificationSummaryForCurrentOrganization } from "@/lib/actions/notifications";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserWithPermissions();

  if (!profile) {
    redirect("/sign-in");
  }

  const { user, permissions } = profile;

  if (user.organization.status === "SUSPENDED") {
    redirect("/suspended");
  }

  const canAccessPlatformControls =
    permissions.pages.platformTenants || permissions.pages.platformAudit;

  const notificationSummary = await getNotificationSummaryForCurrentOrganization(12);

  const org = user.organization as any;
  const colorAccent = org.theme ?? "emerald";

  return (
    <DashboardShell
      colorAccent={colorAccent}
      orgName={user.organization.name}
      orgLogoUrl={user.organization.logoUrl ?? undefined}
      userName={user.name}
      showEnterprise={canAccessPlatformControls}
      pagePermissions={permissions.pages}
      initialNotifications={notificationSummary.notifications}
      initialUnreadCount={notificationSummary.unreadCount}
    >
      {children}
    </DashboardShell>
  );
}
