"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  RotateCcw,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import type { PagePermissionKey, PagePermissionMap } from "@/lib/permission-definitions";
import type { TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Tab = {
  key: TranslationKey;
  href: string;
  icon: LucideIcon;
  permissionKey?: PagePermissionKey;
};

const tabs: Tab[] = [
  { key: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "nav.sales", href: "/cashier", icon: ShoppingCart, permissionKey: "cashier" },
  { key: "nav.inventory", href: "/inventory", icon: Package, permissionKey: "inventory" },
  { key: "nav.returns", href: "/returns", icon: RotateCcw, permissionKey: "returns" },
];

/**
 * Native-app style bottom navigation. Mobile only (`md:hidden`); the full menu
 * stays available via the "More" button which opens the existing drawer.
 */
export function MobileTabBar({
  pagePermissions,
  onMore,
}: {
  pagePermissions?: PagePermissionMap;
  activeMode?: "RETAIL" | "WHOLESALE";
  onMore: () => void;
}) {
  const pathname = usePathname();
  const { t, language } = useI18n();

  const visibleTabs = tabs.filter(
    (tab) => !tab.permissionKey || !pagePermissions || pagePermissions[tab.permissionKey]
  );

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {visibleTabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors active:scale-95",
              active
                ? "accent-text dark:accent-text-dark"
                : "text-zinc-500 dark:text-zinc-400"
            )}
          >
            <tab.icon className={cn("h-5 w-5", active && "accent-icon")} />
            <span className="max-w-full truncate px-0.5">{t(tab.key)}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        aria-label={language === "ur" ? "مزید" : "More"}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 active:scale-95"
      >
        <Menu className="h-5 w-5" />
        <span>{language === "ur" ? "مزید" : "More"}</span>
      </button>
    </nav>
  );
}
