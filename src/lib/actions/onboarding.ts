"use server";

import { db } from "@/lib/db";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export interface OnboardingInput {
  niche: string;
  theme: string;
  layout: string;
}

export async function completeOnboarding(input: OnboardingInput) {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) redirect("/sign-in");

  const orgId = profile.user.organizationId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).organization.update({
    where: { id: orgId },
    data: {
      niche: input.niche || null,
      theme: input.theme || "emerald",
      layout: input.layout || "list",
      onboardingComplete: true,
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function checkOnboardingStatus(): Promise<boolean> {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) return true; // not logged in — don't block

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = await (db as any).organization.findUnique({
    where: { id: profile.user.organizationId },
    select: { onboardingComplete: true },
  }) as { onboardingComplete: boolean } | null;

  return Boolean(org?.onboardingComplete);
}
