import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TenantPlanControl } from "@/components/enterprise/tenant-plan-control";
import { TenantStatusControl } from "@/components/enterprise/tenant-status-control";
import { TenantEntitlementsControl } from "@/components/enterprise/tenant-entitlements-control";
import { TenantAuditTrail } from "@/components/enterprise/tenant-audit-trail";
import { getEnterpriseTenantDetails } from "@/lib/actions/enterprise-tenants";
import { getServerTranslator } from "@/lib/i18n-server";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

function roleBadge(
  role: "OWNER" | "ADMIN" | "MEMBER",
  t: (key: "status.owner" | "status.admin" | "status.member") => string
) {
  if (role === "OWNER") return <Badge variant="default">{t("status.owner")}</Badge>;
  if (role === "ADMIN") return <Badge variant="success">{t("status.admin")}</Badge>;
  return <Badge variant="secondary">{t("status.member")}</Badge>;
}

function lifecycleBadge(
  status: "ACTIVE" | "SUSPENDED",
  t: (key: "status.active" | "status.suspended") => string
) {
  if (status === "SUSPENDED") return <Badge variant="destructive">{t("status.suspended")}</Badge>;
  return <Badge variant="success">{t("status.active")}</Badge>;
}

function inventoryChangeTypeLabel(
  changeType: "MANUAL" | "SALE" | "RETURN" | "RESTOCK",
  t: (
    key:
      | "inventory.changeType.manual"
      | "inventory.changeType.sale"
      | "inventory.changeType.return"
      | "inventory.changeType.restock"
  ) => string
) {
  if (changeType === "SALE") return t("inventory.changeType.sale");
  if (changeType === "RETURN") return t("inventory.changeType.return");
  if (changeType === "RESTOCK") return t("inventory.changeType.restock");
  return t("inventory.changeType.manual");
}

export default async function EnterpriseTenantDetailsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const t = await getServerTranslator();

  const { organizationId } = await params;
  const tenant = await getEnterpriseTenantDetails(organizationId);

  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/platform/tenants">
                <ArrowLeft className="h-4 w-4" />
                {t("enterprise.details.back")}
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{tenant.name}</h1>
          <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span>{t("enterprise.details.tenantId", { id: tenant.id })}</span>
            {lifecycleBadge(tenant.lifecycleStatus, t)}
          </p>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-base">{t("enterprise.details.governanceTitle")}</CardTitle>
            <CardDescription>{t("enterprise.details.governanceDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <TenantPlanControl
              organizationId={tenant.id}
              currentPlan={tenant.subscriptionStatus}
            />

            <div className="h-px bg-zinc-200" />

            <TenantStatusControl
              organizationId={tenant.id}
              currentStatus={tenant.lifecycleStatus}
              currentReason={tenant.suspensionReason}
              reactivationRequest={tenant.reactivationRequest}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature &amp; Action Access</CardTitle>
          <CardDescription>
            Choose exactly which features and actions this tenant can use. Disabled items are
            hidden for every user in the tenant (including its Owner).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantEntitlementsControl
            organizationId={tenant.id}
            entitlements={tenant.featureEntitlements}
          />
        </CardContent>
      </Card>

      {tenant.lifecycleStatus === "SUSPENDED" && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {t("enterprise.details.suspendedNotice")}
          {tenant.suspensionReason ? ` ${t("enterprise.details.reason", { reason: tenant.suspensionReason })}` : ""}
          {tenant.suspendedAt ? ` ${t("enterprise.details.suspendedOn", { date: formatDate(tenant.suspendedAt) })}` : ""}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("enterprise.tenants.revenue30")}</CardDescription>
            <CardTitle className="text-xl">{formatCurrency(tenant.revenueLast30Days)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">{t("enterprise.details.totalClosedOrderValue")}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("enterprise.details.usersSuppliers")}</CardDescription>
            <CardTitle className="text-xl">
              {formatNumber(tenant.counts.users)} / {formatNumber(tenant.counts.suppliers)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">{t("enterprise.details.usersSuppliersDesc")}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("enterprise.details.productsApiKeys")}</CardDescription>
            <CardTitle className="text-xl">
              {formatNumber(tenant.counts.products)} / {formatNumber(tenant.activeApiKeysCount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">{t("enterprise.details.productsApiKeysDesc")}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("enterprise.details.ordersPurchaseOrders")}</CardDescription>
            <CardTitle className="text-xl">
              {formatNumber(tenant.counts.salesOrders)} / {formatNumber(tenant.counts.purchaseOrders)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">
            {t("enterprise.details.createdUpdated", {
              created: formatDate(tenant.createdAt),
              updated: formatDate(tenant.updatedAt),
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("enterprise.details.recentUsers")}</CardTitle>
            <CardDescription>{t("enterprise.details.recentUsersDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("enterprise.details.table.name")}</TableHead>
                  <TableHead>{t("enterprise.details.table.role")}</TableHead>
                  <TableHead>{t("enterprise.details.table.email")}</TableHead>
                  <TableHead>{t("enterprise.details.table.joined")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.recentUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{roleBadge(user.role, t)}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {tenant.recentUsers.length === 0 && (
              <p className="pt-4 text-sm text-zinc-500">{t("enterprise.details.noUsers")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("enterprise.details.recentOrders")}</CardTitle>
            <CardDescription>{t("enterprise.details.recentOrdersDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("enterprise.details.table.order")}</TableHead>
                  <TableHead>{t("enterprise.details.table.date")}</TableHead>
                  <TableHead className="text-right">{t("enterprise.details.table.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.recentSalesOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{formatDate(order.date)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.totalAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {tenant.recentSalesOrders.length === 0 && (
              <p className="pt-4 text-sm text-zinc-500">{t("enterprise.details.noOrders")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("enterprise.details.recentProducts")}</CardTitle>
            <CardDescription>{t("enterprise.details.recentProductsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("inventory.table.sku")}</TableHead>
                  <TableHead>{t("enterprise.details.table.name")}</TableHead>
                  <TableHead className="text-right">{t("enterprise.details.table.stock")}</TableHead>
                  <TableHead className="text-right">{t("enterprise.details.table.reorder")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.recentlyUpdatedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-zinc-500">{product.category}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(product.currentStock)}</TableCell>
                    <TableCell className="text-right">{formatNumber(product.reorderPoint)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {tenant.recentlyUpdatedProducts.length === 0 && (
              <p className="pt-4 text-sm text-zinc-500">{t("enterprise.details.noProducts")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("enterprise.details.recentInventory")}</CardTitle>
            <CardDescription>{t("enterprise.details.recentInventoryDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("enterprise.details.table.product")}</TableHead>
                  <TableHead>{t("enterprise.details.table.type")}</TableHead>
                  <TableHead className="text-right">{t("enterprise.details.table.qty")}</TableHead>
                  <TableHead>{t("enterprise.details.table.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenant.recentInventoryLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.product.name}</p>
                        <p className="font-mono text-xs text-zinc-500">{log.product.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>{inventoryChangeTypeLabel(log.changeType, t)}</TableCell>
                    <TableCell className="text-right">{formatNumber(log.quantity)}</TableCell>
                    <TableCell>{formatDate(log.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {tenant.recentInventoryLogs.length === 0 && (
              <p className="pt-4 text-sm text-zinc-500">{t("enterprise.details.noInventory")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("enterprise.details.auditTrailTitle")}</CardTitle>
          <CardDescription>
            {t("enterprise.details.auditTrailDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantAuditTrail
            entries={tenant.recentAuditLogs}
            organizationId={tenant.id}
            referenceNowIso={new Date().toISOString()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
