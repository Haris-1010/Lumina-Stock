"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createSession } from "@/lib/session";

/**
 * Lets the signed-in user change their own login email. Requires the current
 * password for verification, checks the new address is unique, then refreshes
 * the session cookie so the JWT email stays in sync.
 */
export async function updateCurrentUserEmail(input: {
  newEmail: string;
  currentPassword: string;
}): Promise<{ success: true; email: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be signed in to change your email." };
  }

  const newEmail = input.newEmail.trim().toLowerCase();
  const currentPassword = input.currentPassword;

  if (!newEmail || !currentPassword) {
    return { error: "Enter your new email and current password." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return { error: "Please enter a valid email address." };
  }

  if (newEmail === user.email.toLowerCase()) {
    return { error: "That is already your current email address." };
  }

  const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordValid) {
    return { error: "Current password is incorrect." };
  }

  const existing = await db.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (existing && existing.id !== user.id) {
    return { error: "An account with this email already exists." };
  }

  await db.user.update({
    where: { id: user.id },
    data: { email: newEmail },
  });

  // Keep the session JWT consistent with the new email.
  await createSession({
    userId: user.id,
    organizationId: user.organizationId,
    email: newEmail,
    name: user.name,
  });

  revalidatePath("/settings");

  return { success: true, email: newEmail };
}
