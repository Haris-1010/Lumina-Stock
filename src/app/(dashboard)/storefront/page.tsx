import { redirect } from "next/navigation";
import { getCurrentUserWithPermissions } from "@/lib/permissions";
import { getStorefrontSettings } from "@/lib/actions/storefront";
import { StorefrontEditor } from "@/components/storefront/storefront-editor";
import { StorefrontEnterpriseGate } from "@/components/storefront/enterprise-gate";
import { buildDefaultContent } from "@/types/storefront";

export default async function StorefrontPage() {
  const profile = await getCurrentUserWithPermissions();
  if (!profile) redirect("/sign-in");

  const isEnterprise =
    (profile.user.organization as { subscriptionStatus?: string })?.subscriptionStatus === "ENTERPRISE";

  if (!isEnterprise) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Storefront Builder</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">AI-powered public storefront for your business</p>
        </div>
        <StorefrontEnterpriseGate />
      </div>
    );
  }

  const settings = await getStorefrontSettings();
  if ("error" in settings) redirect("/sign-in");

  const org = profile.user.organization as {
    name: string;
    logoUrl?: string | null;
    address?: string | null;
    phone?: string | null;
    websiteUrl?: string | null;
    theme?: string | null;
    currencyCode?: string;
    subdomain?: string | null;
  };

  const content = settings.content ?? buildDefaultContent(org.name);

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Storefront Builder</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Edit your public storefront, manage visible products, and publish.
        </p>
      </div>

      <StorefrontEditor
        org={{
          name: org.name,
          logoUrl: org.logoUrl ?? null,
          address: org.address ?? null,
          phone: org.phone ?? null,
          websiteUrl: org.websiteUrl ?? null,
          theme: org.theme ?? null,
          currencyCode: org.currencyCode ?? "PKR",
          subdomain: settings.subdomain,
          appUrl: (() => {
            const fromUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
            const domain = (process.env.NEXT_PUBLIC_APP_DOMAIN ?? "luminastocks.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
            const raw = fromUrl || `https://${domain}`;
            return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
          })(),
        }}
        initialEnabled={settings.enabled}
        initialContent={content}
        initialProducts={settings.products}
      />
    </div>
  );
}
