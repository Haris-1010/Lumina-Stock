import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { StorefrontContent } from "@/types/storefront";
import { buildDefaultContent } from "@/types/storefront";
import { StorefrontRenderer } from "@/components/store/storefront-renderer";
import { StorefrontNotFound } from "@/components/store/storefront-not-found";

async function loadStorefrontBySubdomain(subdomain: string) {
  return unstable_cache(
    async () => {
      const org = await (db as any).organization.findUnique({
        where: { subdomain },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          address: true,
          phone: true,
          websiteUrl: true,
          theme: true,
          currencyCode: true,
          storefrontEnabled: true,
          storefrontContent: true,
        },
      }).catch(() => null);

      if (!org || !org.storefrontEnabled) {
        return null;
      }

      const products = await (db as any).product.findMany({
        where: { organizationId: org.id, isPublic: true, deletedAt: null },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          sellingPrice: true,
          currentStock: true,
        },
        orderBy: { name: "asc" },
      }).catch(() => []);

      const rawContent = org.storefrontContent as StorefrontContent | null;
      const content: StorefrontContent = rawContent ?? buildDefaultContent(org.name);

      return { org, products, content };
    },
    [`storefront:${subdomain}`],
    {
      tags: [`storefront:${subdomain}`],
      revalidate: 300,
    }
  )();
}

export default async function StoreSubdomainPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;

  if (!subdomain || !/^[a-z0-9-]+$/.test(subdomain)) {
    return <StorefrontNotFound />;
  }

  const storefront = await loadStorefrontBySubdomain(subdomain);

  if (!storefront) {
    return <StorefrontNotFound />;
  }

  const { org, products, content } = storefront;

  return (
    <StorefrontRenderer
      org={{
        name: org.name,
        logoUrl: org.logoUrl,
        address: org.address,
        phone: org.phone,
        websiteUrl: org.websiteUrl,
        theme: org.theme,
        currencyCode: org.currencyCode ?? "PKR",
      }}
      products={products}
      content={content}
    />
  );
}
