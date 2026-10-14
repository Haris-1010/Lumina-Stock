"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  RotateCcw,
  BarChart3,
  FileText,
  ReceiptText,
  Building2,
  ScrollText,
  Settings,
  Truck,
  Database,
  HardHat,
  type LucideIcon,
} from "lucide-react";
import { LuminaLogomark } from "@/components/brand/lumina-logo";
import { useI18n } from "@/components/providers/i18n-provider";
import type { PagePermissionKey, PagePermissionMap } from "@/lib/permission-definitions";
import type { TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NavigationItem = {
  key: TranslationKey;
  label?: string;
  href: string;
  icon: LucideIcon;
  permissionKey?: PagePermissionKey;
};

const navigation: NavigationItem[] = [
  { key: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "nav.inventory", href: "/inventory", icon: Package, permissionKey: "inventory" },
  { key: "nav.sales", href: "/cashier", icon: ShoppingCart, permissionKey: "cashier" },
  { key: "nav.salesHistory", href: "/sales", icon: ScrollText, permissionKey: "sales" },
  { key: "nav.returns", href: "/returns", icon: RotateCcw, permissionKey: "returns" },
  { key: "nav.customers", href: "/customers", icon: Users, permissionKey: "customers" },
  { key: "nav.suppliers", href: "/suppliers", icon: Truck, permissionKey: "inventory" },
  { key: "nav.purchases", label: "Purchases", href: "/purchase-orders", icon: FileText, permissionKey: "purchaseOrders" },
  { key: "nav.invoices", href: "/invoices", icon: ReceiptText, permissionKey: "invoices" },
  { key: "nav.analytics", href: "/analytics", icon: BarChart3, permissionKey: "analytics" },
  { key: "nav.labour", href: "/labour", icon: HardHat, permissionKey: "labour" },
  { key: "nav.settings", href: "/settings", icon: Settings, permissionKey: "settings" },
];

export function Sidebar({
  showEnterprise,
  pagePermissions,
  onClose,
}: {
  showEnterprise?: boolean;
  pagePermissions?: PagePermissionMap;
  orgName?: string;
  orgLogoUrl?: string;
  orgWebsiteUrl?: string;
  businessType?: "RETAIL" | "WHOLESALE" | "BOTH";
  activeMode?: "RETAIL" | "WHOLESALE";
  canUseVoiceAgent?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { t, language } = useI18n();
  const canShowPlatformTenants = pagePermissions
    ? pagePermissions.platformTenants
    : Boolean(showEnterprise);
  const canShowPlatformAudit = pagePermissions
    ? pagePermissions.platformAudit
    : Boolean(showEnterprise);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const navLinkClass = (href: string) =>
    cn(
      "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all duration-150 select-none",
      isActive(href)
        ? "accent-bg dark:accent-bg-dark accent-text dark:accent-text-dark scale-[0.98]"
        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.97] active:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:active:bg-zinc-700"
    );

  const iconClass = (href: string) =>
    cn("h-4 w-4 shrink-0", isActive(href) ? "accent-icon" : "text-zinc-400");

  const handleNav = () => { onClose?.(); };

  return (
    <aside className="flex h-full w-[185px] flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Brand / Org header */}
      <div className="flex h-16 items-center gap-2 border-b border-zinc-200 px-3 dark:border-zinc-800">
        <LuminaLogomark size={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
            Lumina Stock
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto space-y-0.5 px-2 py-3 custom-scrollbar">
        {navigation.map((item) => {
          if (item.permissionKey && pagePermissions && !pagePermissions[item.permissionKey]) {
            return null;
          }
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => handleNav()}
              className={navLinkClass(item.href)}
            >
              <item.icon className={iconClass(item.href)} />
              {language === "ur" ? t(item.key) : (item.label ?? t(item.key))}
            </Link>
          );
        })}

        {(canShowPlatformTenants || canShowPlatformAudit) && (
          <div className="mt-2 space-y-0.5">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Platform
            </p>

            {canShowPlatformTenants && (
              <Link
                href="/platform/tenants"
                onClick={() => handleNav()}
                className={navLinkClass("/platform/tenants")}
              >
                <Building2 className={iconClass("/platform/tenants")} />
                {t("nav.tenantControl")}
              </Link>
            )}

            {canShowPlatformAudit && (
              <Link
                href="/platform/audit"
                onClick={() => handleNav()}
                className={navLinkClass("/platform/audit")}
              >
                <ScrollText className={iconClass("/platform/audit")} />
                {t("nav.enterpriseAudit")}
              </Link>
            )}

            {canShowPlatformTenants && (
              <Link
                href="/platform/database"
                onClick={() => handleNav()}
                className={navLinkClass("/platform/database")}
              >
                <Database className={iconClass("/platform/database")} />
                Database
              </Link>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}
