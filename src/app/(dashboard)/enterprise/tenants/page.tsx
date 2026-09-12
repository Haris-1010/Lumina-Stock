import { redirect } from "next/navigation";

export default function LegacyEnterpriseTenantsPage() {
  redirect("/platform/tenants");
}
