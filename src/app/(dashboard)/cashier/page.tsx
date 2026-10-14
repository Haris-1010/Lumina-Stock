import { CashierClient } from "@/components/cashier/cashier-client";
import { getCashierPageDataForCurrentOrganization } from "@/lib/actions/cashier";
import { getServerLanguage } from "@/lib/i18n-server";

export default async function CashierPage() {
  const [language, data] = await Promise.all([
    getServerLanguage(),
    getCashierPageDataForCurrentOrganization(),
  ]);

  const title = language === "ur" ? "فروخت" : "Sales";

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h1>
      </div>

      <CashierClient
        initialProducts={data.products}
        initialSaleHistory={data.saleHistory}
        customers={data.customers}
        currencyCode={data.currencyCode}
        canCheckout={data.canCheckout}
        isAdmin={data.isAdmin}
        cashierName={data.cashierName}
        organizationName={data.organizationName}
        orgLogoUrl={data.orgLogoUrl}
        orgAddress={data.orgAddress}
        orgPhone={data.orgPhone}
      />
    </div>
  );
}
