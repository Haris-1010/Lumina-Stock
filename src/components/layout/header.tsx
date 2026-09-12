"use client";

import { FormEvent, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Moon, Sun, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";
import type { AppNotification } from "@/lib/actions/notifications";

export function Header({
  initialNotifications = [],
  initialUnreadCount = 0,
  onMenuClick,
}: {
  userName?: string;
  initialNotifications?: AppNotification[];
  initialUnreadCount?: number;
  onMenuClick?: () => void;
}) {
  const { t, language } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchDefaultValue = pathname === "/search" ? searchParams.get("q") ?? "" : "";

  const labels = useMemo(
    () =>
      language === "ur"
        ? {
            darkMode: "ڈارک موڈ",
            lightMode: "لائٹ موڈ",
            searchAction: "تلاش",
          }
        : {
            darkMode: "Enable dark mode",
            lightMode: "Enable light mode",
            searchAction: "Search",
          },
    [language]
  );

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const rawQuery = String(formData.get("q") ?? "");
    const normalizedQuery = rawQuery.trim();
    const href = normalizedQuery ? `/search?q=${encodeURIComponent(normalizedQuery)}` : "/search";
    router.push(href);
  }

  return (
    <header className="flex h-14 sm:h-16 items-center gap-2 border-b border-zinc-200 bg-white px-3 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950">

      {/* ── Left: hamburger (mobile) + search form (sm+) ───────────────── */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        {/* Hamburger — mobile only, large tap target */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search form — hidden on mobile to prevent header overflow */}
        <form onSubmit={handleSearchSubmit} className="relative hidden sm:flex w-full max-w-sm md:max-w-md lg:max-w-lg min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            name="q"
            placeholder={t("header.searchPlaceholder")}
            className="pl-9 pr-11"
            defaultValue={searchDefaultValue}
            key={`${pathname}-${searchDefaultValue}`}
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            title={labels.searchAction}
            aria-label={labels.searchAction}
          >
            <Search className="h-4 w-4 text-zinc-500" />
          </Button>
        </form>

        {/* Search icon button — mobile only, navigates to /search page */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="sm:hidden h-9 w-9"
          onClick={() => router.push("/search")}
          aria-label={labels.searchAction}
        >
          <Search className="h-4 w-4 text-zinc-500" />
        </Button>
      </div>

      {/* ── Right: actions ─────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
        <LanguageSwitcher />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={theme === "dark" ? labels.lightMode : labels.darkMode}
          aria-label={theme === "dark" ? labels.lightMode : labels.darkMode}
          className="h-8 w-8 border border-zinc-200 dark:border-zinc-700"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-zinc-600" />
          )}
        </Button>

        <NotificationBell
          initialNotifications={initialNotifications}
          initialUnreadCount={initialUnreadCount}
        />


      </div>
    </header>
  );
}
