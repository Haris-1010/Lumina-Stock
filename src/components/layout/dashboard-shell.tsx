"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { Header } from "@/components/layout/header";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { AccentApplier } from "@/components/providers/accent-provider";
import { cn } from "@/lib/utils";
import type { PagePermissionMap } from "@/lib/permission-definitions";
import type { AppNotification } from "@/lib/actions/notifications";

interface DashboardShellProps {
  children: React.ReactNode;
  colorAccent: string;
  orgName: string;
  orgLogoUrl?: string;
  userName?: string;
  showEnterprise?: boolean;
  pagePermissions?: PagePermissionMap;
  initialNotifications?: AppNotification[];
  initialUnreadCount?: number;
}

export function DashboardShell({
  children,
  colorAccent,
  orgName,
  orgLogoUrl,
  userName,
  showEnterprise,
  pagePermissions,
  initialNotifications = [],
  initialUnreadCount = 0,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const [previousPathname, setPreviousPathname] = useState(pathname);
  if (previousPathname !== pathname) {
    setPreviousPathname(pathname);
    setSidebarOpen(false);
  }

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const sharedSidebarProps = {
    showEnterprise,
    pagePermissions,
    orgName,
    orgLogoUrl,
  };

  return (
    <div className="flex h-screen max-h-screen [height:100dvh] [max-height:100dvh] overflow-hidden bg-background">
      <AccentApplier colorAccent={colorAccent} />

      {/* ── DESKTOP sidebar — always in flow, hidden on mobile ───────────── */}
      <div className="hidden md:flex flex-shrink-0 h-full">
        <Sidebar {...sharedSidebarProps} />
      </div>

      {/* ── MOBILE overlay backdrop ────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 md:hidden",
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── MOBILE sidebar drawer — slides in from the start edge ─────────── */}
      <div
        className={cn(
          "mobile-sidebar fixed inset-y-0 z-40 h-full transition-transform duration-300 ease-in-out md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar
          {...sharedSidebarProps}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        {pathname !== "/cashier" && (
          <div className="flex-shrink-0">
            <Header
              userName={userName}
              initialNotifications={initialNotifications}
              initialUnreadCount={initialUnreadCount}
              onMenuClick={() => setSidebarOpen(true)}
            />
            <OfflineBanner />
          </div>
        )}
        <main
          className={cn(
            "flex-1 overflow-y-auto bg-zinc-50 text-zinc-900 dark:bg-zinc-900/50 dark:text-zinc-100",
            pathname === "/cashier"
              ? "p-3 sm:p-4 pb-20 md:pb-4"
              : "p-4 pb-24 sm:p-6 md:pb-6"
          )}
        >
          {children}
        </main>
      </div>

      {/* Native-app style bottom navigation — mobile only */}
      <MobileTabBar
        pagePermissions={pagePermissions}
        onMore={() => setSidebarOpen(true)}
      />
    </div>
  );
}
