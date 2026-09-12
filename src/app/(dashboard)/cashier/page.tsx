import { CashierClient } from "@/components/cashier/cashier-client";
import { getCashierPageDataForCurrentOrganization } from "@/lib/actions/cashier";
import { getServerLanguage } from "@/lib/i18n-server";
import { PageHelp } from "@/components/ui/page-help";

export default async function CashierPage() {
  const [language, data] = await Promise.all([
    getServerLanguage(),
    getCashierPageDataForCurrentOrganization(),
  ]);

  const title = language === "ur" ? "فروخت" : "Sales";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
        </div>
        <PageHelp
          title="Sales Guide"
          purpose="The Cashier is your point-of-sale screen. Use it to record walk-in sales, generate receipts, and track revenue. Stock is automatically deducted from inventory on each sale."
          sections={[
            {
              title: "How to complete a sale",
              items: [
                "Press Tab when arriving to select a customer first. Search by code, name, address or contact number; use arrows and Enter to select. The balance shows unpaid sales invoices.",
                "Search for a product by name or SKU in the product picker.",
                "Use arrow keys to select a product and Enter to add it.",
                "Tab through quantity, price and discount, then back to search.",
                "Press F2 to jump to product search at any time.",
                "Hold Tab and press Enter to search customers, use arrow keys and Enter to select.",
                "Press Ctrl+Enter to complete the sale and open printing.",
              ],
            },
            {
              title: "Receipts",
              items: [
                "Each sale generates a printable receipt with org logo, address, and customer info.",
                "View and reprint past receipts from Sales History in the sidebar.",
              ],
            },
          ]}
          aiTips={[
            "What were my total sales today?",
            "Which product sold the most this week?",
            "Show me all out-of-stock products",
          ]}
        />
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
