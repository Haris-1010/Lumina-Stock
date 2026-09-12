import { notFound } from "next/navigation";
import { getWholesaleOrderByIdForCurrentOrganization } from "@/lib/actions/wholesale";
import { WholesaleOrderDetailClient } from "@/components/wholesale/wholesale-order-detail-client";

export default async function WholesaleOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getWholesaleOrderByIdForCurrentOrganization(id);

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Order {order.orderNumber}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {order.customer.companyName || order.customer.name}
        </p>
      </div>
      <WholesaleOrderDetailClient order={order} />
    </div>
  );
}
