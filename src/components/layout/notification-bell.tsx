"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Bell, CheckCheck, ExternalLink, AlertTriangle, Package, TrendingDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  markNotificationReadForCurrentOrganization,
  markAllNotificationsReadForCurrentOrganization,
  type AppNotification,
} from "@/lib/actions/notifications";
import Link from "next/link";

const TYPE_ICONS: Record<string, React.ElementType> = {
  LOW_STOCK: AlertTriangle,
  STOCKOUT: Package,
  DEAD_STOCK: TrendingDown,
  AI_ACTION: Info,
  SYSTEM: Info,
};

const TYPE_COLORS: Record<string, string> = {
  LOW_STOCK: "text-amber-600",
  STOCKOUT: "text-red-600",
  DEAD_STOCK: "text-zinc-500",
  AI_ACTION: "text-blue-600",
  SYSTEM: "text-zinc-500",
};

function formatRelativeTime(iso: string, language: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const isUr = language === "ur";
  if (mins < 1) return isUr ? "ابھی" : "just now";
  if (mins < 60) return isUr ? `${mins} منٹ پہلے` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isUr ? `${hours} گھنٹے پہلے` : `${hours}h ago`;
  return isUr ? `${Math.floor(hours / 24)} دن پہلے` : `${Math.floor(hours / 24)}d ago`;
}

interface Props {
  initialNotifications: AppNotification[];
  initialUnreadCount: number;
}

export function NotificationBell({ initialNotifications, initialUnreadCount }: Props) {
  const { language } = useI18n();
  const isUr = language === "ur";
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isPending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markNotificationReadForCurrentOrganization(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadForCurrentOrganization();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative border border-zinc-200 dark:border-zinc-700"
        onClick={() => setOpen((o) => !o)}
        aria-label={isUr ? "اطلاعات" : "Notifications"}
      >
        <Bell className="h-4 w-4 text-zinc-500" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{isUr ? "اطلاعات" : "Notifications"}</p>
              {unreadCount > 0 && (
                <p className="text-xs text-zinc-500">{isUr ? `${unreadCount} غیر پڑھی` : `${unreadCount} unread`}</p>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-zinc-500 hover:text-zinc-900"
                onClick={handleMarkAllRead}
                disabled={isPending}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                {isUr ? "سب پڑھی" : "Mark all read"}
              </Button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center px-4">
                <Bell className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-2" />
                <p className="text-sm text-zinc-500">{isUr ? "ابھی کوئی اطلاع نہیں" : "No notifications yet"}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{isUr ? "کم اسٹاک اور فروخت الرٹس یہاں آئیں گے" : "Low stock and sales alerts will appear here"}</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Info;
                const iconColor = TYPE_COLORS[n.type] ?? "text-zinc-500";
                const rowClass = `flex gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer transition-colors border-b border-zinc-50 dark:border-zinc-800/50 last:border-0 ${!n.isRead ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`;

                return (
                  n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    className={rowClass}
                    onClick={() => { handleMarkRead(n.id); setOpen(false); }}
                  >
                    <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-tight ${!n.isRead ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"}`}>
                          {n.title}
                        </p>
                        {n.link && <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400 mt-0.5" />}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{n.body}</p>
                      <p className="text-[10px] text-zinc-400 mt-1">{formatRelativeTime(n.createdAt, language)}</p>
                    </div>
                    {!n.isRead && (
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    )}
                  </Link>
                  ) : (
                  <div
                    key={n.id}
                    className={rowClass}
                    onClick={() => handleMarkRead(n.id)}
                  >
                    <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold leading-tight ${!n.isRead ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400"}`}>
                          {n.title}
                        </p>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{n.body}</p>
                      <p className="text-[10px] text-zinc-400 mt-1">{formatRelativeTime(n.createdAt, language)}</p>
                    </div>
                    {!n.isRead && (
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  )
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
