"use server";

import OpenAI from "openai";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireActionPermission } from "@/lib/permissions";
import type { StorefrontContent } from "@/types/storefront";
import { buildDefaultContent } from "@/types/storefront";

const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

function getGroqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "",
    baseURL: process.env.GROQ_BASE_URL || DEFAULT_GROQ_BASE_URL,
  });
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type StorefrontProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  sellingPrice: number;
  currentStock: number;
  isPublic: boolean;
};

export type StorefrontSettings = {
  enabled: boolean;
  content: StorefrontContent | null;
  subdomain: string | null;
  products: StorefrontProduct[];
};

function revalidatePublicStorefront(subdomain: string | null | undefined) {
  if (!subdomain) return;
  revalidateTag(`storefront:${subdomain}`, "max");
  revalidatePath(`/store/${subdomain}`);
  revalidatePath("/store");
}

// ─── Get Settings ──────────────────────────────────────────────────────────────

export async function getStorefrontSettings(): Promise<StorefrontSettings | { error: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "Permission denied." };
  }

  const orgId = profile.user.organizationId;

  const [org, products] = await Promise.all([
    (db as any).organization.findUnique({
      where: { id: orgId },
      select: { subdomain: true, storefrontEnabled: true, storefrontContent: true },
    }),
    (db as any).product.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true, description: true, category: true, sellingPrice: true, currentStock: true, isPublic: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    enabled: org?.storefrontEnabled ?? false,
    content: (org?.storefrontContent as StorefrontContent | null) ?? null,
    subdomain: org?.subdomain ?? null,
    products: (products as StorefrontProduct[]) ?? [],
  };
}

// ─── Generate AI Content ───────────────────────────────────────────────────────

export async function generateStorefrontContent(userPrompt?: string): Promise<{ content: StorefrontContent } | { error: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "Permission denied." };
  }

  const orgId = profile.user.organizationId;

  const org = await (db as any).organization.findUnique({
    where: { id: orgId },
    select: { name: true, niche: true, address: true, phone: true, subscriptionStatus: true },
  });

  if (!org) return { error: "Organization not found." };
  if (org.subscriptionStatus !== "ENTERPRISE") return { error: "Storefront builder is available on the Enterprise plan only." };

  const categories = await (db as any).product.findMany({
    where: { organizationId: orgId, deletedAt: null },
    select: { category: true },
    distinct: ["category"],
    take: 10,
  }) as Array<{ category: string }>;

  const categoryList = categories.map((c) => c.category).join(", ") || "general products";
  const niche = org.niche ? org.niche.replace(/_/g, " ") : "retail";

  const schema = `{
  "version": 1,
  "generatedAt": "<ISO timestamp>",
  "sectionOrder": ["hero","products","about","features","testimonials","faq","contact","footer"],
  "hero": { "enabled": true, "headline": "...", "subheadline": "...", "ctaText": "..." },
  "about": { "enabled": true, "title": "...", "body": "..." },
  "features": { "enabled": true, "title": "...", "highlights": [{"icon":"ShieldCheck","title":"...","description":"..."},{"icon":"Truck","title":"...","description":"..."},{"icon":"Star","title":"...","description":"..."}] },
  "products": { "enabled": true, "title": "...", "subtitle": "..." },
  "testimonials": { "enabled": true, "title": "...", "items": [{"quote":"...","name":"...","role":"..."},{"quote":"...","name":"...","role":"..."},{"quote":"...","name":"...","role":"..."}] },
  "faq": { "enabled": true, "title": "...", "items": [{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."},{"q":"...","a":"..."}] },
  "contact": { "enabled": true, "title": "...", "body": "...", "showPhone": true, "showAddress": true },
  "footer": { "enabled": true, "tagline": "...", "showPoweredBy": true }
}`;

  const systemPrompt = `You are a professional copywriter and web designer creating storefront website content for a business.
Generate compelling, conversion-focused copy that matches the business's style, niche, and the user's vision.
Return ONLY valid JSON matching the schema exactly. No markdown fences, no explanation, no extra keys.`;

  const visionLine = userPrompt
    ? `\nUser's vision for the site: "${userPrompt}"\nMake the tone, copy, and section titles reflect this vision.`
    : "";

  const aiUserPrompt = `Business name: ${org.name}
Business type/niche: ${niche}
Product categories: ${categoryList}
${org.address ? `Location: ${org.address}` : ""}
${org.phone ? `Phone: ${org.phone}` : ""}${visionLine}

Generate a complete storefront content JSON using this exact schema:
${schema}

Requirements:
- Hero headline: punchy, max 8 words, reflects the business type and vision
- Hero subheadline: 1 sentence value proposition
- CTA text: 2-3 words (e.g. "Shop Now", "Explore Collection")
- About body: 2 sentences, warm and professional
- Features: 3 highlights relevant to the niche
- Testimonials: 3 realistic customer reviews with names and roles
- FAQ: 4 common customer questions with clear answers
- Contact body: friendly invite to reach out
- Footer tagline: copyright with year and business name
- generatedAt: current ISO timestamp

Return only the JSON object.`;

  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: aiUserPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { error: "AI returned unexpected content. Please try again." };

    const parsed = JSON.parse(jsonMatch[0]) as StorefrontContent;
    parsed.version = 1;
    parsed.generatedAt = new Date().toISOString();
    if (!Array.isArray(parsed.sectionOrder) || parsed.sectionOrder.length === 0) {
      parsed.sectionOrder = ["hero", "products", "about", "features", "contact", "footer"];
    }

    return { content: parsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (!process.env.GROQ_API_KEY) {
      return { error: "GROQ_API_KEY is not set. Add it to your Vercel environment variables and redeploy." };
    }
    return { error: `AI generation failed: ${message}. Please try again.` };
  }
}

// ─── Save Content ──────────────────────────────────────────────────────────────

export async function saveStorefrontContent(
  content: StorefrontContent
): Promise<{ success: true } | { error: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "Permission denied." };
  }

  await (db as any).organization.update({
    where: { id: profile.user.organizationId },
    data: { storefrontContent: content as any },
  });

  revalidatePublicStorefront(profile.user.organization.subdomain);
  revalidatePath("/storefront");
  return { success: true };
}

// ─── Toggle Storefront Enabled ─────────────────────────────────────────────────

export async function toggleStorefrontEnabled(
  enabled: boolean
): Promise<{ success: true } | { error: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "Permission denied." };
  }

  await (db as any).organization.update({
    where: { id: profile.user.organizationId },
    data: { storefrontEnabled: enabled },
  });

  revalidatePublicStorefront(profile.user.organization.subdomain);
  revalidatePath("/storefront");
  return { success: true };
}

// ─── Toggle Product Public Visibility ─────────────────────────────────────────

export async function toggleProductPublic(
  productId: string,
  isPublic: boolean
): Promise<{ success: true } | { error: string }> {
  let profile: Awaited<ReturnType<typeof requireActionPermission>>;
  try {
    profile = await requireActionPermission("billingManage");
  } catch {
    return { error: "Permission denied." };
  }

  await (db as any).product.updateMany({
    where: { id: productId, organizationId: profile.user.organizationId },
    data: { isPublic },
  });

  revalidatePublicStorefront(profile.user.organization.subdomain);
  return { success: true };
}
