export interface DashboardMetrics {
  totalInventoryValue: number;
  potentialStockouts: number;
  reorderAlerts: number;
}

export interface ForecastResult {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  avgDailySales: number;
  maxDailySales: number;
  daysUntilStockout: number;
  safetyStock: number;
  reorderPoint: number;
  suggestedReorderQty: number;
}

export interface SalesDataPoint {
  date: string;
  sales: number;
  stock: number;
}

export interface CategoryBreakdown {
  category: string;
  value: number;
  count: number;
}

export type InvoiceType = "SALES" | "PURCHASE";

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export type PaymentMethodType =
  | "CARD"
  | "BANK_TRANSFER"
  | "CASH"
  | "WALLET"
  | "MOBILE_WALLET"
  | "JAZZCASH"
  | "EASYPAISA"
  | "PAYPAL"
  | "STRIPE"
  | "OTHER";

export type PaymentGateway = "STRIPE" | "PAYPAL" | "JAZZCASH" | "EASYPAISA" | "MANUAL";

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" | "CANCELLED";

export type TransactionDirection = "INCOMING" | "OUTGOING";

export type TransactionSource =
  | "INVOICE_PAYMENT"
  | "GATEWAY_WEBHOOK"
  | "ACCOUNT_CREDIT"
  | "MANUAL_ENTRY";

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date | null;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  currency: string;
  salesOrderNumber?: string | null;
  purchaseOrderNumber?: string | null;
  supplierName?: string | null;
}

export interface InvoicePaymentEntry {
  id: string;
  amount: number;
  currency: string;
  method: PaymentMethodType;
  gateway: PaymentGateway;
  status: PaymentStatus;
  transactionRef: string | null;
  providerPaymentId: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface InvoiceDetails extends InvoiceListItem {
  notes: string | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    sku: string | null;
    productName: string | null;
  }>;
  payments: InvoicePaymentEntry[];
}

export interface AccountTransactionEntry {
  id: string;
  source: TransactionSource;
  direction: TransactionDirection;
  gateway: PaymentGateway;
  method: PaymentMethodType | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  senderName: string | null;
  senderAccount: string | null;
  receiverName: string | null;
  receiverAccount: string | null;
  description: string | null;
  transactionRef: string | null;
  externalTransactionId: string | null;
  isRead: boolean;
  occurredAt: Date;
  invoiceId: string | null;
  invoiceNumber: string | null;
}
