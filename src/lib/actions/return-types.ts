export type ReturnKind = "CUSTOMER_RETURN" | "SUPPLIER_RETURN";
export type ReturnCondition = "RESALEABLE" | "DAMAGED" | "EXPIRED";

export const RETURN_CONDITION_LABELS: Record<ReturnCondition, string> = {
  RESALEABLE: "Resaleable — restock",
  DAMAGED: "Damaged — write off",
  EXPIRED: "Expired — write off",
};
