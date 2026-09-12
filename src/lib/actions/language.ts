"use server";

import { cookies } from "next/headers";
import {
  LANGUAGE_COOKIE_NAME,
  resolveLanguage,
  type AppLanguage,
} from "@/lib/i18n";

export async function setLanguagePreference(nextLanguage: string): Promise<{
  success: true;
  language: AppLanguage;
}> {
  const language = resolveLanguage(nextLanguage);
  const cookieStore = await cookies();

  cookieStore.set(LANGUAGE_COOKIE_NAME, language, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return {
    success: true,
    language,
  };
}
