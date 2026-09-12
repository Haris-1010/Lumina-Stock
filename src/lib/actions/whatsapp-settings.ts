"use server";

import { revalidatePath } from "next/cache";
import { requireActionPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { sendWhatsAppText, isWhatsAppConfigured, normalizePhone } from "@/lib/whatsapp";

export async function getWhatsAppSettingsForCurrentOrganization() {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "Permission denied." };
  }

  const org = await (db as any).organization.findUnique({
    where: { id: profile.user.organizationId },
    select: { whatsappPhone: true, whatsappEnabled: true },
  });

  return {
    whatsappPhone: (org?.whatsappPhone as string | null) ?? null,
    whatsappEnabled: (org?.whatsappEnabled as boolean) ?? false,
    apiConfigured: isWhatsAppConfigured(),
  };
}

export async function saveWhatsAppSettingsForCurrentOrganization(input: {
  phone: string;
  enabled: boolean;
}) {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "Permission denied." };
  }

  const phone = input.phone ? normalizePhone(input.phone) : null;

  if (phone && !/^\d{7,15}$/.test(phone)) {
    return { error: "Invalid phone number. Use international format without + (e.g. 923001234567)." };
  }

  await (db as any).organization.update({
    where: { id: profile.user.organizationId },
    data: { whatsappPhone: phone, whatsappEnabled: input.enabled && Boolean(phone) },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function sendWhatsAppTestMessageForCurrentOrganization() {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "Permission denied." };
  }

  if (!isWhatsAppConfigured()) {
    return { error: "WhatsApp API is not configured. Add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to your environment variables." };
  }

  const org = await (db as any).organization.findUnique({
    where: { id: profile.user.organizationId },
    select: { whatsappPhone: true, name: true },
  });

  if (!org?.whatsappPhone) {
    return { error: "No WhatsApp phone number saved. Enter your number first." };
  }

  const ok = await sendWhatsAppText(
    org.whatsappPhone,
    `✅ *Lumina Stock — Test Message*\n\nYour WhatsApp integration for *${org.name}* is working!\n\nReply *help* to see available commands.`,
  );

  return ok ? { success: true } : { error: "Message failed to send. Check your API credentials." };
}
