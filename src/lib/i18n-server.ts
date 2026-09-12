import "server-only";

import { cookies } from "next/headers";
import {
  LANGUAGE_COOKIE_NAME,
  createTranslator,
  resolveLanguage,
  type AppLanguage,
} from "@/lib/i18n";

export async function getServerLanguage(): Promise<AppLanguage> {
  const cookieStore = await cookies();
  return resolveLanguage(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value);
}

export async function getServerTranslator() {
  const language = await getServerLanguage();
  return createTranslator(language);
}
