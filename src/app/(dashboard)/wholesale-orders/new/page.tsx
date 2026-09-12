import {
  getWholesaleProductsForCurrentOrganization,
  getB2BCustomersForCurrentOrganization,
} from "@/lib/actions/wholesale";
import { NewWholesaleOrderClient } from "@/components/wholesale/new-wholesale-order-client";

export default async function NewWholesaleOrderPage() {
  const [products, customers] = await Promise.all([
    getWholesaleProductsForCurrentOrganization(),
    getB2BCustomersForCurrentOrganization(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">New Wholesale Order</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Create a bulk B2B order for a wholesale customer.
        </p>
      </div>
      <NewWholesaleOrderClient
        products={products}
        customers={customers}
      />
    </div>
  );
}
