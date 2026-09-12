"use client";

import React from "react";
import { X, Bold, AlignLeft, AlignCenter, AlignRight, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  StorefrontContent, StorefrontCustomization,
  StorefrontElementStyle, StorefrontFontSize,
} from "@/types/storefront";

const ELEMENT_LABELS: Record<string, string> = {
  nav: "Navbar",
  "nav.brand": "Brand / Logo",
  "hero.bg": "Hero Background",
  "hero.headline": "Hero Headline",
  "hero.subheadline": "Hero Subheadline",
  "hero.cta": "CTA Button",
  "products.config": "Products Settings",
  "products.title": "Products Title",
  "products.subtitle": "Products Subtitle",
  "products.image": "Product Images",
  "about.bg": "About Background",
  "about.title": "About Title",
  "about.body": "About Body",
  "features.bg": "Features Background",
  "features.title": "Features Title",
  "testimonials.bg": "Testimonials Background",
  "testimonials.title": "Testimonials Title",
  "faq.bg": "FAQ Background",
  "faq.title": "FAQ Title",
  "contact.bg": "Contact Background",
  "contact.title": "Contact Title",
  "contact.body": "Contact Body",
  "footer.section": "Footer Background",
  "footer.text": "Footer Text",
};

const COLOR_PALETTE = [
  "#000000","#18181b","#27272a","#3f3f46","#52525b","#71717a","#a1a1aa","#d4d4d8","#e4e4e7","#f4f4f5","#fafafa","#ffffff",
  "#fecaca","#fca5a5","#f87171","#ef4444","#dc2626","#b91c1c",
  "#fed7aa","#fdba74","#fb923c","#f97316","#ea580c","#c2410c",
  "#fef08a","#fde047","#facc15","#eab308","#ca8a04","#a16207",
  "#bbf7d0","#86efac","#4ade80","#22c55e","#16a34a","#15803d",
  "#a5f3fc","#67e8f9","#22d3ee","#06b6d4","#0891b2","#0e7490",
  "#bfdbfe","#93c5fd","#60a5fa","#3b82f6","#2563eb","#1d4ed8",
  "#ddd6fe","#c4b5fd","#a78bfa","#8b5cf6","#7c3aed","#6d28d9",
  "#fbcfe8","#f9a8d4","#f472b6","#ec4899","#db2777","#be185d",
];

