"use client";

import { getCurrentOrganizationBranding } from "@/lib/actions/organization-settings";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, Clock, Minus, Plus, Printer, Search, ShoppingCart, Trash2, TrendingUp, User, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  completeCashierSaleForCurrentOrganization,
  getPreviousPricesForCustomer,
  type CashierCustomer,
  type CashierSaleReceipt,
  type CashierSaleUnit,
} from "@/lib/actions/cashier";
import { useI18n } from "@/components/providers/i18n-provider";
import { withUrduMeaning } from "@/lib/urdu-glossary";
import { cn, formatCurrency } from "@/lib/utils";
import {
  saveProductsCache,
  queuePendingSale,
  getPendingSales,
  removePendingSale,
  generatePendingId,
} from "@/lib/offline-storage";
import { useOnlineStatus } from "@/hooks/use-online-status";

interface CashierProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  currentStock: number;
  sellingPrice: number;
  costPrice?: number;
}

interface CartLine {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** Product cost/purchase price per base stock unit */
  costPrice: number;
  saleUnit: CashierSaleUnit;
  maxStock: number;
  /** Percentage discount for this line (0 = none, 1–100 = %) */
  discountPct: number;
}

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function saleUnitMultiplier(saleUnit: CashierSaleUnit) {
  if (saleUnit === "DOZEN") return 12;
  if (saleUnit === "KG") return 1;
  return 1;
}

function quantityStepForSaleUnit(saleUnit: CashierSaleUnit) {
  if (saleUnit === "KG") return 0.25;
  return 1;
}

function normalizeEnteredQuantity(saleUnit: CashierSaleUnit, quantity: number) {
  if (saleUnit === "KG") {
    return Number(Math.max(0, quantity).toFixed(3));
  }

  return Math.max(0, Math.floor(quantity));
}

function toStockUnits(saleUnit: CashierSaleUnit, quantity: number) {
  if (saleUnit === "KG") {
    return Math.round(quantity * saleUnitMultiplier(saleUnit));
  }

  return Math.floor(quantity * saleUnitMultiplier(saleUnit));
}

function formatNumber(value: number, maxFractionDigits = 3) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

