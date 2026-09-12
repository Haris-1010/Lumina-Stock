import { CashierClient } from "@/components/cashier/cashier-client";
import { getCashierPageDataForCurrentOrganization } from "@/lib/actions/cashier";

export default async function SalesHistoryPage() {
  const data = await getCashierPageDataForCurrentOrganization("history");
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Sales History</h1>
      <p className="text-sm text-zinc-500">Find past sales, review receipts and reprint slips.</p></div>
    <CashierClient mode="history" {...data} initialProducts={data.products} initialSaleHistory={data.saleHistory} />
  </div>;
}
