import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EnterpriseAuditTable } from "@/components/enterprise/enterprise-audit-table";
import { EnterpriseAuditExportSnapshots } from "@/components/enterprise/enterprise-audit-export-snapshots";
import {
  getEnterpriseAuditExportSnapshots,
  getEnterpriseAuditLogs,
} from "@/lib/actions/enterprise-tenants";
import { getServerTranslator } from "@/lib/i18n-server";

export default async function EnterpriseAuditPage() {
  const t = await getServerTranslator();

  const [entries, snapshots] = await Promise.all([
    getEnterpriseAuditLogs(800),
    getEnterpriseAuditExportSnapshots(200),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("enterprise.auditPage.title")}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("enterprise.auditPage.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("enterprise.auditPage.eventsTitle")}</CardTitle>
          <CardDescription>
            {t("enterprise.auditPage.eventsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnterpriseAuditTable entries={entries} referenceNowIso={new Date().toISOString()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("enterprise.auditPage.snapshotsTitle")}</CardTitle>
          <CardDescription>
            {t("enterprise.auditPage.snapshotsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnterpriseAuditExportSnapshots snapshots={snapshots} />
        </CardContent>
      </Card>
    </div>
  );
}
