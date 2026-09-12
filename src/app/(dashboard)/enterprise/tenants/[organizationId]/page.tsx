import { redirect } from "next/navigation";

export default async function LegacyEnterpriseTenantDetailsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  redirect(`/platform/tenants/${organizationId}`);
}
