"use client";

import { useState, useTransition } from "react";
import {
  Sparkles, ChevronUp, ChevronDown, Eye, EyeOff, Save, Globe,
  Loader2, ExternalLink, CheckCircle2, Palette, Type, Image,
  AlertCircle, Plus, Trash2, LayoutTemplate, Navigation, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EditableStorefrontPreview } from "@/components/storefront/editable-preview";
import { ElementEditorPanel } from "@/components/storefront/element-editor-panel";
import {
  generateStorefrontContent,
  saveStorefrontContent,
  toggleStorefrontEnabled,
  toggleProductPublic,
} from "@/lib/actions/storefront";
import type { StorefrontContent, StorefrontCustomization, StorefrontElementStyle } from "@/types/storefront";
import type { StorefrontProduct } from "@/lib/actions/storefront";
import {
  buildDefaultContent, buildDefaultTestimonials, buildDefaultFaq,
  FONT_OPTIONS,
} from "@/types/storefront";

type OrgData = {
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  websiteUrl: string | null;
  theme: string | null;
  currencyCode: string;
  subdomain: string | null;
  appUrl: string;
};

interface Props {
  org: OrgData;
  initialEnabled: boolean;
  initialContent: StorefrontContent | null;
  initialProducts: StorefrontProduct[];
}

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero Banner",
  products: "Products",
  about: "About Us",
  features: "Features",
  testimonials: "Testimonials",
  faq: "FAQ",
  contact: "Contact",
  footer: "Footer",
};

type EditorTab = "content" | "design" | "layout";

