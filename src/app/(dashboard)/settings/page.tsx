import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { MessageCircle, ChevronRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiKeyManager } from "@/components/settings/api-key-manager";
import { BrandingSettings } from "@/components/settings/branding-settings";
import { PaymentGatewayIntegration } from "@/components/settings/payment-gateway-integration";
import { PermissionManager } from "@/components/settings/permission-manager";
import { CsvImportControl } from "@/components/settings/csv-import-control";
import { WebImporter } from "@/components/settings/web-importer";
import { getApiKeysForCurrentOrganization } from "@/lib/actions/api-keys";
import { getBillingSummaryForCurrentOrganization } from "@/lib/actions/billing";
import { getPermissionSettingsForCurrentOrganization } from "@/lib/actions/permissions";
import { getServerLanguage, getServerTranslator } from "@/lib/i18n-server";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { isEnterpriseAdminUser } from "@/lib/auth";

type SettingsSearchParams = Promise<Record<string, string | string[] | undefined>>;

type BillingNoticeTone = "success" | "info" | "warning" | "error";

interface BillingNotice {
  tone: BillingNoticeTone;
  message: string;
}

const BILLING_NOTICE_CLASSES: Record<BillingNoticeTone, string> = {
  success: "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800",
  info: "rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800",
  warning: "rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800",
  error: "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800",
};

function toSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function toBillingNotice(
  billingValue: string | string[] | undefined,
  reasonValue: string | string[] | undefined,
  t: Awaited<ReturnType<typeof getServerTranslator>>
): BillingNotice | null {
  const billing = toSingleValue(billingValue);
  const reason = toSingleValue(reasonValue)?.trim().replace(/\s+/g, " ").slice(0, 220);

  if (billing === "success") {
    return {
      tone: "success",
      message: t("settings.billing.success"),
    };
  }

  if (billing === "cancelled") {
    return {
      tone: "warning",
      message: t("settings.billing.cancelled"),
    };
  }

  if (billing === "info") {
    return {
      tone: "info",
      message: reason || t("settings.billing.info"),
    };
  }

  if (billing === "error") {
    return {
      tone: "error",
      message: reason || t("settings.billing.error"),
    };
  }

  return null;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: SettingsSearchParams;
}) {
  const [t, language] = await Promise.all([getServerTranslator(), getServerLanguage()]);

  const params = await searchParams;
  const billingNotice = toBillingNotice(params.billing, params.reason, t);

  const userProfile = await getCurrentUserWithPermissions();

  const user = userProfile?.user;
  const permissions = userProfile?.permissions || null;
  const isPlatformAdmin = isEnterpriseAdminUser({ email: user?.email || "" });

  // Only fetch heavy data for platform admin users
  const [apiKeys, billingSummary, permissionSettings] = isPlatformAdmin
    ? await Promise.all([
        getApiKeysForCurrentOrganization(),
        getBillingSummaryForCurrentOrganization(),
        getPermissionSettingsForCurrentOrganization(),
      ])
    : [null, null, null];

  const localizedPlanName =
    billingSummary?.plan.code === "PRO"
      ? t("plan.pro")
      : billingSummary?.plan.code === "ENTERPRISE"
        ? t("plan.enterprise")
        : t("plan.free");

  const canManageApiKeys = Boolean(permissions?.actions.apiKeysManage);
  const canManageBilling = Boolean(permissions?.actions.billingManage);
  const canImportCsv = Boolean(permissions?.actions.csvImport);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t("settings.title")}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("settings.subtitle")}</p>
      </div>

      {billingNotice && (
        <p className={BILLING_NOTICE_CLASSES[billingNotice.tone]}>{billingNotice.message}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Platform-admin-only sections ─────────────────────── */}
        {isPlatformAdmin && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                {language === "ur" ? "ادائیگی گیٹ وے کنکشن" : "Payment Gateway Connection"}
              </CardTitle>
              <CardDescription>
                {language === "ur"
                  ? "JazzCash اور EasyPaisa کنفیگریشن اور لائیو ٹرانزیکشن فیڈ"
                  : "JazzCash and EasyPaisa configuration with live transaction feed"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentGatewayIntegration language={language} appUrl={appUrl} />
            </CardContent>
          </Card>
        )}

        {isPlatformAdmin && (
          <Card id="data-import" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="text-base">{t("settings.section.dataImport.title")}</CardTitle>
              <CardDescription>{t("settings.section.dataImport.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-600">
                {t("settings.section.dataImport.body")}
              </p>
              <div className="flex flex-wrap items-start gap-3">
                <Button variant="outline" asChild>
                  <a href="/api/csv-upload/sample" download>{t("settings.section.dataImport.download")}</a>
                </Button>
                {canImportCsv ? (
                  <CsvImportControl language={language} />
                ) : (
                  <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {language === "ur"
                      ? "آپ کو CSV امپورٹ کرنے کی اجازت نہیں ہے۔"
                      : "You do not have permission to import CSV files."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {isPlatformAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Website Import (Auto Scraper)</CardTitle>
              <CardDescription>Import products directly from a public catalog URL</CardDescription>
            </CardHeader>
            <CardContent>
              <WebImporter />
            </CardContent>
          </Card>
        )}

        {isPlatformAdmin && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t("settings.section.apiAccess.title")}</CardTitle>
              <CardDescription>{t("settings.section.apiAccess.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-600">
                {t("settings.section.apiAccess.body")}
              </p>

              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                <p className="font-semibold text-zinc-900">{t("settings.api.sendHeaders")}</p>
                <p className="mt-1 font-mono">x-api-key: lsk_live_...</p>
                <p className="font-mono">Authorization: Bearer lsk_live_...</p>
                <p className="mt-3 font-semibold text-zinc-900">{t("settings.api.availableEndpoints")}</p>
                <p className="mt-1 font-mono">GET /api/forecast</p>
                <p className="font-mono">POST /api/inventory</p>
                <p className="font-mono">POST /api/purchase-orders</p>
                <p className="font-mono">POST /api/csv-upload</p>
                <p className="font-mono">POST /api/web-import</p>
              </div>

              {canManageApiKeys ? (
                <ApiKeyManager apiKeys={apiKeys ?? []} />
              ) : (
                <p className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  {t("settings.api.restrictedRole")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {isPlatformAdmin && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                {language === "ur" ? "ملازم اجازت نامہ" : "Employee Permissions"}
              </CardTitle>
              <CardDescription>
                {language === "ur"
                  ? "ہر ملازم کے لیے صفحات اور ایکشنز الگ الگ فعال یا غیر فعال کریں۔"
                  : "Enable or disable page visibility and actions for each employee."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {permissionSettings?.canManagePermissions ? (
                <PermissionManager
                  users={permissionSettings.users}
                  actorUserId={permissionSettings.actorUserId}
                />
              ) : (
                <p className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                  {language === "ur"
                    ? "صرف مجاز صارف ملازمین کی اجازتیں تبدیل کر سکتا ہے۔"
                    : "Only authorized users can update employee permissions."}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {isPlatformAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("settings.section.aiConfig.title")}</CardTitle>
              <CardDescription>{t("settings.section.aiConfig.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600">
                {t("settings.section.aiConfig.body")}
              </p>
            </CardContent>
          </Card>
        )}

        {isPlatformAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("settings.section.subscription.title")}</CardTitle>
              <CardDescription>{t("settings.section.subscription.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-600">
                {t("settings.subscription.currentPlan", {
                  plan: localizedPlanName,
                })}
              </p>

              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                <p className="font-semibold text-zinc-900">{t("settings.subscription.currentUsage")}</p>
                <p className="mt-1">
                  {t("settings.subscription.products", {
                    used: billingSummary?.usage.products ?? 0,
                    limit: billingSummary?.limits.maxProductsLabel ?? "100",
                  })}
                </p>
                <p>
                  {t("settings.subscription.apiKeys", {
                    used: billingSummary?.usage.activeApiKeys ?? 0,
                    limit: billingSummary?.limits.maxActiveApiKeysLabel ?? "2",
                  })}
                </p>
                <p>
                  {t("settings.subscription.rateLimit", {
                    limit: billingSummary?.limits.apiRequestsPerMinute ?? 10,
                  })}
                </p>
              </div>

              {(billingSummary?.reached.products || billingSummary?.reached.apiKeys) && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {t("settings.subscription.nearLimit")}
                </p>
              )}

              {billingSummary?.plan.code === "FREE" && canManageBilling && (
                <Button className="mt-1" variant="outline" asChild>
                  <a href="/api/billing/checkout?plan=PRO">{t("settings.subscription.upgradePro")}</a>
                </Button>
              )}

              {billingSummary?.plan.code === "PRO" && canManageBilling && (
                <Button className="mt-1" variant="outline" asChild>
                  <a href="mailto:sales@lumina-stock.com?subject=Lumina%20Stock%20Enterprise%20Plan%20Request">
                    {t("settings.subscription.contactSales")}
                  </a>
                </Button>
              )}

              {!canManageBilling && (
                <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
                  {language === "ur"
                    ? "آپ کو بلنگ مینج کرنے کی اجازت نہیں ہے۔"
                    : "You do not have permission to manage billing."}
                </p>
              )}

              {billingSummary?.plan.code === "ENTERPRISE" && (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  {t("settings.subscription.enterpriseEnabled")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Shared sections (all users) ─────────────────────── */}

        {/* Storefront quick-link — Enterprise only, platform admin */}
        {isPlatformAdmin && billingSummary?.plan.code === "ENTERPRISE" && (
          <Card className="lg:col-span-2">
            <CardContent className="p-0">
              <Link
                href="/storefront"
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
                    <Globe className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      Public Storefront Builder
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {(user?.organization as { subdomain?: string | null })?.subdomain
                        ? `lumina-stock.app/store/${(user?.organization as { subdomain?: string | null })?.subdomain}`
                        : "AI-generated public website for your business"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
              </Link>
            </CardContent>
          </Card>
        )}

        {/* WhatsApp Integration quick-link — platform admin */}
        {isPlatformAdmin && (
          <Card className="lg:col-span-2">
            <CardContent className="p-0">
              <Link
                href="/settings/whatsapp"
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                    <MessageCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      {language === "ur" ? "واٹس ایپ انٹیگریشن" : "WhatsApp Integration"}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {language === "ur"
                        ? "الرٹ موصول کریں اور AI اسسٹنٹ کو واٹس ایپ سے کنٹرول کریں"
                        : "Receive alerts and control your AI assistant directly from WhatsApp"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400 flex-shrink-0" />
              </Link>
            </CardContent>
          </Card>
        )}


        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {language === "ur" ? "اسٹور کی برانڈنگ" : "Store Branding"}
            </CardTitle>
            <CardDescription>
              {language === "ur"
                ? "اسٹور کا نام، لوگو، پتہ اور فون — رسیدوں، انوائسز اور رپورٹس پر ظاہر ہوگا۔"
                : "Store name, logo, address, and phone — used on bills, invoices, and reports."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandingSettings
              initialName={user?.organization.name ?? ""}
              initialLogoUrl={(user?.organization as { logoUrl?: string | null })?.logoUrl}
              initialAddress={(user?.organization as { address?: string | null })?.address}
              initialPhone={(user?.organization as { phone?: string | null })?.phone}
              initialWebsiteUrl={(user?.organization as { websiteUrl?: string | null })?.websiteUrl}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
