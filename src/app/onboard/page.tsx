import { redirect } from "next/navigation";
import { checkOnboardingStatus } from "@/lib/actions/onboarding";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getServerLanguage } from "@/lib/i18n-server";
import { getCurrentUserWithPermissions } from "@/lib/permissions";

export default async function OnboardPage() {
  const [isComplete, language, profile] = await Promise.all([
    checkOnboardingStatus(),
    getServerLanguage(),
    getCurrentUserWithPermissions(),
  ]);

  if (isComplete) redirect("/dashboard");

  const currency = (profile?.user as { organization?: { currencyCode?: string } } | null)
    ?.organization?.currencyCode ?? "PKR";

  return <OnboardingWizard language={language} currency={currency} />;
}