function OptionCard({ label, active, onClick, children }: {
  label: string; active: boolean; onClick: () => void; children?: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
        active
          ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30 text-violet-700 font-semibold"
          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 text-zinc-700 dark:text-zinc-300"
      }`}>
      {children ?? label}
    </button>
  );
}

export function StorefrontEditor({ org, initialEnabled, initialContent, initialProducts }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [content, setContent] = useState<StorefrontContent>(
    initialContent ?? buildDefaultContent(org.name)
  );
  const [products, setProducts] = useState<StorefrontProduct[]>(initialProducts);
  const [activeSection, setActiveSection] = useState<string | null>("hero");
  const [tab, setTab] = useState<EditorTab>("content");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isTogglingEnabled, startTogglingEnabled] = useTransition();

  const storefrontUrl = org.subdomain ? `${org.appUrl}/store/${org.subdomain}` : null;
  const publicProductCount = products.filter((p) => p.isPublic).length;

  // ── helpers ──────────────────────────────────────────────────────────────

  function moveSection(index: number, direction: "up" | "down") {
    const order = [...content.sectionOrder];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    setContent((c) => ({ ...c, sectionOrder: order }));
  }

  function updateSection<K extends keyof StorefrontContent>(key: K, patch: Partial<StorefrontContent[K]>) {
    setContent((c) => ({ ...c, [key]: { ...(c[key] as object), ...patch } }));
  }

  function updateCustomization(patch: Partial<StorefrontCustomization>) {
    setContent((c) => ({ ...c, customization: { ...(c.customization ?? {}), ...patch } }));
  }

  function updateElementStyle(key: string, patch: Partial<StorefrontElementStyle>) {
    setContent((c) => {
      const existing = c.customization?.elementStyles ?? {};
      const current: StorefrontElementStyle = existing[key] ?? {};
      const merged = { ...current };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete merged[k as keyof StorefrontElementStyle];
        else (merged as Record<string, unknown>)[k] = v;
      }
      return {
        ...c,
        customization: {
          ...c.customization,
          elementStyles: { ...existing, [key]: merged },
        },
      };
    });
  }

  function setProductImage(productId: string, url: string) {
    const updated = { ...(content.customization?.productImages ?? {}), [productId]: url };
    if (!url) delete updated[productId];
    updateCustomization({ productImages: updated });
  }

  function addOptionalSection(key: "testimonials" | "faq") {
    if (content.sectionOrder.includes(key)) return;
    const defaults = key === "testimonials" ? buildDefaultTestimonials(org.name) : buildDefaultFaq(org.name);
    const insertBefore = "contact";
    const idx = content.sectionOrder.indexOf(insertBefore);
    const order = [...content.sectionOrder];
    if (idx >= 0) order.splice(idx, 0, key);
    else order.push(key);
    setContent((c) => ({ ...c, sectionOrder: order, [key]: defaults }));
  }

  function removeOptionalSection(key: "testimonials" | "faq") {
    setContent((c) => ({
      ...c,
      sectionOrder: c.sectionOrder.filter((k) => k !== key),
      [key]: undefined,
    }));
  }

  // ── actions ──────────────────────────────────────────────────────────────

  function handleToggleEnabled(val: boolean) {
    setEnabled(val);
    startTogglingEnabled(async () => {
      const res = await toggleStorefrontEnabled(val);
      if ("error" in res) { setEnabled(!val); setError(res.error); }
    });
  }

  function handleSave() {
    setError(null); setAiGenerated(false);
    startSaving(async () => {
      const res = await saveStorefrontContent(content);
      if ("error" in res) { setError(res.error); }
      else { setSavedAt(new Date().toLocaleTimeString()); }
    });
  }

  function handleGenerate() {
    setError(null); setSavedAt(null); setAiGenerated(false);
    startGenerating(async () => {
      const res = await generateStorefrontContent(userPrompt.trim() || undefined);
      if ("error" in res) { setError(res.error); }
      else {
        setContent((c) => ({ ...res.content, customization: c.customization }));
        setAiGenerated(true);
      }
    });
  }

  function handleToggleProduct(productId: string, isPublic: boolean) {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, isPublic } : p)));
    toggleProductPublic(productId, isPublic).then((res) => {
      if ("error" in res) {
        setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, isPublic: !isPublic } : p)));
        setError(res.error);
      }
    });
  }

  // ── render ────────────────────────────────────────────────────────────────

  const optionalSections: Array<"testimonials" | "faq"> = ["testimonials", "faq"];
  const addableSections = optionalSections.filter((k) => !content.sectionOrder.includes(k));

  return (
    <div className="flex flex-col gap-4">

      {/* ── Top bar ── */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 shadow-sm">

        {/* Row 1: publish + URL + save */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={handleToggleEnabled} disabled={isTogglingEnabled} />
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                {enabled ? "✅ Published" : "⬜ Unpublished"}
              </p>
              <p className="text-xs text-zinc-400">{enabled ? "Live to the public" : "Not visible yet"}</p>
            </div>
          </div>

          {storefrontUrl ? (
            <a href={storefrontUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 bg-violet-50 dark:bg-violet-950/30 rounded-lg px-3 py-2 truncate max-w-xs">
              <Globe className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{storefrontUrl}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              No subdomain set — go to <strong className="ml-1">Settings → Branding</strong> first
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Row 2: AI Prompt + Generate */}
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <Input
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Describe your vision — e.g. 'luxury fashion boutique with a bold modern feel'"
              className="text-xs h-9"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0 h-9" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-violet-500" />}
            {isGenerating ? "Generating…" : "Generate with AI"}
          </Button>
        </div>

        {/* Status messages */}
        {aiGenerated && (
          <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              AI content generated! Tweak sections in the Content tab, then click <strong>Save Changes</strong>, then toggle <strong>Published ON</strong>.
            </span>
          </div>
        )}
        {savedAt && !aiGenerated && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            Saved at {savedAt}.{" "}
            {!enabled && <span className="ml-1">Toggle <strong>Published</strong> ON above to go live.</span>}
            {enabled && storefrontUrl && (
              <a href={storefrontUrl} target="_blank" rel="noopener noreferrer" className="ml-1 underline font-semibold">
                View live store →
              </a>
            )}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </div>

      {/* ── Two-column editor ── */}
      <div className="flex gap-4 items-start">

        {/* Left panel */}
        <div className="w-72 flex-shrink-0 space-y-3">

          {/* ── ELEMENT EDITOR (shows when something is selected in preview) ── */}
          {selectedElement ? (
            <ElementEditorPanel
              elementId={selectedElement}
              content={content}
              products={products}
              onClose={() => setSelectedElement(null)}
              updateSection={updateSection}
              updateCustomization={updateCustomization}
              updateElementStyle={updateElementStyle}
            />
          ) : (
            <>
              {/* Tab switcher */}
              <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden text-sm font-medium">
                {(["content", "design", "layout"] as EditorTab[]).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-2 capitalize transition-colors ${
                      tab === t
                        ? "bg-violet-600 text-white"
                        : "bg-white dark:bg-zinc-950 text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* ── CONTENT TAB ── */}
              {tab === "content" && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-1">Sections</p>
                  {content.sectionOrder.map((key, index) => {
                    const section = content[key as keyof StorefrontContent] as { enabled?: boolean } | undefined;
                    const isEnabled = section && "enabled" in section ? section.enabled : true;
                    const isOptional = key === "testimonials" || key === "faq";
                    return (
                      <div key={key}
                        className={`rounded-xl border transition-colors bg-white dark:bg-zinc-950 ${
                          activeSection === key
                            ? "border-violet-300 dark:border-violet-700 shadow-sm"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"}`}>
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <button onClick={() => setActiveSection(activeSection === key ? null : key)}
                            className="flex-1 text-left text-sm font-medium text-zinc-800 dark:text-zinc-200">
                            {SECTION_LABELS[key] ?? key}
                          </button>
                          <button
                            onClick={() => { if (section && "enabled" in section) updateSection(key as keyof StorefrontContent, { enabled: !isEnabled } as never); }}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" title={isEnabled ? "Hide" : "Show"}>
                            {isEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-50" />}
                          </button>
                          <button onClick={() => moveSection(index, "up")} disabled={index === 0}
                            className="text-zinc-400 hover:text-zinc-600 disabled:opacity-20">
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => moveSection(index, "down")} disabled={index === content.sectionOrder.length - 1}
                            className="text-zinc-400 hover:text-zinc-600 disabled:opacity-20">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          {isOptional && (
                            <button onClick={() => removeOptionalSection(key as "testimonials" | "faq")}
                              className="text-zinc-300 hover:text-red-500" title="Remove section">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {activeSection === key && (
                          <div className="px-3 pb-3 space-y-2.5 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                            {key === "hero" && <>
                              <FieldInput label="Headline" value={content.hero.headline} onChange={(v) => updateSection("hero", { headline: v })} />
                              <FieldInput label="Subheadline" value={content.hero.subheadline} onChange={(v) => updateSection("hero", { subheadline: v })} />
                              <FieldInput label="CTA Button Text" value={content.hero.ctaText} onChange={(v) => updateSection("hero", { ctaText: v })} />
                            </>}

                            {key === "about" && <>
                              <FieldInput label="Title" value={content.about.title} onChange={(v) => updateSection("about", { title: v })} />
                              <FieldTextarea label="Body" value={content.about.body} onChange={(v) => updateSection("about", { body: v })} />
                            </>}

                            {key === "features" && <>
                              <FieldInput label="Section Title" value={content.features.title} onChange={(v) => updateSection("features", { title: v })} />
                              {content.features.highlights.map((h, i) => (
                                <div key={i} className="space-y-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2.5">
                                  <p className="text-[10px] font-semibold text-zinc-400 uppercase">Feature {i + 1}</p>
                                  <FieldInput label="Title" value={h.title} onChange={(v) => {
                                    const highlights = content.features.highlights.map((item, idx) => idx === i ? { ...item, title: v } : item);
                                    updateSection("features", { highlights });
                                  }} />
                                  <FieldInput label="Description" value={h.description} onChange={(v) => {
                                    const highlights = content.features.highlights.map((item, idx) => idx === i ? { ...item, description: v } : item);
                                    updateSection("features", { highlights });
                                  }} />
                                </div>
                              ))}
                            </>}

                            {key === "products" && <>
                              <FieldInput label="Section Title" value={content.products.title} onChange={(v) => updateSection("products", { title: v })} />
                              <FieldInput label="Subtitle" value={content.products.subtitle} onChange={(v) => updateSection("products", { subtitle: v })} />

                              {/* Product list */}
                              <div className="pt-1">
                                <p className="text-[10px] font-semibold text-zinc-500 uppercase mb-2">
                                  Public Products ({publicProductCount}/{products.length})
                                </p>
                                {products.length === 0 ? (
                                  <p className="text-xs text-zinc-400">No products found. Add some in the Inventory page first.</p>
                                ) : (
                                  <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                                    {products.map((p) => (
                                      <div key={p.id} className="space-y-1">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input type="checkbox" checked={p.isPublic}
                                            onChange={(e) => handleToggleProduct(p.id, e.target.checked)}
                                            className="rounded border-zinc-300 text-violet-600 focus:ring-violet-500" />
                                          <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate font-medium">{p.name}</span>
                                        </label>
                                        {p.isPublic && (
                                          <div className="ml-5 space-y-1">
                                            <Input
                                              placeholder="Image URL (optional)"
                                              value={content.customization?.productImages?.[p.id] ?? ""}
                                              onChange={(e) => setProductImage(p.id, e.target.value)}
                                              className="h-6 text-[10px]"
                                            />
                                            <label className="flex items-center gap-1 cursor-pointer text-[10px] text-violet-600 hover:text-violet-700 font-medium">
                                              <Upload className="h-2.5 w-2.5" />
                                              Upload image
                                              <input type="file" accept="image/*" className="hidden"
                                                onChange={async (e) => {
                                                  const file = e.target.files?.[0];
                                                  if (!file) return;
                                                  if (file.size > 1.5 * 1024 * 1024) { alert("Max 1.5MB"); return; }
                                                  const reader = new FileReader();
                                                  reader.onload = () => setProductImage(p.id, reader.result as string);
                                                  reader.readAsDataURL(file);
                                                }} />
                                            </label>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Buy & Cart options */}
                              <div className="pt-2 space-y-2 border-t border-zinc-100 dark:border-zinc-800">
                                <p className="text-[10px] font-semibold text-zinc-500 uppercase">Buy &amp; Cart Options</p>
                                <div className="flex items-center gap-2">
                                  <Switch checked={!!content.products.enableBuyButton} onCheckedChange={(v) => updateSection("products", { enableBuyButton: v })} />
                                  <Label className="text-xs">Buy Now button</Label>
                                </div>
                                {content.products.enableBuyButton && (
                                  <div className="pl-6 space-y-1.5 border-l-2 border-violet-100">
                                    <FieldInput label="Button Text" value={content.products.buyButtonText ?? "Buy Now"} onChange={(v) => updateSection("products", { buyButtonText: v })} />
                                    <FieldInput label="WhatsApp Number" value={content.products.whatsappNumber ?? ""} onChange={(v) => updateSection("products", { whatsappNumber: v })} />
                                    <FieldTextarea label="Message Template ({product} = name)" value={content.products.whatsappMessage ?? ""} onChange={(v) => updateSection("products", { whatsappMessage: v })} />
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Switch checked={!!content.products.enableAddToCart} onCheckedChange={(v) => updateSection("products", { enableAddToCart: v })} />
                                  <Label className="text-xs">Add to Cart button</Label>
                                </div>
                                {content.products.enableAddToCart && (
                                  <div className="pl-6 border-l-2 border-violet-100">
                                    <FieldInput label="Cart Button Text" value={content.products.cartButtonText ?? "Add to Cart"} onChange={(v) => updateSection("products", { cartButtonText: v })} />
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Switch checked={!!content.products.enableSaleBadge} onCheckedChange={(v) => updateSection("products", { enableSaleBadge: v })} />
                                  <Label className="text-xs">Show SALE badge</Label>
                                </div>
                              </div>
                            </>}

                            {key === "testimonials" && content.testimonials && <>
                              <FieldInput label="Section Title" value={content.testimonials.title} onChange={(v) => updateSection("testimonials", { title: v })} />
                              {content.testimonials.items.map((item, i) => (
                                <div key={i} className="space-y-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2.5">
                                  <p className="text-[10px] font-semibold text-zinc-400 uppercase">Review {i + 1}</p>
                                  <FieldTextarea label="Quote" value={item.quote} onChange={(v) => {
                                    const items = content.testimonials!.items.map((it, idx) => idx === i ? { ...it, quote: v } : it);
                                    updateSection("testimonials", { items });
                                  }} />
                                  <FieldInput label="Name" value={item.name} onChange={(v) => {
                                    const items = content.testimonials!.items.map((it, idx) => idx === i ? { ...it, name: v } : it);
                                    updateSection("testimonials", { items });
                                  }} />
                                  <FieldInput label="Role" value={item.role} onChange={(v) => {
                                    const items = content.testimonials!.items.map((it, idx) => idx === i ? { ...it, role: v } : it);
                                    updateSection("testimonials", { items });
                                  }} />
                                </div>
                              ))}
                            </>}

                            {key === "faq" && content.faq && <>
                              <FieldInput label="Section Title" value={content.faq.title} onChange={(v) => updateSection("faq", { title: v })} />
                              {content.faq.items.map((item, i) => (
                                <div key={i} className="space-y-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2.5">
                                  <p className="text-[10px] font-semibold text-zinc-400 uppercase">Q{i + 1}</p>
                                  <FieldInput label="Question" value={item.q} onChange={(v) => {
                                    const items = content.faq!.items.map((it, idx) => idx === i ? { ...it, q: v } : it);
                                    updateSection("faq", { items });
                                  }} />
                                  <FieldTextarea label="Answer" value={item.a} onChange={(v) => {
                                    const items = content.faq!.items.map((it, idx) => idx === i ? { ...it, a: v } : it);
                                    updateSection("faq", { items });
                                  }} />
                                </div>
                              ))}
                              <Button size="sm" variant="outline" className="w-full gap-1.5 h-7 text-xs mt-1"
                                onClick={() => updateSection("faq", { items: [...content.faq!.items, { q: "New question?", a: "Answer here." }] })}>
                                <Plus className="h-3 w-3" /> Add FAQ Item
                              </Button>
                            </>}

                            {key === "contact" && <>
                              <FieldInput label="Title" value={content.contact.title} onChange={(v) => updateSection("contact", { title: v })} />
                              <FieldInput label="Body" value={content.contact.body} onChange={(v) => updateSection("contact", { body: v })} />
                              <div className="flex items-center gap-2 pt-1">
                                <Switch checked={content.contact.showPhone} onCheckedChange={(v) => updateSection("contact", { showPhone: v })} />
                                <Label className="text-xs">Show phone number</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch checked={content.contact.showAddress} onCheckedChange={(v) => updateSection("contact", { showAddress: v })} />
                                <Label className="text-xs">Show address</Label>
                              </div>
                            </>}

                            {key === "footer" && <>
                              <FieldInput label="Tagline" value={content.footer.tagline} onChange={(v) => updateSection("footer", { tagline: v })} />
                              <div className="flex items-center gap-2 pt-1">
                                <Switch checked={content.footer.showPoweredBy} onCheckedChange={(v) => updateSection("footer", { showPoweredBy: v })} />
                                <Label className="text-xs">Show &quot;Powered by Lumina Stock&quot;</Label>
                              </div>
                            </>}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add optional sections */}
                  {addableSections.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 px-1">Add Sections</p>
                      {addableSections.map((key) => (
                        <button key={key} onClick={() => addOptionalSection(key)}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 text-xs text-zinc-500 hover:border-violet-400 hover:text-violet-600 transition-colors">
                          <Plus className="h-3.5 w-3.5" />
                          Add {SECTION_LABELS[key]} section
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── DESIGN TAB ── */}
              {tab === "design" && (
                <div className="space-y-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">

                  {/* Primary Color */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5 text-zinc-500" />
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Primary Color</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="color"
                        value={content.customization?.primaryColor || "#059669"}
                        onChange={(e) => updateCustomization({ primaryColor: e.target.value })}
                        className="h-9 w-9 rounded-lg border border-zinc-200 cursor-pointer p-0.5" />
                      <Input value={content.customization?.primaryColor || ""}
                        onChange={(e) => updateCustomization({ primaryColor: e.target.value })}
                        placeholder="#059669" className="h-8 text-xs font-mono" />
                      <button onClick={() => updateCustomization({ primaryColor: undefined })}
                        className="text-xs text-zinc-400 hover:text-zinc-600 whitespace-nowrap">Reset</button>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {["#059669","#0284c7","#7c3aed","#e11d48","#d97706","#3f3f46","#dc2626","#2563eb","#16a34a","#ea580c"].map((c) => (
                        <button key={c} onClick={() => updateCustomization({ primaryColor: c })}
                          style={{ backgroundColor: c }}
                          className="h-5 w-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform" />
                      ))}
                    </div>
                  </div>

                  {/* Font Family */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Type className="h-3.5 w-3.5 text-zinc-500" />
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Font Style</p>
                    </div>
                    <div className="space-y-1">
                      {FONT_OPTIONS.map((f) => (
                        <button key={f.value} onClick={() => updateCustomization({ fontFamily: f.value })}
                          style={{ fontFamily: f.style }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                            (content.customization?.fontFamily ?? "sans") === f.value
                              ? "border-violet-400 bg-violet-50 dark:bg-violet-950/30 text-violet-700"
                              : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 text-zinc-700 dark:text-zinc-300"
                          }`}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hero Background Image */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Image className="h-3.5 w-3.5 text-zinc-500" />
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Hero Background Image</p>
                    </div>
                    <Input value={content.customization?.heroImageUrl ?? ""}
                      onChange={(e) => updateCustomization({ heroImageUrl: e.target.value || undefined })}
                      placeholder="https://images.unsplash.com/photo-…"
                      className="h-8 text-xs" />
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-violet-600 hover:text-violet-700 font-medium">
                      <Upload className="h-3.5 w-3.5" />
                      Upload from device (max 1.5MB)
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 1.5 * 1024 * 1024) { alert("Image too large — max 1.5MB"); return; }
                          const reader = new FileReader();
                          reader.onload = () => updateCustomization({ heroImageUrl: reader.result as string });
                          reader.readAsDataURL(file);
                        }} />
                    </label>
                    {content.customization?.heroImageUrl && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={content.customization.heroImageUrl} alt="Hero preview"
                          className="w-full h-20 object-cover rounded-lg border border-zinc-200" />
                        <div className="flex items-center gap-2">
                          <Switch checked={content.customization?.heroOverlay !== false}
                            onCheckedChange={(v) => updateCustomization({ heroOverlay: v })} />
                          <Label className="text-xs">Dark overlay on hero</Label>
                        </div>
                      </>
                    )}
                    <p className="text-[10px] text-zinc-400">
                      Use a direct CDN image URL ending in .jpg/.png, or upload from device.
                    </p>
                  </div>
                </div>
              )}

              {/* ── LAYOUT TAB ── */}
              {tab === "layout" && (
                <div className="space-y-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">

                  {/* Navbar Style */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Navigation className="h-3.5 w-3.5 text-zinc-500" />
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Navbar Style</p>
                    </div>
                    <div className="space-y-1">
                      {([
                        { value: "solid",       label: "Solid",       desc: "Colored background (default)" },
                        { value: "white",       label: "White",       desc: "White background, colored text" },
                        { value: "dark",        label: "Dark",        desc: "Dark background, white text" },
                        { value: "transparent", label: "Transparent", desc: "Blurred glass effect" },
                      ] as const).map(({ value, label, desc }) => (
                        <OptionCard key={value} label={label}
                          active={(content.customization?.navStyle ?? "solid") === value}
                          onClick={() => updateCustomization({ navStyle: value })}>
                          <span className="font-semibold">{label}</span>
                          <span className="text-zinc-400 font-normal ml-1">— {desc}</span>
                        </OptionCard>
                      ))}
                    </div>
                  </div>

                  {/* Hero Layout */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <LayoutTemplate className="h-3.5 w-3.5 text-zinc-500" />
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Hero Layout</p>
                    </div>
                    <div className="space-y-1">
                      {([
                        { value: "centered",   label: "Centered",   desc: "Text centered, medium height" },
                        { value: "fullscreen", label: "Fullscreen", desc: "Full-page hero, large text" },
                        { value: "split",      label: "Split",      desc: "Text left, image right" },
                        { value: "compact",    label: "Compact",    desc: "Slim banner with inline CTA" },
                      ] as const).map(({ value, label, desc }) => (
                        <OptionCard key={value} label={label}
                          active={(content.customization?.heroLayout ?? "centered") === value}
                          onClick={() => updateCustomization({ heroLayout: value })}>
                          <span className="font-semibold">{label}</span>
                          <span className="text-zinc-400 font-normal ml-1">— {desc}</span>
                        </OptionCard>
                      ))}
                    </div>
                  </div>

                  {/* Button Style */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Button Style</p>
                    <div className="flex gap-2">
                      {([
                        { value: "rounded", label: "Rounded" },
                        { value: "pill",    label: "Pill" },
                        { value: "square",  label: "Square" },
                      ] as const).map(({ value, label }) => {
                        const radius = value === "pill" ? "9999px" : value === "square" ? "0" : "8px";
                        const active = (content.customization?.buttonStyle ?? "rounded") === value;
                        return (
                          <button key={value} onClick={() => updateCustomization({ buttonStyle: value })}
                            style={{ borderRadius: radius, backgroundColor: active ? "#7c3aed" : "transparent", color: active ? "white" : undefined }}
                            className={`flex-1 py-1.5 text-xs font-semibold border transition-colors ${
                              active ? "border-violet-500" : "border-zinc-300 text-zinc-600 hover:border-zinc-400"
                            }`}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Products Layout */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Products Layout</p>
                    <div className="space-y-1">
                      {([
                        { value: "grid",       label: "Grid (4-col)",       desc: "Compact 4-column grid" },
                        { value: "grid-large", label: "Grid Large (3-col)", desc: "Bigger cards with enquire button" },
                        { value: "list",       label: "List",               desc: "Horizontal rows with image" },
                      ] as const).map(({ value, label, desc }) => (
                        <OptionCard key={value} label={label}
                          active={(content.customization?.productsLayout ?? "grid") === value}
                          onClick={() => updateCustomization({ productsLayout: value })}>
                          <span className="font-semibold">{label}</span>
                          <span className="text-zinc-400 font-normal ml-1">— {desc}</span>
                        </OptionCard>
                      ))}
                    </div>
                  </div>

                  {/* Footer Style */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">Footer Style</p>
                    <div className="space-y-1">
                      {([
                        { value: "simple",   label: "Simple",   desc: "One-line tagline" },
                        { value: "detailed", label: "Detailed", desc: "Multi-column with contact info" },
                      ] as const).map(({ value, label, desc }) => (
                        <OptionCard key={value} label={label}
                          active={(content.customization?.footerStyle ?? "simple") === value}
                          onClick={() => updateCustomization({ footerStyle: value })}>
                          <span className="font-semibold">{label}</span>
                          <span className="text-zinc-400 font-normal ml-1">— {desc}</span>
                        </OptionCard>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

          {/* Click-to-edit hint (only when no element is selected) */}
          {!selectedElement && (
            <p className="text-[10px] text-zinc-400 text-center px-2">
              💡 Click any element on the preview to edit it directly.
            </p>
          )}
        </div>

        {/* Right: live preview */}
        <div className="flex-1 min-w-0 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm">
          <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <p className="text-xs text-zinc-500 ml-1 truncate">{storefrontUrl ?? "Set a subdomain to get your URL"}</p>
            </div>
            {storefrontUrl && (
              <a href={storefrontUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1">
                Open <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <EditableStorefrontPreview
            org={{ name: org.name, logoUrl: org.logoUrl, address: org.address, phone: org.phone, websiteUrl: org.websiteUrl, theme: org.theme, currencyCode: org.currencyCode }}
            products={products.filter((p) => p.isPublic)}
            content={content}
            selectedElement={selectedElement}
            onSelectElement={setSelectedElement}
            onDeselect={() => setSelectedElement(null)}
          />
        </div>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs" />
    </div>
  );
}

function FieldTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="text-xs min-h-[60px] resize-none" />
    </div>
  );
}
