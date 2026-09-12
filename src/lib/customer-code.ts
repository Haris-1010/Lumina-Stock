export function customerCode(customer: { id: string; metadata?: unknown }): string {
  const metadata = customer.metadata as Record<string, unknown> | null;
  return typeof metadata?.code === "string" && metadata.code.trim() ? metadata.code : customer.id;
}