interface Props {
  elementId: string;
  content: StorefrontContent;
  products: Array<{ id: string; name: string; isPublic: boolean }>;
  onClose: () => void;
  updateSection: <K extends keyof StorefrontContent>(key: K, patch: Partial<StorefrontContent[K]>) => void;
  updateCustomization: (patch: Partial<StorefrontCustomization>) => void;
  updateElementStyle: (key: string, patch: Partial<StorefrontElementStyle>) => void;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ElementEditorPanel({
  elementId, content, products, onClose,
  updateSection, updateCustomization, updateElementStyle,
}: Props) {
  const elStyles = content.customization?.elementStyles ?? {};
  const es: StorefrontElementStyle = elStyles[elementId] ?? {};
  const setEs = (patch: Partial<StorefrontElementStyle>) => updateElementStyle(elementId, patch);
  const label = ELEMENT_LABELS[elementId] ?? elementId;

  return (
    <div className="bg-white dark:bg-zinc-950 border border-violet-200 dark:border-violet-800 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-3 py-2.5 bg-violet-50 dark:bg-violet-950/40 border-b border-violet-100 dark:border-violet-800">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-violet-500 flex-shrink-0" />
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 truncate">{label}</p>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex-shrink-0 ml-2">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3 space-y-3 max-h-[65vh] overflow-y-auto">
        <Controls
          elementId={elementId} content={content} products={products}
          es={es} setEs={setEs}
          updateSection={updateSection}
          updateCustomization={updateCustomization}
        />
      </div>
    </div>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

function Controls({ elementId, content, products, es, setEs, updateSection, updateCustomization }: {
  elementId: string;
  content: StorefrontContent;
  products: Array<{ id: string; name: string; isPublic: boolean }>;
  es: StorefrontElementStyle;
  setEs: (p: Partial<StorefrontElementStyle>) => void;
  updateSection: <K extends keyof StorefrontContent>(key: K, patch: Partial<StorefrontContent[K]>) => void;
  updateCustomization: (patch: Partial<StorefrontCustomization>) => void;
}) {
  // ── Navbar ─────────────────────────────────────────────────────────────────
  if (elementId === "nav") return (
    <>
      <ColorPicker label="Background Color" value={es.backgroundColor} onChange={(v) => setEs({ backgroundColor: v })} />
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500">Navbar Style</Label>
        <div className="grid grid-cols-2 gap-1">
          {(["solid","white","dark","transparent"] as const).map((style) => (
            <button key={style} onClick={() => updateCustomization({ navStyle: style })}
              className={`px-2 py-1.5 rounded-lg border text-xs capitalize font-medium transition-colors ${
                (content.customization?.navStyle ?? "solid") === style
                  ? "border-violet-400 bg-violet-50 text-violet-700"
                  : "border-zinc-200 hover:border-zinc-300 text-zinc-600"
              }`}>
              {style}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  if (elementId === "nav.brand") return (
    <div className="space-y-2">
      <p className="text-[10px] text-zinc-500 bg-zinc-50 rounded-lg p-2.5 border border-zinc-100">
        Brand name and logo are configured in <strong>Settings → Branding</strong>.
      </p>
      <ColorPicker label="Text Color" value={es.color} onChange={(v) => setEs({ color: v })} />
    </div>
  );

  // ── Hero Background ────────────────────────────────────────────────────────
  if (elementId === "hero.bg") return (
    <>
      <ColorPicker label="Background Color" value={es.backgroundColor} onChange={(v) => setEs({ backgroundColor: v })} />
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500">Background Image</Label>
        <Input
          value={content.customization?.heroImageUrl ?? ""}
          onChange={(e) => updateCustomization({ heroImageUrl: e.target.value || undefined })}
          placeholder="https://…image.jpg"
          className="h-7 text-xs"
        />
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-violet-600 hover:text-violet-700 font-medium">
          <Upload className="h-3.5 w-3.5" />
          Upload from device (max 1.5MB)
          <input type="file" accept="image/*" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 1.5 * 1024 * 1024) { alert("Image too large — max 1.5MB"); return; }
              const b64 = await fileToBase64(file);
              updateCustomization({ heroImageUrl: b64 });
            }} />
        </label>
        {content.customization?.heroImageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content.customization.heroImageUrl} alt="" className="w-full h-16 object-cover rounded border border-zinc-200" />
            <div className="flex items-center gap-2">
              <Switch
                checked={content.customization?.heroOverlay !== false}
                onCheckedChange={(v) => updateCustomization({ heroOverlay: v })}
              />
              <Label className="text-xs">Dark overlay on image</Label>
            </div>
            <ImageFitControls
              fit={es.imageFit ?? "cover"}
              position={es.imagePosition ?? "center"}
              onFit={(v) => setEs({ imageFit: v })}
              onPosition={(v) => setEs({ imagePosition: v })}
            />
            <button onClick={() => updateCustomization({ heroImageUrl: undefined })}
              className="text-xs text-red-500 hover:text-red-600">
              Remove image
            </button>
          </>
        )}
      </div>
    </>
  );

  // ── Hero CTA button ────────────────────────────────────────────────────────
  if (elementId === "hero.cta") return (
    <>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500">Button Text</Label>
        <Input value={content.hero.ctaText} onChange={(e) => updateSection("hero", { ctaText: e.target.value })} className="h-7 text-xs" />
      </div>
      <AlignRow value={es.textAlign} onChange={(v) => setEs({ textAlign: v })} />
      <ColorPicker label="Button Color" value={es.backgroundColor} onChange={(v) => setEs({ backgroundColor: v })} />
      <ColorPicker label="Text Color" value={es.color} onChange={(v) => setEs({ color: v })} />
    </>
  );

  // ── Products config ────────────────────────────────────────────────────────
  if (elementId === "products.config") return (
    <>
      <ColorPicker label="Section Background" value={es.backgroundColor} onChange={(v) => setEs({ backgroundColor: v })} />
      <div className="space-y-2.5 pt-1">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Buy Now Button</p>
        <div className="flex items-center gap-2">
          <Switch checked={!!content.products.enableBuyButton} onCheckedChange={(v) => updateSection("products", { enableBuyButton: v })} />
          <Label className="text-xs">Enable Buy Now button</Label>
        </div>
        {content.products.enableBuyButton && (
          <div className="pl-2 space-y-2 border-l-2 border-violet-100">
            <InlineInput label="Button Text" value={content.products.buyButtonText ?? "Buy Now"} onChange={(v) => updateSection("products", { buyButtonText: v })} />
            <InlineInput label="WhatsApp Number" value={content.products.whatsappNumber ?? ""} onChange={(v) => updateSection("products", { whatsappNumber: v })} placeholder="+923001234567" />
            <div className="space-y-1">
              <Label className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Message Template</Label>
              <Textarea
                value={content.products.whatsappMessage ?? ""}
                onChange={(e) => updateSection("products", { whatsappMessage: e.target.value })}
                placeholder="Hi, I want to buy {product}. Is it available?"
                className="text-xs min-h-[56px] resize-none"
              />
              <p className="text-[9px] text-zinc-400">Use <code>{"{product}"}</code> as placeholder for product name.</p>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2 pt-1">
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Add to Cart</p>
        <div className="flex items-center gap-2">
          <Switch checked={!!content.products.enableAddToCart} onCheckedChange={(v) => updateSection("products", { enableAddToCart: v })} />
          <Label className="text-xs">Enable Add to Cart button</Label>
        </div>
        {content.products.enableAddToCart && (
          <div className="pl-2 border-l-2 border-violet-100">
            <InlineInput label="Button Text" value={content.products.cartButtonText ?? "Add to Cart"} onChange={(v) => updateSection("products", { cartButtonText: v })} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Switch checked={!!content.products.enableSaleBadge} onCheckedChange={(v) => updateSection("products", { enableSaleBadge: v })} />
        <Label className="text-xs">Show SALE badge on all products</Label>
      </div>
    </>
  );

  // ── Product Images ─────────────────────────────────────────────────────────
  if (elementId === "products.image") return (
    <ImageFitControls
      fit={es.imageFit ?? "cover"}
      position={es.imagePosition ?? "center"}
      onFit={(v) => setEs({ imageFit: v })}
      onPosition={(v) => setEs({ imagePosition: v })}
    />
  );

  // ── Section background-only ────────────────────────────────────────────────
  if (["about.bg","features.bg","testimonials.bg","faq.bg","contact.bg","footer.section","products.bg"].includes(elementId)) return (
    <ColorPicker label="Background Color" value={es.backgroundColor} onChange={(v) => setEs({ backgroundColor: v })} />
  );

  // ── Text elements ──────────────────────────────────────────────────────────
  const TEXT_MAP: Record<string, { section: keyof StorefrontContent; field: string; isArea?: boolean }> = {
    "hero.headline":      { section: "hero",         field: "headline" },
    "hero.subheadline":   { section: "hero",         field: "subheadline", isArea: true },
    "products.title":     { section: "products",     field: "title" },
    "products.subtitle":  { section: "products",     field: "subtitle", isArea: true },
    "about.title":        { section: "about",        field: "title" },
    "about.body":         { section: "about",        field: "body", isArea: true },
    "features.title":     { section: "features",     field: "title" },
    "testimonials.title": { section: "testimonials", field: "title" },
    "faq.title":          { section: "faq",          field: "title" },
    "contact.title":      { section: "contact",      field: "title" },
    "contact.body":       { section: "contact",      field: "body", isArea: true },
    "footer.text":        { section: "footer",       field: "tagline" },
  };

  const tm = TEXT_MAP[elementId];
  if (tm) {
    const sectionData = content[tm.section] as Record<string, string> | undefined;
    const val = (sectionData as Record<string, string> | undefined)?.[tm.field] ?? "";
    return (
      <>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500">Text Content</Label>
          {tm.isArea
            ? <Textarea value={val}
                onChange={(e) => updateSection(tm.section, { [tm.field]: e.target.value } as never)}
                className="text-xs min-h-[60px] resize-none" />
            : <Input value={val}
                onChange={(e) => updateSection(tm.section, { [tm.field]: e.target.value } as never)}
                className="h-7 text-xs" />
          }
        </div>
        <TextStyleControls es={es} setEs={setEs} />
        <ColorPicker label="Text Color" value={es.color} onChange={(v) => setEs({ color: v })} />
        <ColorPicker label="Background Color" value={es.backgroundColor} onChange={(v) => setEs({ backgroundColor: v })} />
      </>
    );
  }

  return (
    <p className="text-xs text-zinc-400 text-center py-4">
      Click any element on the preview to edit it.
    </p>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function TextStyleControls({ es, setEs }: {
  es: StorefrontElementStyle;
  setEs: (p: Partial<StorefrontElementStyle>) => void;
}) {
  const SIZES: { value: StorefrontFontSize; label: string }[] = [
    { value: "xs", label: "XS" }, { value: "sm", label: "SM" }, { value: "base", label: "MD" },
    { value: "lg", label: "LG" }, { value: "xl", label: "XL" }, { value: "2xl", label: "2XL" },
    { value: "3xl", label: "3XL" }, { value: "4xl", label: "4XL" }, { value: "5xl", label: "5XL" },
  ];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <button onClick={() => setEs({ fontWeight: es.fontWeight === "bold" ? "normal" : "bold" })}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-bold transition-colors ${
            es.fontWeight === "bold"
              ? "border-violet-400 bg-violet-50 text-violet-700"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
          }`}>
          <Bold className="h-3 w-3" /> Bold
        </button>
        <AlignRow value={es.textAlign} onChange={(v) => setEs({ textAlign: v })} />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500">Font Size</Label>
        <div className="flex flex-wrap gap-1">
          {SIZES.map(({ value, label }) => (
            <button key={value} onClick={() => setEs({ fontSize: value })}
              className={`px-1.5 py-0.5 rounded border text-[10px] font-mono transition-colors ${
                es.fontSize === value
                  ? "border-violet-400 bg-violet-50 text-violet-700"
                  : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlignRow({ value, onChange }: {
  value?: "left" | "center" | "right";
  onChange: (v: "left" | "center" | "right") => void;
}) {
  const options = [
    { v: "left" as const, Icon: AlignLeft },
    { v: "center" as const, Icon: AlignCenter },
    { v: "right" as const, Icon: AlignRight },
  ];
  return (
    <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      {options.map(({ v, Icon }) => (
        <button key={v} onClick={() => onChange(v)}
          className={`flex-1 flex items-center justify-center py-1 transition-colors ${
            value === v
              ? "bg-violet-50 text-violet-600 dark:bg-violet-950/40"
              : "text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          }`}>
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function ImageFitControls({ fit, position, onFit, onPosition }: {
  fit: string; position: string;
  onFit: (v: "cover" | "contain" | "fill" | "none") => void;
  onPosition: (v: "center" | "top" | "bottom" | "left" | "right") => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500">Image Fit</Label>
        <div className="grid grid-cols-3 gap-1">
          {(["cover","contain","fill"] as const).map((v) => (
            <button key={v} onClick={() => onFit(v)}
              className={`py-1.5 rounded-lg border text-xs capitalize font-medium transition-colors ${
                fit === v ? "border-violet-400 bg-violet-50 text-violet-700" : "border-zinc-200 hover:border-zinc-300 text-zinc-600"
              }`}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500">Image Position</Label>
        <div className="grid grid-cols-3 gap-1">
          {(["center","top","bottom","left","right"] as const).map((v) => (
            <button key={v} onClick={() => onPosition(v)}
              className={`py-1.5 rounded-lg border text-xs capitalize font-medium transition-colors ${
                position === v ? "border-violet-400 bg-violet-50 text-violet-700" : "border-zinc-200 hover:border-zinc-300 text-zinc-600"
              }`}>
              {v}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function ColorPicker({ label, value, onChange }: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500">{label}</Label>
      <div className="grid grid-cols-12 gap-0.5">
        {COLOR_PALETTE.map((c) => (
          <button key={c} onClick={() => onChange(c)}
            style={{
              backgroundColor: c,
              outline: value === c ? "2px solid #7c3aed" : "2px solid transparent",
              outlineOffset: "1px",
            }}
            className="h-4 w-4 rounded-sm border border-zinc-100 hover:scale-125 transition-transform" />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input type="color" value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 rounded border border-zinc-200 cursor-pointer p-0.5 flex-shrink-0" />
        <Input value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="Hex color"
          className="h-7 text-xs font-mono flex-1" />
        {value && (
          <button onClick={() => onChange(undefined)} className="text-zinc-400 hover:text-zinc-600 text-xs flex-shrink-0">✕</button>
        )}
      </div>
    </div>
  );
}

function InlineInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide font-semibold text-zinc-500">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-7 text-xs" />
    </div>
  );
}
