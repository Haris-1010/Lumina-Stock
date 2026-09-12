"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import type {
  WholesaleProduct,
  B2BCustomer,
} from "@/lib/actions/wholesale";
import { createWholesaleOrderForCurrentOrganization } from "@/lib/actions/wholesale";

interface CartLine {
  product: WholesaleProduct;
  quantity: number;
  unitPrice: number;
  discountPct: number;
}

interface Props {
  products: WholesaleProduct[];
  customers: B2BCustomer[];
}

export function NewWholesaleOrderClient({ products, customers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [error, setError] = useState("");

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  function getDefaultPrice(product: WholesaleProduct): number {
    return product.wholesalePrice ?? product.sellingPrice;
  }

  function addProduct(product: WholesaleProduct) {
    const existing = cart.find((l) => l.product.id === product.id);
    if (existing) {
      setCart(cart.map((l) =>
        l.product.id === product.id ? { ...l, quantity: l.quantity + product.minOrderQty } : l
      ));
    } else {
      setCart([...cart, {
        product,
        quantity: product.minOrderQty,
        unitPrice: getDefaultPrice(product),
        discountPct: 0,
      }]);
    }
    setProductSearch("");
  }

  function updateLine(productId: string, field: "quantity" | "unitPrice" | "discountPct", value: number) {
    setCart(cart.map((l) =>
      l.product.id === productId ? { ...l, [field]: value } : l
    ));
  }

  function removeLine(productId: string) {
    setCart(cart.filter((l) => l.product.id !== productId));
  }

  const lineTotal = (line: CartLine) => {
    const gross = line.quantity * line.unitPrice;
    return gross - gross * (line.discountPct / 100);
  };
  const orderTotal = cart.reduce((sum, l) => sum + lineTotal(l), 0);

  const filteredProducts = products.filter(
    (p) =>
      !productSearch ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  async function handleSubmit(status: "DRAFT" | "PENDING_APPROVAL") {
    if (!selectedCustomerId) { setError("Please select a customer."); return; }
    if (!cart.length) { setError("Add at least one product."); return; }
    setError("");
    startTransition(async () => {
      const result = await createWholesaleOrderForCurrentOrganization({
        customerId: selectedCustomerId,
        notes,
        status,
        items: cart.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPct: l.discountPct,
        })),
      });
      if (result.error) { setError(result.error); return; }
      router.push(`/wholesale-orders/${result.id}`);
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Customer & Notes */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Customer <span className="text-red-500">*</span>
          </label>
          {customers.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No wholesale customers yet.{" "}
              <a href="/customers" className="text-blue-600 hover:underline">Add one first.</a>
            </p>
          ) : (
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.companyName ? ` — ${c.companyName}` : ""}
                </option>
              ))}
            </select>
          )}
          {selectedCustomer && (
            <p className="text-xs text-zinc-400">
              Credit: {selectedCustomer.creditUsed.toLocaleString(undefined, { minimumFractionDigits: 2 })} / {selectedCustomer.creditLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Delivery instructions, PO reference…"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none resize-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Product picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Add Products</label>
        <input
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="Search by name or SKU…"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        {productSearch && (
          <div className="max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-900">
            {filteredProducts.length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-400">No products found.</p>
            ) : (
              filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">{p.name}</span>
                    <span className="ml-2 text-zinc-400 text-xs">{p.sku}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400">Stock: {p.currentStock}</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {(p.wholesalePrice ?? p.sellingPrice).toFixed(2)}
                    </span>
                    <Plus className="h-4 w-4 text-blue-500" />
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-zinc-600 dark:text-zinc-300">Product</th>
                <th className="px-4 py-2.5 text-right font-semibold text-zinc-600 dark:text-zinc-300">Qty</th>
                <th className="px-4 py-2.5 text-right font-semibold text-zinc-600 dark:text-zinc-300">Unit Price</th>
                <th className="px-4 py-2.5 text-right font-semibold text-zinc-600 dark:text-zinc-300">Disc %</th>
                <th className="px-4 py-2.5 text-right font-semibold text-zinc-600 dark:text-zinc-300">Total</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {cart.map((line) => (
                <tr key={line.product.id}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">{line.product.name}</p>
                    <p className="text-xs text-zinc-400">{line.product.sku}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min={line.product.minOrderQty}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.product.id, "quantity", Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-20 rounded border border-zinc-200 bg-white px-2 py-1 text-right text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ml-auto block"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.product.id, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="w-24 rounded border border-zinc-200 bg-white px-2 py-1 text-right text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ml-auto block"
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={line.discountPct}
                      onChange={(e) => updateLine(line.product.id, "discountPct", Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="w-16 rounded border border-zinc-200 bg-white px-2 py-1 text-right text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ml-auto block"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-zinc-800 dark:text-zinc-200">
                    {lineTotal(line).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(line.product.id)}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                  Order Total
                </td>
                <td className="px-4 py-3 text-right text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {orderTotal.toFixed(2)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleSubmit("DRAFT")}
            disabled={isPending || !cart.length || !selectedCustomerId}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("PENDING_APPROVAL")}
            disabled={isPending || !cart.length || !selectedCustomerId}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Submitting…" : "Submit for Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}
