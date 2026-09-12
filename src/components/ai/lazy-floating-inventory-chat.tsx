"use client";

import dynamic from "next/dynamic";

const FloatingInventoryChat = dynamic(
  () => import("@/components/ai/floating-inventory-chat").then((m) => m.FloatingInventoryChat),
  { ssr: false }
);

export function LazyFloatingInventoryChat({ organizationName }: { organizationName: string }) {
  return <FloatingInventoryChat organizationName={organizationName} />;
}
