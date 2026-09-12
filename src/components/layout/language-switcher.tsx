"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLanguagePreference } from "@/lib/actions/language";
import { SUPPORTED_LANGUAGES, type AppLanguage } from "@/lib/i18n";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export function LanguageSwitcher() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { language, t } = useI18n();
  const current =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) ?? SUPPORTED_LANGUAGES[0];

  function handleLanguageChange(nextLanguage: string) {
    startTransition(async () => {
      await setLanguagePreference(nextLanguage);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Globe className="hidden sm:block h-4 w-4 text-zinc-500 flex-shrink-0" />
      <Select value={language} onValueChange={handleLanguageChange}>
        {/* Compact code on mobile (e.g. "EN"), full native label on sm+ */}
        <SelectTrigger
          className="h-8 w-auto min-w-[3rem] gap-1 px-2 sm:w-[120px] sm:px-3"
          disabled={isPending}
          aria-label={t("language.label")}
        >
          <span className="font-semibold uppercase sm:hidden">{current.code}</span>
          <span className="hidden truncate sm:inline">{current.nativeLabel}</span>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((option) => (
            <SelectItem key={option.code} value={option.code as AppLanguage}>
              {option.nativeLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
