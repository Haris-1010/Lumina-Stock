"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";

export async function signIn(_state: { error: string } | null, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || email.length > 254 || !password || password.length > 256) {
    return { error: "Enter a valid email and password." };
  }
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, include: { organization: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  if (user.organization.status === "SUSPENDED") return { error: "Your organization is suspended. Contact your administrator." };
  await createSession({ userId: user.id, organizationId: user.organizationId, email: user.email, name: user.name });
  redirect("/dashboard");
}

export async function signOut() {
  await deleteSession();
  redirect("/sign-in");
}
