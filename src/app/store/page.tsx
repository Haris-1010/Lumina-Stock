import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { StorefrontNotFound } from "@/components/store/storefront-not-found";

// This route is only hit when accessed via a real subdomain (e.g. awkhan.luminastocks.com).
// The proxy rewrites subdomain traffic to /store/[subdomain] directly, so this is a fallback.
export default async function StorePage() {
  const headerStore = await headers();
  const subdomain = headerStore.get("x-lumina-subdomain");

  if (!subdomain) {
    return <StorefrontNotFound />;
  }

  redirect(`/store/${subdomain}`);
}