function formatDateTimeStable(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds} UTC`;
}

export function CashierClient({
  mode = "pos",
  initialProducts,
  initialSaleHistory,
  customers,
  currencyCode,
  canCheckout,
  isAdmin = true,
  cashierName: propCashierName,
  organizationName: propOrganizationName,
  orgLogoUrl: initialLogoUrl,
  orgAddress: initialAddress,
  orgPhone: initialPhone,
}: {
  mode?: "pos" | "history";
  initialProducts: CashierProduct[];
  initialSaleHistory: CashierSaleReceipt[];
  customers: CashierCustomer[];
  currencyCode: string;
  canCheckout: boolean;
  isAdmin?: boolean;
  cashierName?: string;
  organizationName?: string;
  orgLogoUrl?: string | null;
  orgAddress?: string | null;
  orgPhone?: string | null;
}) {
  const { language } = useI18n();
  const [products, setProducts] = useState<CashierProduct[]>(initialProducts);
  const [saleHistory, setSaleHistory] = useState<CashierSaleReceipt[]>(initialSaleHistory);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(
    initialSaleHistory[0]?.orderId || null
  );
  const [tenderedByOrderId, setTenderedByOrderId] = useState<Record<string, number>>({});
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quantityDraftByProductId, setQuantityDraftByProductId] = useState<
    Record<string, string>
  >({});


  // Customer selector
  const [selectedCustomer, setSelectedCustomer] = useState<CashierCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Previous price lookup
  const [previousPrices, setPreviousPrices] = useState<Record<string, number>>({});
  const [previousPricesLoading, setPreviousPricesLoading] = useState(false);
  const previousPricesGenerationRef = useRef(0);

  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const quantityRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const priceRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const discountRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const checkoutLock = useRef(false);
  const checkoutRef = useRef<() => void>(() => {});
  const [highlightedProduct, setHighlightedProduct] = useState(0);
  const [productKeyboardSelection, setProductKeyboardSelection] = useState(false);
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [highlightedCustomer, setHighlightedCustomer] = useState(0);

  useEffect(() => {
    if (mode !== "pos") return;
    let firstTab = true;
    let tabHeld = false;
    const onShortcut = (event: KeyboardEvent) => {
      if (event.key === "Tab") tabHeld = true;
      if (event.key !== "Enter" || !tabHeld || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing || document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat || checkoutLock.current) return;
      setEditingCustomer(true);
      setShowCustomerDropdown(true);
      setHighlightedCustomer(0);
      requestAnimationFrame(() => focusField(customerSearchRef.current));
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Tab") tabHeld = false;
    };
    const onBlur = () => { tabHeld = false; };
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || document.querySelector('[role="dialog"]')) return;
      if (event.key === "Tab") {
        if (!event.shiftKey && !(document.activeElement instanceof HTMLInputElement) && !(document.activeElement instanceof HTMLTextAreaElement)) {
          event.preventDefault();
          if (customerSearchRef.current) {
            customerSearchRef.current.focus();
            customerSearchRef.current.select();
            return;
          }
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (!event.repeat) checkoutRef.current();
      } else if (event.key === "F2") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("keydown", onShortcut, true);
    document.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keydown", onShortcut, true);
      document.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [mode]);

  useEffect(() => {
    if (mode === "pos" && !isPending && cart.length === 0 && selectedReceiptId) {
      customerSearchRef.current?.focus();
    }
  }, [mode, isPending, cart.length, selectedReceiptId]);

  function focusField(field: HTMLInputElement | null | undefined) {
    field?.focus();
    field?.select();
  }

  function chooseCustomer(customer: CashierCustomer | null) {
    setSelectedCustomer(customer);
    setCustomerSearch("");
    setEditingCustomer(false);
    setShowCustomerDropdown(false);
    focusField(searchRef.current);
  }

  function selectProduct(product: CashierProduct) {
    if (checkoutLock.current || product.currentStock <= 0) return;
    addProductToCart(product);
    setSearch("");
    setHighlightedProduct(0);
    setProductKeyboardSelection(false);
    setShowProductDropdown(false);
    requestAnimationFrame(() => focusField(priceRefs.current[product.id]));
  }
  const cartSectionRef = useRef<HTMLDivElement>(null);

  // ── Offline: sync pending sales when coming back online ────────────────────
  const syncPendingSales = useCallback(() => {
    const pendingSales = getPendingSales();
    if (pendingSales.length === 0) return;

    startTransition(async () => {
      for (const sale of pendingSales) {
        try {
          const result = await completeCashierSaleForCurrentOrganization({
            items: sale.items,
            customerId: sale.customerId ?? null,
          });
          if (!result.error && result.receipt) {
            removePendingSale(sale.id);
            setSaleHistory((prev) =>
              prev.map((entry) =>
                entry.orderId === sale.tempReceipt.orderId ? result.receipt! : entry
              )
            );
          }
        } catch {
          // leave for next retry
        }
      }
    });
  }, []);

  // ── Previous price lookup ────────────────────────────────────────────
  const fetchPreviousPrices = useCallback(async (customerId: string, productIds: string[]) => {
    if (!customerId || productIds.length === 0) {
      setPreviousPrices({});
      return;
    }
    const gen = ++previousPricesGenerationRef.current;
    setPreviousPricesLoading(true);
    try {
      const result = await getPreviousPricesForCustomer({ customerId, productIds });
      if (gen !== previousPricesGenerationRef.current) return; // stale
      setPreviousPrices(result.prices ?? {});
    } catch {
      if (gen !== previousPricesGenerationRef.current) return;
      setPreviousPrices({});
    } finally {
      if (gen === previousPricesGenerationRef.current) setPreviousPricesLoading(false);
    }
  }, []);

  const cartProductIds = cart.map(line => line.productId).join(",");
  useEffect(() => {
    if (!selectedCustomer) {
      setPreviousPrices({});
      return;
    }
    const productIds = cartProductIds ? cartProductIds.split(",") : [];
    fetchPreviousPrices(selectedCustomer.id, productIds);
  }, [selectedCustomer, cartProductIds, fetchPreviousPrices]);

  const isOnline = useOnlineStatus(syncPendingSales);

  useEffect(() => {
    if (products.length > 0) {
      saveProductsCache(products);
    }
  }, [products]);

  const labels = useMemo(
    () =>
      language === "ur"
        ? {
            searchPlaceholder:
              "SKU یا نام لکھیں، Enter دبائیں، پہلا آئٹم فوراً شامل ہو جائے گا",
            pickerTitle: "مصنوعات منتخب کریں",
            pickerHint:
              "سادہ فلو: آئٹم شامل کریں، یونٹ/درجن/کلو منتخب کریں، مقدار سیٹ کریں، سیل مکمل کریں۔",
            add: "شامل کریں",
            stock: "اسٹاک",
            outOfStock: "ختم",
            cartTitle: "سیل کارٹ",
            cartEmpty: "ابھی کوئی آئٹم شامل نہیں کیا گیا۔",
            unitPrice: "فی سیل یونٹ قیمت",
            saleUnit: "سیل یونٹ",
            saleUnitUnit: "یونٹ",
            saleUnitDozen: "درجن",
            saleUnitKg: "کلو",
            discount: "رعایت %",
            discountOff: "رعایت",
            grossTotal: "مجموعی",
            totalDiscount: "کل رعایت",
            subtotal: "کل رقم",
            estimatedProfit: "تخمینی منافع",
            cashReceived: "موصول رقم (اختیاری)",
            changeDue: "واپس رقم",
            amountDue: "باقی رقم",
            stockUsed: "استعمال شدہ اسٹاک",
            remainingAfterSale: "باقی اسٹاک",
            completeSale: "سیل مکمل کریں اور سلپ بنائیں",
            processing: "سیل محفوظ ہو رہی ہے...",
            noCheckoutPermission: "آپ کے پاس سیل مکمل کرنے کی اجازت نہیں ہے۔",
            remove: "ہٹائیں",
            qty: "مقدار",
            receiptTitle: "سیلز سلپ",
            printSlip: "سلپ پرنٹ کریں",
            orderNumber: "آرڈر نمبر",
            soldAt: "وقت",
            soldBy: "کیشیئر",
            soldUnits: "فروخت شدہ مقدار",
            saleSaved: "سیل محفوظ ہو گئی اور انوینٹری اپ ڈیٹ ہو گئی۔",
            addAtLeastOne: "چیک آؤٹ کے لیے کم از کم ایک آئٹم شامل کریں۔",
            inventoryUpdated: "انوینٹری خودکار طور پر اپ ڈیٹ ہو گئی۔",
            noSlipSelected: "کسی سیلز سلپ کو دیکھنے کے لیے ہسٹری سے منتخب کریں۔",
            noSlipHistory: "ابھی تک کوئی سیلز سلپ موجود نہیں ہے۔",
            historyTitle: "سیلز سلپ ہسٹری",
            historySearchPlaceholder: "آرڈر نمبر، SKU، یا آئٹم سے تلاش کریں",
            historyOrder: "آرڈر",
            historyDate: "تاریخ",
            historyItems: "آئٹمز",
            historyTotal: "کل",
            historyAction: "کارروائی",
            viewSlip: "سلپ دیکھیں",
            showing: "دکھایا جا رہا ہے",
            of: "میں سے",
            rowsPerPage: "قطاریں",
            page: "صفحہ",
            previous: "پچھلا",
            next: "اگلا",
            dozenRequiresStock:
              "درجن میں فروخت کے لیے کم از کم 12 اسٹاک یونٹس درکار ہیں۔",
            customerLabel: "کسٹمر (اختیاری)",
            customerSearchPlaceholder: "نام یا فون سے تلاش کریں...",
            walkIn: "واک ان (کوئی کسٹمر نہیں)",
            noCustomersFound: "کوئی کسٹمر نہیں ملا",
            clearCustomer: "کسٹمر ہٹائیں",
            previousPrice: "پچھلی قیمت",
            usePreviousPrice: "یہ قیمت استعمال کریں",
            noPreviousPrice: "کوئی پچھلی قیمت نہیں",
            loadingPreviousPrice: "پچھلی قیمت لوڈ ہو رہی ہے...",
          }
        : {
            searchPlaceholder:
              "Search name or SKU · ↑ ↓ select · Enter add",
            pickerTitle: "Product Picker",
            pickerHint:
              "Search, select a product with Enter, then Tab through quantity, price and discount.",
            add: "Add",
            stock: "Stock",
            outOfStock: "Out",
            cartTitle: "Sale Cart",
            cartEmpty: "No items added yet.",
            unitPrice: "Price Per Sale Unit",
            saleUnit: "Sale Unit",
            saleUnitUnit: "unit",
            saleUnitDozen: "dozen",
            saleUnitKg: "kg",
            discount: "Disc %",
            discountOff: "off",
            grossTotal: "Gross",
            totalDiscount: "Discount",
            subtotal: "Total",
            estimatedProfit: "Estimated Profit",
            cashReceived: "Cash Received (optional)",
            changeDue: "Change Due",
            amountDue: "Amount Due",
            stockUsed: "Stock Used",
            remainingAfterSale: "Stock After Sale",
            completeSale: "Complete Sale & Print Slip",
            processing: "Saving sale...",
            noCheckoutPermission: "You do not have permission to complete sales.",
            remove: "Remove",
            qty: "Qty",
            receiptTitle: "Sale Slip",
            printSlip: "Print Slip",
            orderNumber: "Order #",
            soldAt: "Sold At",
            soldBy: "Cashier",
            soldUnits: "Sold Quantity",
            saleSaved: "Sale saved and inventory updated automatically.",
            addAtLeastOne: "Add at least one item before checkout.",
            inventoryUpdated: "Inventory is now updated in real time.",
            noSlipSelected: "Select a sale slip from history to view its details.",
            noSlipHistory: "No sale slips available yet.",
            historyTitle: "Sales Slip History",
            historySearchPlaceholder: "Search by order number, SKU, or item name",
            historyOrder: "Order",
            historyDate: "Date",
            historyItems: "Items",
            historyTotal: "Total",
            historyAction: "Action",
            viewSlip: "View Slip",
            showing: "Showing",
            of: "of",
            rowsPerPage: "Rows",
            page: "Page",
            previous: "Previous",
            next: "Next",
            dozenRequiresStock:
              "At least 12 stock units are required to sell by dozen.",
            customerLabel: "Customer (optional)",
            customerSearchPlaceholder: "Search by code, name, address or phone...",
            walkIn: "Walk-in (no customer)",
            noCustomersFound: "No customers found",
            clearCustomer: "Clear customer",
            previousPrice: "Previous",
            usePreviousPrice: "Use this price",
            noPreviousPrice: "No previous price",
            loadingPreviousPrice: "Loading previous price...",
          },
    [language]
  );

  function saleUnitLabel(saleUnit: CashierSaleUnit) {
    if (saleUnit === "DOZEN") return labels.saleUnitDozen;
    if (saleUnit === "KG") return labels.saleUnitKg;
    return labels.saleUnitUnit;
  }

  function formatSaleQuantity(quantity: number, saleUnit: CashierSaleUnit) {
    const digits = saleUnit === "KG" ? 3 : 0;
    return `${formatNumber(quantity, digits)} ${saleUnitLabel(saleUnit)}`;
  }

  function formatMoney(amount: number) {
    return formatCurrency(amount, currencyCode);
  }

  function clearQuantityDraft(productId: string) {
    setQuantityDraftByProductId((prev) => {
      if (!(productId in prev)) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  function getQuantityInputValue(line: CartLine) {
    const draft = quantityDraftByProductId[line.productId];
    if (typeof draft === "string") return draft;

    if (line.saleUnit === "KG") {
      return line.quantity.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    }

    return String(Math.floor(line.quantity));
  }

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const list = normalized
      ? products.filter(
          (product) =>
            product.name.toLowerCase().includes(normalized) ||
            product.sku.toLowerCase().includes(normalized)
        )
      : products;

    return list.slice(0, 36);
  }, [products, search]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 20);
    const q = customerSearch.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.address ?? "").toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [customers, customerSearch]);

  // Gross total (before discounts)
  const grossTotal = useMemo(
    () => toMoney(cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)),
    [cart]
  );

  // Total discount amount
  const totalDiscount = useMemo(
    () =>
      toMoney(
        cart.reduce(
          (sum, line) => sum + toMoney(line.quantity * line.unitPrice * line.discountPct / 100),
          0
        )
      ),
    [cart]
  );

  // Net total (after discounts) — used for change/amount-due calculations
  const subtotal = toMoney(grossTotal - totalDiscount);

  // Total purchase/cost price of all items in cart based on stock units
  const totalCost = useMemo(
    () =>
      toMoney(
        cart.reduce(
          (sum, line) =>
            sum + toStockUnits(line.saleUnit, line.quantity) * (line.costPrice || 0),
          0
        )
      ),
    [cart]
  );

  // Estimated profit = net selling price (subtotal) - total purchase/cost price
  const estimatedProfit = useMemo(
    () => toMoney(subtotal - totalCost),
    [subtotal, totalCost]
  );

  const selectedReceipt = useMemo(
    () => saleHistory.find((entry) => entry.orderId === selectedReceiptId) || null,
    [saleHistory, selectedReceiptId]
  );

  const selectedTenderedAmount =
    selectedReceipt && selectedReceipt.orderId in tenderedByOrderId
      ? tenderedByOrderId[selectedReceipt.orderId]
      : null;

  const receiptChangeDue =
    selectedReceipt && selectedTenderedAmount !== null
      ? Math.max(0, toMoney(selectedTenderedAmount - selectedReceipt.totalAmount))
      : null;
  const receiptAmountDue =
    selectedReceipt && selectedTenderedAmount !== null
      ? Math.max(0, toMoney(selectedReceipt.totalAmount - selectedTenderedAmount))
      : null;

  const filteredSaleHistory = useMemo(() => {
    const normalized = historySearch.trim().toLowerCase();
    if (!normalized) return saleHistory;

    return saleHistory.filter((entry) => {
      if (entry.orderNumber.toLowerCase().includes(normalized)) return true;

      return entry.items.some(
        (item) =>
          item.sku.toLowerCase().includes(normalized) ||
          item.name.toLowerCase().includes(normalized)
      );
    });
  }, [saleHistory, historySearch]);

  const totalHistoryPages = Math.max(
    1,
    Math.ceil(filteredSaleHistory.length / historyPageSize)
  );
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
  const visibleHistoryRows = useMemo(() => {
    const start = (safeHistoryPage - 1) * historyPageSize;
    return filteredSaleHistory.slice(start, start + historyPageSize);
  }, [filteredSaleHistory, safeHistoryPage, historyPageSize]);

  function addProductToCart(product: CashierProduct) {
    if (product.currentStock <= 0) {
      setFeedback({
        type: "error",
        message:
          language === "ur"
            ? `${withUrduMeaning(product.name, language)} اسٹاک سے ختم ہے۔`
            : `${product.name} is out of stock.`,
      });
      return;
    }

    const existing = cart.find((line) => line.productId === product.id);
    if (!existing) {
      setFeedback(null);
      setCart((prev) => [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          quantity: 1,
          unitPrice: toMoney(product.sellingPrice),
          costPrice: toMoney(product.costPrice ?? 0),
          saleUnit: "UNIT",
          maxStock: product.currentStock,
          discountPct: 0,
        },
      ]);
      return;
    }

    const step = quantityStepForSaleUnit(existing.saleUnit);
    const nextQuantity = normalizeEnteredQuantity(
      existing.saleUnit,
      existing.quantity + step
    );

    const nextStockUsed = toStockUnits(existing.saleUnit, nextQuantity);
    if (nextStockUsed > existing.maxStock) {
      setFeedback({
        type: "error",
        message:
          language === "ur"
            ? `${withUrduMeaning(product.name, language)} کے لیے مزید اسٹاک دستیاب نہیں۔`
            : `No more stock available for ${product.name}.`,
      });
      return;
    }

    setFeedback(null);
    clearQuantityDraft(product.id);
    setCart((prev) =>
      prev.map((line) =>
        line.productId === product.id ? { ...line, quantity: nextQuantity } : line
      )
    );
  }

  function decrementQuantity(productId: string) {
    clearQuantityDraft(productId);
    setCart((prev) => {
      const current = prev.find((line) => line.productId === productId);
      if (!current) return prev;

      const step = quantityStepForSaleUnit(current.saleUnit);
      const nextQuantity = normalizeEnteredQuantity(
        current.saleUnit,
        current.quantity - step
      );

      if (nextQuantity <= 0) {
        return prev.filter((line) => line.productId !== productId);
      }

      return prev.map((line) =>
        line.productId === productId ? { ...line, quantity: nextQuantity } : line
      );
    });
  }

  function incrementQuantity(productId: string) {
    const current = cart.find((line) => line.productId === productId);
    if (!current) return;

    const step = quantityStepForSaleUnit(current.saleUnit);
    const nextQuantity = normalizeEnteredQuantity(
      current.saleUnit,
      current.quantity + step
    );

    const nextStockUsed = toStockUnits(current.saleUnit, nextQuantity);
    if (nextStockUsed > current.maxStock) {
      setFeedback({
        type: "error",
        message:
          language === "ur"
            ? `${withUrduMeaning(current.name, language)} کے لیے مزید اسٹاک دستیاب نہیں۔`
            : `No more stock available for ${current.name}.`,
      });
      return;
    }

    setFeedback(null);
    clearQuantityDraft(productId);
    setCart((prev) =>
      prev.map((line) =>
        line.productId === productId ? { ...line, quantity: nextQuantity } : line
      )
    );
  }

  function updateQuantityDraft(productId: string, value: string) {
    setQuantityDraftByProductId((prev) => ({
      ...prev,
      [productId]: value,
    }));
  }

  function commitQuantityDraft(productId: string) {
    const current = cart.find((line) => line.productId === productId);
    if (!current) return;

    const draft = quantityDraftByProductId[productId];
    if (draft === undefined) return;

    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      clearQuantityDraft(productId);
      return;
    }

    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed)) {
      clearQuantityDraft(productId);
      return;
    }

    const normalized = normalizeEnteredQuantity(current.saleUnit, parsed);
    const minimumAllowed = current.saleUnit === "KG" ? 0.001 : 1;
    if (normalized < minimumAllowed) {
      clearQuantityDraft(productId);
      return;
    }

    const stockUsed = toStockUnits(current.saleUnit, normalized);
    if (stockUsed > current.maxStock) {
      setFeedback({
        type: "error",
        message:
          language === "ur"
            ? `${withUrduMeaning(current.name, language)} کے لیے مطلوبہ مقدار دستیاب اسٹاک سے زیادہ ہے۔`
            : `Requested quantity exceeds available stock for ${current.name}.`,
      });
      clearQuantityDraft(productId);
      return;
    }

    setFeedback(null);
    clearQuantityDraft(productId);
    setCart((prev) =>
      prev.map((line) =>
        line.productId === productId ? { ...line, quantity: normalized } : line
      )
    );
  }

  function updateUnitPrice(productId: string, value: string) {
    const parsed = Number.parseFloat(value);
    const normalized = Number.isFinite(parsed) ? toMoney(Math.max(0, parsed)) : 0;

    setCart((prev) =>
      prev.map((line) =>
        line.productId === productId ? { ...line, unitPrice: normalized } : line
      )
    );
  }

  function applyPreviousPrice(productId: string) {
    const price = previousPrices[productId];
    if (price == null) return;
    setCart((prev) =>
      prev.map((line) =>
        line.productId === productId ? { ...line, unitPrice: toMoney(price) } : line
      )
    );
  }

  function updateDiscountPct(productId: string, value: string) {
    const parsed = Number.parseFloat(value);
    const normalized = Number.isFinite(parsed)
      ? Math.min(100, Math.max(0, Math.round(parsed)))
      : 0;

    setCart((prev) =>
      prev.map((line) =>
        line.productId === productId ? { ...line, discountPct: normalized } : line
      )
    );
  }

  function removeFromCart(productId: string) {
    clearQuantityDraft(productId);
    setCart((prev) => prev.filter((line) => line.productId !== productId));
  }

  function handleQuickAddFromSearch(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.max(0, Math.min(filteredProducts.length - 1, highlightedProduct + (event.key === "ArrowDown" ? 1 : -1)));
      setHighlightedProduct(next);
      setProductKeyboardSelection(true);
      document.getElementById(`product-option-${next}`)?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey && search.trim())) {
      event.preventDefault();
      const match = filteredProducts[highlightedProduct];
      if (match) selectProduct(match);
    } else if (event.key === "Escape") {
      setSearch("");
      setHighlightedProduct(0);
    setProductKeyboardSelection(false);
    }
  }

  function handleCheckout() {
    if (checkoutLock.current || isPending) return;
    if (cart.length === 0) {
      setFeedback({ type: "error", message: labels.addAtLeastOne });
      return;
    }

    if (!canCheckout) {
      setFeedback({ type: "error", message: labels.noCheckoutPermission });
      return;
    }

    setFeedback(null);

    const saleItems = cart.map((line) => ({
      productId: line.productId,
      quantity: quantityDraftByProductId[line.productId] !== undefined
        ? Number(quantityDraftByProductId[line.productId]) : line.quantity,
      unitPrice: line.unitPrice,
      saleUnit: line.saleUnit,
      discountPct: line.discountPct,
    }));
    const invalidIndex = saleItems.findIndex((item, i) => !Number.isFinite(item.quantity) || item.quantity < 1 || !Number.isInteger(item.quantity) || item.quantity > cart[i].maxStock);
    if (invalidIndex >= 0) {
      setFeedback({ type: "error", message: "Enter a valid quantity within available stock before printing." });
      focusField(quantityRefs.current[saleItems[invalidIndex].productId]);
      return;
    }
    // Reserve the window during the keyboard/click gesture, before saving asynchronously.
    const printWindow = window.open("", "_blank", "width=420,height=760");
    if (!printWindow) {
      setFeedback({ type: "error", message: "Allow pop-ups for this site, then try again. The sale has not been saved." });
      return;
    }
    printWindow.document.body.textContent = "Preparing receipt…";
    checkoutLock.current = true;
    const tenderedAmount = 0;

    // ── Offline path ──────────────────────────────────────────────────────
    if (!isOnline) {
      try {
      const checkoutCart = cart.map((line, i) => ({ ...line, quantity: saleItems[i].quantity }));
      const checkoutGross = toMoney(checkoutCart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
      const checkoutDiscount = toMoney(checkoutCart.reduce((sum, line) => sum + toMoney(line.quantity * line.unitPrice * line.discountPct / 100), 0));
      const pendingId = generatePendingId("PEND");
      const tempReceipt: CashierSaleReceipt = {
        orderId: pendingId,
        orderNumber: pendingId,
        createdAtIso: new Date().toISOString(),
        subtotal: checkoutGross,
        discountTotal: checkoutDiscount,
        totalAmount: toMoney(checkoutGross - checkoutDiscount),
        itemCount: checkoutCart.reduce((n, l) => n + l.quantity, 0),
        cashierName: propCashierName ?? (language === "ur" ? "آف لائن" : "Offline"),
        customerName: selectedCustomer?.name ?? null,
        organizationName: propOrganizationName ?? "",
        currencyCode,
        items: checkoutCart.map((line) => {
          const lineGross = toMoney(line.quantity * line.unitPrice);
          const discountAmount = toMoney(lineGross * line.discountPct / 100);
          return {
            productId: line.productId,
            sku: line.sku,
            name: line.name,
            quantity: line.quantity,
            saleUnit: line.saleUnit,
            stockUnitsDeducted: toStockUnits(line.saleUnit, line.quantity),
            unitPrice: line.unitPrice,
            discountPct: line.discountPct,
            discountAmount,
            lineTotal: toMoney(lineGross - discountAmount),
            remainingStock: Math.max(0, line.maxStock - toStockUnits(line.saleUnit, line.quantity)),
          };
        }),
      };

      queuePendingSale({
        id: pendingId,
        createdAtIso: new Date().toISOString(),
        items: saleItems,
        tenderedAmount,
        customerName: selectedCustomer?.name ?? null,
        customerId: selectedCustomer?.id ?? null,
        tempReceipt,
      });

      if (!getPendingSales().some(sale => sale.id === pendingId)) {
        throw new Error("Offline storage unavailable");
      }

      setProducts((prev) =>
        prev.map((product) => {
          const cartLine = checkoutCart.find((l) => l.productId === product.id);
          if (!cartLine) return product;
          const deducted = toStockUnits(cartLine.saleUnit, cartLine.quantity);
          return { ...product, currentStock: Math.max(0, product.currentStock - deducted) };
        })
      );

      setSaleHistory((prev) => [tempReceipt, ...prev]);
      setSelectedReceiptId(tempReceipt.orderId);
      setHistoryPage(1);

      if (tenderedAmount > 0) {
        setTenderedByOrderId((prev) => ({ ...prev, [tempReceipt.orderId]: tenderedAmount }));
      }

      setCart([]);
      setSearch("");
      setHighlightedProduct(0);
    setProductKeyboardSelection(false);
      setQuantityDraftByProductId({});
      setSelectedCustomer(null);
      setEditingCustomer(false);
      setCustomerSearch("");
      setFeedback({
        type: "success",
        message:
          language === "ur"
            ? "سیل آف لائن محفوظ ہو گئی۔ انٹرنیٹ بحال ہونے پر خودکار sync ہو گا۔"
            : "Sale saved offline. It will sync automatically when you reconnect.",
      });
      checkoutLock.current = false;
      void handlePrintSlip(tempReceipt, printWindow);
      focusField(searchRef.current);
      return;
      } catch {
        printWindow.close();
        setFeedback({ type: "error", message: "Could not save the offline sale. Your cart has been kept." });
      } finally {
        checkoutLock.current = false;
      }
      return;
    }

    // ── Online path ───────────────────────────────────────────────────────
    startTransition(async () => {
      try {
      const result = await completeCashierSaleForCurrentOrganization({
        items: saleItems,
        customerId: selectedCustomer?.id ?? null,
      });

      if (result.error || !result.receipt) {
        printWindow.close();
        setFeedback({
          type: "error",
          message:
            result.error ||
            (language === "ur"
              ? "سیل مکمل نہیں ہو سکی۔ دوبارہ کوشش کریں۔"
              : "Unable to complete sale. Please try again."),
        });
        return;
      }

      const completedReceipt = result.receipt;

      const remainingStockByProduct = new Map<string, number>();
      for (const line of completedReceipt.items) {
        remainingStockByProduct.set(line.productId, line.remainingStock);
      }

      setProducts((prev) =>
        prev.map((product) => {
          const remaining = remainingStockByProduct.get(product.id);
          if (remaining === undefined) return product;
          return { ...product, currentStock: remaining };
        })
      );

      setSaleHistory((prev) => [
        completedReceipt,
        ...prev.filter((entry) => entry.orderId !== completedReceipt.orderId),
      ]);
      setSelectedReceiptId(completedReceipt.orderId);
      setHistoryPage(1);

      setTenderedByOrderId((prev) => {
        const next = { ...prev };
        if (tenderedAmount > 0) {
          next[completedReceipt.orderId] = tenderedAmount;
        } else {
          delete next[completedReceipt.orderId];
        }
        return next;
      });

      setCart([]);
      setSearch("");
      setHighlightedProduct(0);
    setProductKeyboardSelection(false);
      setQuantityDraftByProductId({});
      setSelectedCustomer(null);
      setEditingCustomer(false);
      setCustomerSearch("");
      setFeedback({ type: "success", message: labels.saleSaved });
      await handlePrintSlip(completedReceipt, printWindow);
      focusField(searchRef.current);
      } catch {
        printWindow.close();
        setFeedback({ type: "error", message: "Checkout could not be confirmed. Check Sales History before retrying." });
      } finally {
        checkoutLock.current = false;
      }
    });
  }

  useEffect(() => { checkoutRef.current = handleCheckout; });

  async function handlePrintSlip(targetReceipt: CashierSaleReceipt, reservedWindow?: Window) {
    const targetTenderedAmount =
      targetReceipt.orderId in tenderedByOrderId
        ? tenderedByOrderId[targetReceipt.orderId]
        : null;

    const popup = reservedWindow ?? window.open("", "_blank", "width=420,height=760");
    if (!popup || popup.closed) {
      setFeedback({ type: "error", message: "The receipt is saved. Use Sales History to print it." });
      return;
    }
    let branding = { name: propOrganizationName ?? targetReceipt.organizationName, logoUrl: initialLogoUrl, address: initialAddress, phone: initialPhone };
    if (isOnline) {
      try { branding = await getCurrentOrganizationBranding(); }
      catch { /* Use branding already loaded with the page. */ }
    }
    const { logoUrl: orgLogoUrl, address: orgAddress, phone: orgPhone } = branding;


    const printReceiptChangeDue =
      targetTenderedAmount !== null
        ? Math.max(0, toMoney(targetTenderedAmount - targetReceipt.totalAmount))
        : null;
    const printReceiptAmountDue =
      targetTenderedAmount !== null
        ? Math.max(0, toMoney(targetReceipt.totalAmount - targetTenderedAmount))
        : null;

    const hasDiscount = targetReceipt.items.some((l) => l.discountPct > 0);

    const rowMarkup = targetReceipt.items
      .map(
        (line) => `
          <tr>
            <td>${escapeHtml(line.sku)}</td>
            <td>${escapeHtml(line.name)}</td>
            <td style="text-align:right;">${escapeHtml(formatSaleQuantity(line.quantity, line.saleUnit))}</td>
            <td style="text-align:right;">${escapeHtml(formatMoney(line.unitPrice))}</td>
            ${hasDiscount ? `<td style="text-align:right;">${line.discountPct > 0 ? `${line.discountPct}%` : "—"}</td>` : ""}
            <td style="text-align:right;">${escapeHtml(formatMoney(line.lineTotal))}</td>
          </tr>
        `
      )
      .join("");

    const logoHtml = orgLogoUrl
      ? `<div style="text-align:center;margin-bottom:10px;"><img src="${escapeHtml(orgLogoUrl)}" alt="Logo" style="max-height:64px;max-width:180px;object-fit:contain;" /></div>`
      : "";
    const addressHtml = orgAddress
      ? `<p class="meta" style="text-align:center;">${escapeHtml(orgAddress)}</p>`
      : "";
    const phoneHtml = orgPhone
      ? `<p class="meta" style="text-align:center;">${escapeHtml(orgPhone)}</p>`
      : "";
    const customerHtml = targetReceipt.customerName
      ? `<div class="customer-box">
          <p class="meta"><strong>${language === "ur" ? "کسٹمر" : "Customer"}:</strong> ${escapeHtml(targetReceipt.customerName)}</p>
         </div>`
      : "";

    popup.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(targetReceipt.orderNumber)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #111827; }
            h1 { margin: 0 0 4px; font-size: 17px; text-align: center; }
            .org-header { text-align: center; margin-bottom: 10px; border-bottom: 1px solid #d1d5db; padding-bottom: 10px; }
            .meta { font-size: 12px; color: #374151; margin: 2px 0; }
            .customer-box { margin: 8px 0; padding: 6px 8px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 0; font-size: 12px; }
            th { text-align: left; font-weight: 700; }
            .totals { margin-top: 12px; font-size: 12px; }
            .totals .line { display: flex; justify-content: space-between; margin-top: 4px; }
            .totals .discount { color: #059669; }
            .footer { margin-top: 18px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="org-header">
            ${logoHtml}
            <h1>${escapeHtml(branding.name)}</h1>
            ${addressHtml}
            ${phoneHtml}
          </div>

          <p class="meta" style="text-align:center;font-weight:600;font-size:13px;">${escapeHtml(labels.receiptTitle)}</p>
          <p class="meta">${escapeHtml(labels.orderNumber)}: <strong>${escapeHtml(targetReceipt.orderNumber)}</strong></p>
          <p class="meta">${escapeHtml(labels.soldAt)}: ${escapeHtml(formatDateTimeStable(targetReceipt.createdAtIso))}</p>
          <p class="meta">${escapeHtml(labels.soldBy)}: ${escapeHtml(targetReceipt.cashierName)}</p>
          ${customerHtml}

          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>${language === "ur" ? "آئٹم" : "Item"}</th>
                <th style="text-align:right;">${escapeHtml(labels.qty)}</th>
                <th style="text-align:right;">${escapeHtml(labels.unitPrice)}</th>
                ${hasDiscount ? `<th style="text-align:right;">${escapeHtml(labels.discount)}</th>` : ""}
                <th style="text-align:right;">${escapeHtml(labels.subtotal)}</th>
              </tr>
            </thead>
            <tbody>
              ${rowMarkup}
            </tbody>
          </table>

          <div class="totals">
            <div class="line"><span>${escapeHtml(labels.soldUnits)}</span><strong>${escapeHtml(formatNumber(targetReceipt.itemCount))}</strong></div>
            ${hasDiscount ? `<div class="line"><span>${escapeHtml(labels.grossTotal)}</span><strong>${escapeHtml(formatMoney(targetReceipt.subtotal))}</strong></div>` : ""}
            ${hasDiscount ? `<div class="line discount"><span>${escapeHtml(labels.totalDiscount)}</span><strong>-${escapeHtml(formatMoney(targetReceipt.discountTotal))}</strong></div>` : ""}
            <div class="line"><span>${escapeHtml(labels.subtotal)}</span><strong>${escapeHtml(formatMoney(targetReceipt.totalAmount))}</strong></div>
            ${
              targetTenderedAmount !== null
                ? `<div class="line"><span>${escapeHtml(labels.cashReceived)}</span><strong>${escapeHtml(formatMoney(targetTenderedAmount))}</strong></div>`
                : ""
            }
            ${
              targetTenderedAmount !== null && printReceiptAmountDue !== null && printReceiptAmountDue > 0
                ? `<div class="line"><span>${escapeHtml(labels.amountDue)}</span><strong>${escapeHtml(formatMoney(printReceiptAmountDue))}</strong></div>`
                : ""
            }
            ${
              targetTenderedAmount !== null && printReceiptChangeDue !== null && (printReceiptAmountDue === null || printReceiptAmountDue === 0)
                ? `<div class="line"><span>${escapeHtml(labels.changeDue)}</span><strong>${escapeHtml(formatMoney(printReceiptChangeDue))}</strong></div>`
                : ""
            }
          </div>
          <div class="footer">Thank you for your business!</div>
        </body>
      </html>
    `);

    popup.onafterprint = () => {
      popup.close();
      window.focus();
      if (mode === "pos") focusField(searchRef.current);
    };
    popup.document.close();
    await Promise.all(Array.from(popup.document.images).map(img => img.decode().catch(() => {})));
    if (!popup.closed) {
      popup.focus();
      popup.print();
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Feedback banner ─────────────────────────────────────────── */}
      {feedback && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
          feedback.type === "error"
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        }`}>
          {feedback.message}
        </div>
      )}

      {/* ══════════════ HISTORY TAB ════════════════════════════════ */}
      {mode === "history" && (
        <div className="space-y-5">
          {selectedReceipt ? (
        <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{labels.receiptTitle}</span>
            <Button
              type="button"
              variant="outline"
              onClick={() => handlePrintSlip(selectedReceipt)}
              className="rounded-xl h-8 text-xs gap-1.5 border-zinc-200 dark:border-zinc-700"
            >
              <Printer className="h-3.5 w-3.5" />
              {labels.printSlip}
            </Button>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid gap-2 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 p-3 text-sm sm:grid-cols-2">
              <p>
                <span className="text-zinc-500 dark:text-zinc-400">{labels.orderNumber}: </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedReceipt.orderNumber}
                </span>
              </p>
              <p>
                <span className="text-zinc-500 dark:text-zinc-400">{labels.soldAt}: </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatDateTimeStable(selectedReceipt.createdAtIso)}
                </span>
              </p>
              <p>
                <span className="text-zinc-500 dark:text-zinc-400">{labels.soldBy}: </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedReceipt.cashierName}
                </span>
              </p>
              <p>
                <span className="text-zinc-500 dark:text-zinc-400">{labels.soldUnits}: </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatNumber(selectedReceipt.itemCount)}
                </span>
              </p>
              {selectedReceipt.customerName && (
                <p className="sm:col-span-2">
                  <span className="text-zinc-500 dark:text-zinc-400">{labels.customerLabel.replace(" (optional)", "").replace(" (اختیاری)", "")}: </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {selectedReceipt.customerName}
                  </span>
                </p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <div className={selectedReceipt.discountTotal > 0 ? "min-w-[620px]" : "min-w-[540px]"}>
                  <div className={`grid px-3 py-2 bg-zinc-50/80 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800 ${selectedReceipt.discountTotal > 0 ? "grid-cols-[80px_1fr_100px_100px_60px_100px]" : "grid-cols-[80px_1fr_100px_100px_100px]"}`}>
                    {["SKU", language === "ur" ? "آئٹم" : "Item", labels.qty, labels.unitPrice, ...(selectedReceipt.discountTotal > 0 ? [labels.discount] : []), labels.subtotal].map((h, i) => (
                      <span key={i} className={`text-[11px] font-semibold uppercase tracking-wide text-zinc-400 ${i >= 2 ? "text-right" : ""}`}>{h}</span>
                    ))}
                  </div>
                  {selectedReceipt.items.map((line) => (
                    <div
                      key={`${selectedReceipt.orderId}-${line.productId}-${line.saleUnit}`}
                      className={`grid items-center px-3 py-2.5 border-b border-zinc-100/60 dark:border-zinc-800/40 last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors ${selectedReceipt.discountTotal > 0 ? "grid-cols-[80px_1fr_100px_100px_60px_100px]" : "grid-cols-[80px_1fr_100px_100px_100px]"}`}
                    >
                      <span className="font-mono text-[11px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded w-fit">{line.sku}</span>
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate pr-2">{withUrduMeaning(line.name, language)}</span>
                      <span className="text-sm text-right text-zinc-600 dark:text-zinc-400">{formatSaleQuantity(line.quantity, line.saleUnit)}</span>
                      <span className="text-sm text-right text-zinc-600 dark:text-zinc-400">{formatMoney(line.unitPrice)}</span>
                      {selectedReceipt.discountTotal > 0 && (
                        <span className="text-sm text-right text-emerald-600 dark:text-emerald-400">
                          {line.discountPct > 0 ? `${line.discountPct}%` : "—"}
                        </span>
                      )}
                      <span className="text-sm text-right font-semibold text-zinc-900 dark:text-zinc-100">{formatMoney(line.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 p-3 text-sm">
              {selectedReceipt.discountTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">{labels.grossTotal}</span>
                  <span className="text-zinc-700 dark:text-zinc-300">{formatMoney(selectedReceipt.subtotal)}</span>
                </div>
              )}
              {selectedReceipt.discountTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-emerald-700 dark:text-emerald-400">{labels.totalDiscount}</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">-{formatMoney(selectedReceipt.discountTotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-300">{labels.subtotal}</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatMoney(selectedReceipt.totalAmount)}
                  {(selectedReceipt.returnedAmount ?? 0) > 0 && <span className="block text-sm font-normal text-amber-600">Returned: {formatMoney(selectedReceipt.returnedAmount ?? 0)} · Net: {formatMoney(selectedReceipt.netAmount ?? selectedReceipt.totalAmount)}</span>}
                </span>
              </div>
              {selectedTenderedAmount !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">{labels.cashReceived}</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatMoney(selectedTenderedAmount)}
                  </span>
                </div>
              )}
              {selectedTenderedAmount !== null && receiptAmountDue !== null && receiptAmountDue > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">{labels.amountDue}</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatMoney(receiptAmountDue)}
                  </span>
                </div>
              )}
              {selectedTenderedAmount !== null && receiptChangeDue !== null && (receiptAmountDue === null || receiptAmountDue === 0) && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 dark:text-zinc-300">{labels.changeDue}</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatMoney(receiptChangeDue)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
          <div className="px-5 py-4">
            <p className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 p-4 text-sm text-zinc-600 dark:text-zinc-300">
              {labels.noSlipSelected}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{labels.historyTitle}</span>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <Input
              value={historySearch}
              onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
              placeholder={labels.historySearchPlaceholder}
              className="pl-9 h-8 w-full rounded-xl border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/80 text-sm"
            />
          </div>
        </div>

        {visibleHistoryRows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">{labels.noSlipHistory}</div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-[1fr_2fr_80px_110px_100px] px-5 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20">
                  {[labels.historyOrder, labels.historyDate, labels.historyItems, language === "ur" ? "خالص رقم" : "Net Total", ""].map((h, i) => (
                    <span key={i} className={`text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 ${i >= 2 && i <= 3 ? "text-right" : i === 4 ? "text-right" : ""}`}>{h}</span>
                  ))}
                </div>
                {visibleHistoryRows.map((entry) => {
                  const isSelected = selectedReceipt?.orderId === entry.orderId;
                  return (
                    <div
                      key={entry.orderId}
                      className={`group grid grid-cols-[1fr_2fr_80px_110px_100px] items-center px-5 py-3 border-b border-zinc-100/60 dark:border-zinc-800/40 last:border-0 transition-colors ${isSelected ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"}`}
                    >
                      <span className={`font-semibold text-sm ${isSelected ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100"}`}>{entry.orderNumber}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatDateTimeStable(entry.createdAtIso)}</span>
                      <span className="text-sm text-right text-zinc-600 dark:text-zinc-400">{formatNumber(entry.itemCount)}</span>
                      <span className="text-sm text-right font-semibold text-zinc-900 dark:text-zinc-100">{formatMoney(entry.netAmount ?? entry.totalAmount)}{(entry.returnedAmount ?? 0) > 0 && <span className="block text-xs font-normal text-amber-600">Returned: {formatMoney(entry.returnedAmount ?? 0)}</span>}</span>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptId(entry.orderId)}
                          className={`inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${isSelected ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
                        >
                          {labels.viewSlip}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800">
              <TablePagination
                page={safeHistoryPage}
                pageSize={historyPageSize}
                totalItems={filteredSaleHistory.length}
                totalPages={totalHistoryPages}
                onPageChange={setHistoryPage}
                onPageSizeChange={(size) => { setHistoryPageSize(size); setHistoryPage(1); }}
                labels={{ showing: labels.showing, of: labels.of, rowsPerPage: labels.rowsPerPage, page: labels.page, previous: labels.previous, next: labels.next }}
              />
            </div>
          </div>
        )}
      </div>
      </div>
      )}

      {/* ══════════════ POS TAB ════════════════════════════════════ */}
      {mode === "pos" && (
      <>
      <fieldset disabled={isPending} className="min-w-0 grid gap-4 xl:gap-6 items-start">
        {/* ── Customer & Product Picker ─────────────────────────────── */}
        <div className="min-w-0 grid gap-2.5 md:grid-cols-2 items-start">
          {/* ── Customer Selector ─────────────────────────────────── */}
          <div className="h-[84px] space-y-1 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 bg-zinc-50/60 dark:bg-zinc-800/30 p-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <User className="h-3.5 w-3.5" />
              {labels.customerLabel}
            </p>
            {selectedCustomer && !editingCustomer ? (
              <div className="flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{selectedCustomer.code} · {selectedCustomer.name}</p>
                  {selectedCustomer.phone && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{selectedCustomer.phone}</p>
                  )}
                </div>
                <div className="ml-auto text-right text-sm" aria-live="polite"><span className="text-zinc-500">{language === "ur" ? "بقایا" : "Balance"}</span><p className="font-semibold">{formatMoney(selectedCustomer.balance)}</p></div>
                <button
                  type="button"
                  onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); }}
                  className="flex-shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                  aria-label={labels.clearCustomer}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                className="relative"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setShowCustomerDropdown(false);
                  }
                }}
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
                  <Input
                    ref={customerSearchRef}
                    aria-label="Search customers"
                    role="combobox"
                    aria-expanded={showCustomerDropdown}
                    aria-controls="customer-results"
                    aria-activedescendant={showCustomerDropdown ? `customer-option-${highlightedCustomer}` : undefined}
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setHighlightedCustomer(0); setShowCustomerDropdown(true); }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onKeyDown={event => {
                      if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey) return;
                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        const next = Math.max(-1, Math.min(filteredCustomers.length - 1, highlightedCustomer + (event.key === "ArrowDown" ? 1 : -1)));
                        setHighlightedCustomer(next);
                        document.getElementById(`customer-option-${next}`)?.scrollIntoView({ block: "nearest" });
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        if (highlightedCustomer === -1) chooseCustomer(null);
                        else if (filteredCustomers[highlightedCustomer]) chooseCustomer(filteredCustomers[highlightedCustomer]);
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingCustomer(false);
                        setShowCustomerDropdown(false);
                        focusField(searchRef.current);
                      } else if (event.key === "Tab" && !event.shiftKey) {
                        event.preventDefault();
                        setShowCustomerDropdown(false);
                        focusField(searchRef.current);
                      }
                    }}
                    placeholder={labels.customerSearchPlaceholder}
                    className="pl-9 h-8 text-sm"
                  />
                </div>
                {showCustomerDropdown && (
                  <div id="customer-results" role="listbox" aria-label="Customers" className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    <div aria-hidden="true" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)] gap-3 px-3 py-2 text-xs font-semibold text-zinc-500"><span>Code / Customer</span><span>Address</span><span>Contact number</span></div>
                    <button
                      type="button"
                      tabIndex={-1}
                      id="customer-option--1" role="option" aria-selected={highlightedCustomer === -1}
                      onClick={() => chooseCustomer(null)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800"
                    >
                      {labels.walkIn}
                    </button>
                    {filteredCustomers.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-zinc-400 dark:text-zinc-500 text-center">{labels.noCustomersFound}</p>
                    ) : (
                      filteredCustomers.map((c, index) => (
                        <button
                          key={c.id}
                          type="button"
                          tabIndex={-1}
                          id={`customer-option-${index}`} role="option" aria-selected={highlightedCustomer === index}
                          onClick={() => chooseCustomer(c)}
                          className={`w-full grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)] items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 last:border-0 text-left ${highlightedCustomer === index ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
                        >
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{c.code} · {c.name}</span>
                          <span className="text-xs text-zinc-500 break-words">{c.address || "—"}</span>
                          <span className="text-xs text-zinc-500 break-words">{c.phone || "—"}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Product Picker ────────────────────────────────────────── */}
          <div
            className="relative h-[84px] rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 bg-zinc-50/60 dark:bg-zinc-800/30 p-2"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setShowProductDropdown(false);
              }
            }}
          >
            <div className="space-y-1 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{labels.pickerTitle}</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <Input
                  ref={searchRef}
                  role="combobox"
                  aria-label="Search products"
                  aria-autocomplete="list"
                  aria-expanded={showProductDropdown}
                  aria-controls="product-results"
                  aria-activedescendant={filteredProducts[highlightedProduct] ? `product-option-${highlightedProduct}` : undefined}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setHighlightedProduct(0); setProductKeyboardSelection(false); setShowProductDropdown(true); }}
                  onFocus={() => setShowProductDropdown(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Tab" && event.shiftKey) {
                      event.preventDefault();
                      if (customerSearchRef.current) {
                        focusField(customerSearchRef.current);
                      }
                      return;
                    }
                    handleQuickAddFromSearch(event);
                  }}
                  placeholder={labels.searchPlaceholder}
                  className="pl-9 rounded-xl border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 h-8 text-sm"
                />
              </div>
            </div>
            {showProductDropdown && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[420px] overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white p-2.5 shadow-lg dark:bg-zinc-900">
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-6">{language === "ur" ? "اس تلاش سے کوئی پروڈکٹ نہیں ملی۔" : "No products matched this search."}</p>
              ) : (
                <div id="product-results" role="listbox" aria-label="Products" className="space-y-1.5 max-h-[395px] overflow-y-auto pr-1.5 custom-scrollbar [scrollbar-gutter:stable]">
                  {filteredProducts.map((product, index) => {
                    const isOut = product.currentStock <= 0;
                    return (
                      <div key={product.id} id={`product-option-${index}`} role="option" aria-selected={index === highlightedProduct} className={`${productKeyboardSelection && index === highlightedProduct ? "ring-1 ring-zinc-400 dark:ring-zinc-500 " : ""}flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors ${isOut ? "border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 opacity-60" : "border-zinc-200/70 dark:border-zinc-700/60 bg-white dark:bg-zinc-900/60 hover:border-emerald-200 dark:hover:border-emerald-800/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10"}`}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{withUrduMeaning(product.name, language)}</p>
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            <span className="font-mono">{product.sku}</span> · {withUrduMeaning(product.category, language)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{formatMoney(product.sellingPrice)}</p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${isOut ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>
                              {labels.stock}: {product.currentStock}
                            </span>
                          </div>
                          <button type="button" onClick={() => selectProduct(product)} disabled={isOut} className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${isOut ? "bg-zinc-100 text-zinc-400" : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"}`}>
                            {isOut ? labels.outOfStock : labels.add}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        {/* ── Full-width Sale Cart ──────────────────────────────────── */}
        <div ref={cartSectionRef} className="scroll-mt-20 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{labels.cartTitle}</span>
            {cart.length > 0 && <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">{cart.length}</span>}
          </div>
          <div className="p-2.5 space-y-2.5">
            {cart.length === 0 ? (
              <p className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 p-4 text-sm text-zinc-500 dark:text-zinc-400 text-center">{labels.cartEmpty}</p>
            ) : (
              <div className="max-h-[calc(100vh-280px)] lg:max-h-[calc(100dvh-280px)] min-h-[120px] overflow-x-auto overflow-y-auto pr-1.5 custom-scrollbar">
                <div className="min-w-[990px] space-y-1.5">
                  <div className="grid grid-cols-[minmax(180px,1fr)_110px_110px_170px_105px_105px_110px_36px] items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    <span>Product</span>
                    <span className="text-center">Previous</span>
                    <span className="text-center">Price</span>
                    <span className="text-center">Qty</span>
                    <span className="text-center">Disc</span>
                    <span className="text-center">Cost price</span>
                    <span className="text-right">Total</span>
                    <span />
                  </div>
                {cart.map((line) => {
                  const lineGross = toMoney(line.quantity * line.unitPrice);
                  const lineDiscountAmt = toMoney(lineGross * line.discountPct / 100);
                  const lineNet = toMoney(lineGross - lineDiscountAmt);

                  return (
                    <div key={line.productId} className="grid grid-cols-[minmax(180px,1fr)_110px_110px_170px_105px_105px_110px_36px] items-center gap-2 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 bg-zinc-50/60 dark:bg-zinc-800/30 p-2.5">
                      <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {withUrduMeaning(line.name, language)}
                          </p>
                      </div>

                      <Input
                        readOnly
                        value={selectedCustomer && line.productId in previousPrices ? formatMoney(previousPrices[line.productId]) : "—"}
                        className="h-8 w-full bg-zinc-100 px-2 text-center text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        aria-label={labels.previousPrice}
                        title={labels.previousPrice}
                      />

                      <div className="flex min-w-0 flex-col gap-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          ref={el => { priceRefs.current[line.productId] = el; }}
                          onFocus={event => event.currentTarget.select()}
                          onKeyDown={event => {
                            if (event.ctrlKey || event.metaKey) return;
                            if (event.key === "Tab" || event.key === "Enter") {
                              event.preventDefault();
                              focusField(event.shiftKey ? searchRef.current : quantityRefs.current[line.productId]);
                            }
                          }}
                          value={line.unitPrice}
                          onChange={(event) => updateUnitPrice(line.productId, event.target.value)}
                          className="h-8 w-full px-2 text-center text-sm"
                          aria-label={labels.unitPrice}
                          title={labels.unitPrice}
                        />
                      </div>

                      <div className="flex items-center justify-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onMouseDown={(event) => event.preventDefault()} onClick={() => decrementQuantity(line.productId)} aria-label="Decrease quantity">
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                          type="text"
                          ref={el => { quantityRefs.current[line.productId] = el; }}
                          onFocus={event => event.currentTarget.select()}
                          inputMode={line.saleUnit === "KG" ? "decimal" : "numeric"}
                          value={getQuantityInputValue(line)}
                          onChange={(event) => updateQuantityDraft(line.productId, event.target.value)}
                          onBlur={() => commitQuantityDraft(line.productId)}
                          onKeyDown={(event) => {
                            if (event.ctrlKey || event.metaKey) return;
                            if (event.key === "Tab" || event.key === "Enter") {
                              event.preventDefault();
                              focusField(event.shiftKey ? priceRefs.current[line.productId] : discountRefs.current[line.productId]);
                            }
                          }}
                          className="h-8 w-12 px-1 text-center text-sm"
                          aria-label={labels.qty}
                        />
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8" onMouseDown={(event) => event.preventDefault()} onClick={() => incrementQuantity(line.productId)} aria-label="Increase quantity">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        ref={el => { discountRefs.current[line.productId] = el; }}
                        onFocus={event => event.currentTarget.select()}
                        onKeyDown={(event) => {
                          if (event.ctrlKey || event.metaKey) return;
                          if (event.key === "Tab" || event.key === "Enter") {
                            event.preventDefault();
                            focusField(event.shiftKey ? quantityRefs.current[line.productId] : searchRef.current);
                          }
                        }}
                        value={line.discountPct > 0 ? line.discountPct : ""}
                        placeholder={labels.discount}
                        onChange={(event) => updateDiscountPct(line.productId, event.target.value)}
                        className="h-8 w-full px-2 text-center text-sm"
                        aria-label={labels.discount}
                        title={labels.discount}
                      />

                      <span className="text-center text-sm text-zinc-500 dark:text-zinc-400">{formatMoney(line.costPrice)}</span>

                      <div className="text-right leading-tight">
                        {line.discountPct > 0 && (
                          <p className="text-[10px] text-zinc-400 line-through">{formatMoney(lineGross)}</p>
                        )}
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{formatMoney(lineNet)}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(line.productId)}
                        aria-label={labels.remove}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            {/* ── Totals ───────────────────────────────────────────── */}
            <div className="space-y-1.5 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60 bg-zinc-50/60 dark:bg-zinc-800/30 p-2.5">
              {totalDiscount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">{labels.grossTotal}</span>
                  <span className="text-zinc-700 dark:text-zinc-300">{formatMoney(grossTotal)}</span>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-700 dark:text-emerald-400">{labels.totalDiscount}</span>
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">-{formatMoney(totalDiscount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-300">{labels.subtotal}</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatMoney(subtotal)}
                </span>
              </div>

              {isAdmin && cart.length > 0 && (
                <div className="flex items-center justify-between text-sm pt-2.5 mt-2.5 border-t border-dashed border-zinc-200 dark:border-zinc-700">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    {labels.estimatedProfit}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-md",
                      estimatedProfit >= 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50"
                        : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50"
                    )}
                  >
                    {estimatedProfit >= 0 ? "+" : ""}{formatMoney(estimatedProfit)}
                  </span>
                </div>
              )}

            </div>

            {!canCheckout && (
              <p className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                {labels.noCheckoutPermission}
              </p>
            )}

            {!isOnline && (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                {language === "ur"
                  ? "آف لائن موڈ — سیل لوکل محفوظ ہو گی اور آن لائن آنے پر sync ہو گی۔"
                  : "Offline mode — sale will be saved locally and synced when you reconnect."}
              </div>
            )}

            <Button
              type="button"
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-9 text-sm shadow-sm shadow-emerald-200/50 dark:shadow-none"
              disabled={cart.length === 0 || !canCheckout || isPending}
              onClick={handleCheckout}
            >
              {isPending ? labels.processing : `${labels.completeSale} (Ctrl+Enter)`}
            </Button>

          </div>
        </div>
      </fieldset>
      </>
      )}
    </div>
  );
}
