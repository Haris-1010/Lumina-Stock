export type AdjustmentReason =
  | "DAMAGED"
  | "EXPIRED"
  | "THEFT"
  | "MISCOUNTING"
  | "RETURN_TO_SUPPLIER"
  | "FOUND"
  | "OTHER";

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  DAMAGED: "Damaged / Defective",
  EXPIRED: "Expired",
  THEFT: "Theft / Loss",
  MISCOUNTING: "Stock Count Correction",
  RETURN_TO_SUPPLIER: "Return to Supplier",
  FOUND: "Stock Found / Surplus",
  OTHER: "Other",
};
