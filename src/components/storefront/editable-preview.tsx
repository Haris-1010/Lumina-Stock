"use client";

import type { StorefrontContent, StorefrontCustomization } from "@/types/storefront";
import { getFontStyle, applyElStyle } from "@/types/storefront";

export type EditablePreviewOrg = {
  name: string; logoUrl: string | null; address: string | null;
  phone: string | null; websiteUrl: string | null; theme: string | null; currencyCode: string;
};

export type EditablePreviewProduct = {
  id: string; name: string; description: string | null;
  category: string; sellingPrice: number; currentStock: number;
};

interface Props {
  org: EditablePreviewOrg;
  products: EditablePreviewProduct[];
  content: StorefrontContent;
  selectedElement: string | null;
  onSelectElement: (id: string) => void;
  onDeselect: () => void;
}

const THEME_HEX: Record<string, string> = {
  emerald: "#059669", sky: "#0284c7", violet: "#7c3aed",
  rose: "#e11d48", amber: "#d97706", zinc: "#3f3f46",
};

function getBtnRadius(style?: StorefrontCustomization["buttonStyle"]) {
  if (style === "pill") return "9999px";
  if (style === "square") return "0";
  return "10px";
}

function El({ id, selected, onSelect, children, tag: Tag = "div", className, style, title }: {
  id: string; selected: string | null; onSelect: (id: string) => void;
  children: React.ReactNode; tag?: keyof React.JSX.IntrinsicElements;
  className?: string; style?: React.CSSProperties; title?: string;
}) {
  const isSelected = selected === id;
  return (
    // @ts-ignore — dynamic tag with known props
    <Tag
      onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSelect(id); }}
      title={title ?? `Edit ${id}`}
      className={`relative cursor-pointer transition-all ${className ?? ""}`}
      style={{
        outline: isSelected ? "2px solid #7c3aed" : "2px dashed transparent",
        outlineOffset: "2px",
        ...style,
      }}
      onMouseEnter={(e: React.MouseEvent<Element>) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.outline = "2px dashed #a78bfa";
      }}
      onMouseLeave={(e: React.MouseEvent<Element>) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.outline = "2px dashed transparent";
      }}
    >
      {children}
    </Tag>
  );
}

export function EditableStorefrontPreview({ org, products, content, selectedElement, onSelectElement, onDeselect }: Props) {
  const primaryColor = content.customization?.primaryColor || THEME_HEX[org.theme ?? "emerald"] || THEME_HEX.emerald;
  const fontStyle = getFontStyle(content.customization?.fontFamily);
  const productImages = content.customization?.productImages ?? {};
  const saleProducts = content.customization?.saleProducts ?? {};
  const elStyles = content.customization?.elementStyles ?? {};
  const btnRadius = getBtnRadius(content.customization?.buttonStyle);
  const sectionOrder = content.sectionOrder ?? ["hero","products","about","features","contact","footer"];

  const navStyle = content.customization?.navStyle ?? "solid";
  const navBg = navStyle === "white" ? "#ffffff" : navStyle === "dark" ? "#18181b" : navStyle === "transparent" ? "rgba(0,0,0,0.3)" : primaryColor;
  const navText = navStyle === "white" ? primaryColor : "#ffffff";

  const icons: Record<string, string> = {
    ShieldCheck: "🛡️", Truck: "🚚", Star: "⭐", HeadphonesIcon: "🎧",
    Heart: "❤️", Zap: "⚡", Award: "🏆", Package: "📦", CheckCircle: "✅",
  };

  const p = content.products;
  const waNumber = (p.whatsappNumber ?? "").replace(/[^0-9]/g, "");

  function waUrl(name: string) {
    if (!waNumber) return null;
    const msg = (p.whatsappMessage || "Hi, I want to buy {product}. Is it available?").replace("{product}", name);
    return `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
  }

  const sel = onSelectElement;

  return (
    <div style={{ fontFamily: fontStyle }} onClick={onDeselect}>
      <div className="bg-white antialiased text-[13px]">

        {/* ── Nav ── */}
        <El id="nav" selected={selectedElement} onSelect={sel} tag="header"
          title="Click to edit navbar"
          style={{ backgroundColor: navBg, color: navText, ...applyElStyle(elStyles, "nav") }}
          className="px-4 py-2.5 flex items-center justify-between shadow-sm">
          <El id="nav.brand" selected={selectedElement} onSelect={sel}
            className="flex items-center gap-2" title="Click to edit brand name"
            style={applyElStyle(elStyles, "nav.brand")}>
            {org.logoUrl && <img src={org.logoUrl} alt="" className="h-7 w-7 rounded object-cover" />}
            <span className="font-bold text-sm" style={{ color: navText }}>{org.name}</span>
          </El>
          <nav className="flex items-center gap-4">
            {sectionOrder.filter(k => !["hero","footer"].includes(k)).map(k => (
              <span key={k} style={{ color: navText }} className="text-xs opacity-75 capitalize">{k}</span>
            ))}
          </nav>
        </El>

        {sectionOrder.map((key) => {

          /* ── Hero ── */
          if (key === "hero" && content.hero.enabled) {
            const heroImageUrl = content.customization?.heroImageUrl;
            const showOverlay = content.customization?.heroOverlay !== false;
            const layout = content.customization?.heroLayout ?? "centered";
            const heroBg = elStyles["hero.bg"]?.backgroundColor || primaryColor;
            const imgFit = elStyles["hero.bg"]?.imageFit ?? "cover";
            const imgPos = elStyles["hero.bg"]?.imagePosition ?? "center";

            const overlay = heroImageUrl && showOverlay
              ? <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", pointerEvents: "none" }} />
              : null;

            const cta = (
              <El id="hero.cta" selected={selectedElement} onSelect={sel} tag="span"
                title="Click to edit CTA button"
                style={{ display: "inline-block", borderRadius: btnRadius, padding: "6px 16px", backgroundColor: elStyles["hero.cta"]?.backgroundColor ?? "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", fontSize: "12px", color: elStyles["hero.cta"]?.color ?? "white", cursor: "pointer", ...applyElStyle(elStyles, "hero.cta") }}>
                {content.hero.ctaText}
              </El>
            );

            const heroContent = (
              <div className="space-y-2">
                <El id="hero.headline" selected={selectedElement} onSelect={sel} tag="h1"
                  title="Click to edit headline"
                  className="font-extrabold leading-tight"
                  style={{ fontSize: "20px", ...applyElStyle(elStyles, "hero.headline") }}>
                  {content.hero.headline}
                </El>
                <El id="hero.subheadline" selected={selectedElement} onSelect={sel} tag="p"
                  title="Click to edit subheadline"
                  className="text-white/80"
                  style={{ fontSize: "13px", ...applyElStyle(elStyles, "hero.subheadline") }}>
                  {content.hero.subheadline}
                </El>
                <div className="mt-3">{cta}</div>
              </div>
            );

            const bgStyle: React.CSSProperties = {
              backgroundColor: heroBg,
              backgroundImage: heroImageUrl ? `url(${heroImageUrl})` : undefined,
              backgroundSize: imgFit === "contain" ? "contain" : imgFit === "fill" ? "100% 100%" : "cover",
              backgroundPosition: imgPos,
              backgroundRepeat: "no-repeat",
              position: "relative",
            };

            if (layout === "split") {
              return (
                <El key="hero" id="hero.bg" selected={selectedElement} onSelect={sel} tag="section"
                  title="Click to edit hero background" style={{ ...bgStyle, backgroundImage: undefined, color: "white", display: "flex", minHeight: "160px" }}>
                  {overlay}
                  <div style={{ position: "relative", zIndex: 1 }} className="flex-1 px-5 py-6">{heroContent}</div>
                  {heroImageUrl && <div className="hidden sm:block w-2/5 overflow-hidden"><img src={heroImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: imgFit === "contain" ? "contain" : "cover" }} /></div>}
                </El>
              );
            }
            if (layout === "fullscreen") {
              return (
                <El key="hero" id="hero.bg" selected={selectedElement} onSelect={sel} tag="section"
                  title="Click to edit hero background" style={{ ...bgStyle, minHeight: "300px", display: "flex", alignItems: "center", color: "white" }}>
                  {overlay}
                  <div style={{ position: "relative", zIndex: 1 }} className="w-full text-center px-5 py-8">{heroContent}</div>
                </El>
              );
            }
            if (layout === "compact") {
              return (
                <El key="hero" id="hero.bg" selected={selectedElement} onSelect={sel} tag="section"
                  title="Click to edit hero background" style={{ ...bgStyle, color: "white" }} className="px-5 py-4">
                  {overlay}
                  <div style={{ position: "relative", zIndex: 1 }} className="flex items-center gap-3">{heroContent}</div>
                </El>
              );
            }
            return (
              <El key="hero" id="hero.bg" selected={selectedElement} onSelect={sel} tag="section"
                title="Click to edit hero background" style={{ ...bgStyle, color: "white" }} className="py-10 px-5">
                {overlay}
                <div style={{ position: "relative", zIndex: 1 }} className="text-center">{heroContent}</div>
              </El>
            );
          }

          /* ── Products ── */
          if (key === "products" && content.products.enabled) {
            const visible = products.slice(0, 4);
            const layout = content.customization?.productsLayout ?? "grid";
            return (
              <El key="products" id="products.config" selected={selectedElement} onSelect={sel} tag="section"
                title="Click to configure Buy Now, Cart, Sale options"
                style={{ backgroundColor: elStyles["products.bg"]?.backgroundColor }} className="py-8 px-4 bg-zinc-50">
                <div className="text-center mb-4">
                  <El id="products.title" selected={selectedElement} onSelect={sel} tag="h2"
                    title="Click to edit title" style={applyElStyle(elStyles, "products.title")} className="font-bold text-zinc-900 text-base">
                    {content.products.title}
                  </El>
                  <El id="products.subtitle" selected={selectedElement} onSelect={sel} tag="p"
                    title="Click to edit subtitle" style={applyElStyle(elStyles, "products.subtitle")} className="text-zinc-500 text-xs mt-0.5">
                    {content.products.subtitle}
                  </El>
                </div>
                {visible.length === 0 ? (
                  <p className="text-center text-zinc-400 text-xs py-4">No public products yet.</p>
                ) : layout === "list" ? (
                  <div className="space-y-2 max-w-2xl mx-auto">
                    {visible.map((prod) => (
                      <div key={prod.id} className="bg-white rounded-xl border border-zinc-200 p-3 flex gap-3 items-start">
                        <ProductImg productImages={productImages} id={prod.id} name={prod.name} elStyles={elStyles} size="sm" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-zinc-900 text-xs truncate">{prod.name}</h3>
                          <span style={{ color: primaryColor }} className="font-bold text-sm">{org.currencyCode} {prod.sellingPrice.toFixed(2)}</span>
                          <PreviewProductBtns p={p} name={prod.name} primaryColor={primaryColor} btnRadius={btnRadius} waUrl={waUrl} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : layout === "grid-large" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {visible.map((prod) => (
                      <div key={prod.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
                        <div className="relative"><ProductImg productImages={productImages} id={prod.id} name={prod.name} elStyles={elStyles} size="lg" />{(p.enableSaleBadge || saleProducts[prod.id]) && <SaleBadge />}</div>
                        <div className="p-3">
                          <h3 className="font-semibold text-zinc-900 text-xs truncate">{prod.name}</h3>
                          <span style={{ color: primaryColor }} className="font-bold text-sm mt-1 block">{org.currencyCode} {prod.sellingPrice.toFixed(2)}</span>
                          <PreviewProductBtns p={p} name={prod.name} primaryColor={primaryColor} btnRadius={btnRadius} waUrl={waUrl} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {visible.map((prod) => (
                      <div key={prod.id} className="bg-white rounded-xl border border-zinc-200 p-3 shadow-sm">
                        <div className="relative mb-2"><ProductImg productImages={productImages} id={prod.id} name={prod.name} elStyles={elStyles} size="md" />{(p.enableSaleBadge || saleProducts[prod.id]) && <SaleBadge />}</div>
                        <p className="text-[9px] text-zinc-400 uppercase mb-0.5">{prod.category}</p>
                        <h3 className="font-semibold text-zinc-900 text-[11px] truncate">{prod.name}</h3>
                        <span style={{ color: primaryColor }} className="font-bold text-xs mt-1 block">{org.currencyCode} {prod.sellingPrice.toFixed(2)}</span>
                        <PreviewProductBtns p={p} name={prod.name} primaryColor={primaryColor} btnRadius={btnRadius} waUrl={waUrl} />
                      </div>
                    ))}
                  </div>
                )}
              </El>
            );
          }

          /* ── About ── */
          if (key === "about" && content.about.enabled) return (
            <El key="about" id="about.bg" selected={selectedElement} onSelect={sel} tag="section"
              title="Click to edit background color"
              style={{ backgroundColor: elStyles["about.bg"]?.backgroundColor }} className="py-8 px-4 bg-white">
              <div className="text-center space-y-2">
                <El id="about.title" selected={selectedElement} onSelect={sel} tag="h2" title="Click to edit title"
                  style={{ color: primaryColor, ...applyElStyle(elStyles, "about.title") }} className="text-base font-bold">
                  {content.about.title}
                </El>
                <El id="about.body" selected={selectedElement} onSelect={sel} tag="p" title="Click to edit body"
                  style={applyElStyle(elStyles, "about.body")} className="text-zinc-600 text-xs leading-relaxed">
                  {content.about.body}
                </El>
              </div>
            </El>
          );

          /* ── Features ── */
          if (key === "features" && content.features.enabled) return (
            <El key="features" id="features.bg" selected={selectedElement} onSelect={sel} tag="section"
              title="Click to edit background color"
              style={{ backgroundColor: elStyles["features.bg"]?.backgroundColor }} className="py-8 px-4 bg-zinc-50">
              <El id="features.title" selected={selectedElement} onSelect={sel} tag="h2" title="Click to edit title"
                style={applyElStyle(elStyles, "features.title")} className="text-base font-bold text-zinc-900 text-center mb-4">
                {content.features.title}
              </El>
              <div className="grid grid-cols-3 gap-3">
                {content.features.highlights.map((h, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 shadow-sm text-center space-y-1 border border-zinc-100">
                    <div style={{ backgroundColor: primaryColor }} className="h-8 w-8 rounded-lg flex items-center justify-center mx-auto">{icons[h.icon] ?? "✨"}</div>
                    <h3 className="font-bold text-zinc-900 text-[11px]">{h.title}</h3>
                    <p className="text-[10px] text-zinc-500">{h.description}</p>
                  </div>
                ))}
              </div>
            </El>
          );

          /* ── Testimonials ── */
          if (key === "testimonials" && content.testimonials?.enabled) return (
            <El key="testimonials" id="testimonials.bg" selected={selectedElement} onSelect={sel} tag="section"
              title="Click to edit background color"
              style={{ backgroundColor: elStyles["testimonials.bg"]?.backgroundColor }} className="py-8 px-4 bg-white">
              <El id="testimonials.title" selected={selectedElement} onSelect={sel} tag="h2" title="Click to edit title"
                style={{ color: primaryColor, ...applyElStyle(elStyles, "testimonials.title") }} className="text-base font-bold text-center mb-4">
                {content.testimonials.title}
              </El>
              <div className="grid grid-cols-3 gap-3">
                {content.testimonials.items.map((item, i) => (
                  <div key={i} className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-2">
                    <p className="text-[10px] text-zinc-600 italic line-clamp-3">&ldquo;{item.quote}&rdquo;</p>
                    <p className="text-[10px] font-semibold text-zinc-800">{item.name}</p>
                  </div>
                ))}
              </div>
            </El>
          );

          /* ── FAQ ── */
          if (key === "faq" && content.faq?.enabled) return (
            <El key="faq" id="faq.bg" selected={selectedElement} onSelect={sel} tag="section"
              title="Click to edit background color"
              style={{ backgroundColor: elStyles["faq.bg"]?.backgroundColor }} className="py-8 px-4 bg-zinc-50">
              <El id="faq.title" selected={selectedElement} onSelect={sel} tag="h2" title="Click to edit title"
                style={applyElStyle(elStyles, "faq.title")} className="text-base font-bold text-zinc-900 text-center mb-4">
                {content.faq.title}
              </El>
              <div className="space-y-2">
                {content.faq.items.slice(0, 3).map((item, i) => (
                  <div key={i} className="bg-white rounded-xl border border-zinc-100 p-3">
                    <h3 style={{ color: primaryColor }} className="font-bold text-[11px] mb-1">{item.q}</h3>
                    <p className="text-[10px] text-zinc-600 line-clamp-2">{item.a}</p>
                  </div>
                ))}
              </div>
            </El>
          );

          /* ── Contact ── */
          if (key === "contact" && content.contact.enabled) return (
            <El key="contact" id="contact.bg" selected={selectedElement} onSelect={sel} tag="section"
              title="Click to edit background color"
              style={{ backgroundColor: elStyles["contact.bg"]?.backgroundColor }} className="py-8 px-4 bg-white">
              <div className="text-center space-y-2">
                <El id="contact.title" selected={selectedElement} onSelect={sel} tag="h2" title="Click to edit title"
                  style={applyElStyle(elStyles, "contact.title")} className="text-base font-bold text-zinc-900">
                  {content.contact.title}
                </El>
                <El id="contact.body" selected={selectedElement} onSelect={sel} tag="p" title="Click to edit body"
                  style={applyElStyle(elStyles, "contact.body")} className="text-zinc-500 text-xs">
                  {content.contact.body}
                </El>
                {content.contact.showPhone && org.phone && <p className="text-xs"><span className="mr-1">📞</span>{org.phone}</p>}
                {content.contact.showAddress && org.address && <p className="text-xs text-zinc-600"><span className="mr-1">📍</span>{org.address}</p>}
              </div>
            </El>
          );

          /* ── Footer ── */
          if (key === "footer" && content.footer.enabled) {
            const footerBg = elStyles["footer.section"]?.backgroundColor ?? primaryColor;
            return (
              <El key="footer" id="footer.section" selected={selectedElement} onSelect={sel} tag="footer"
                title="Click to edit footer style and color"
                style={{ backgroundColor: footerBg }} className="text-white py-5 px-4 text-center">
                <El id="footer.text" selected={selectedElement} onSelect={sel} tag="p" title="Click to edit tagline"
                  style={applyElStyle(elStyles, "footer.text")} className="text-xs text-white/80">
                  {content.footer.tagline}
                </El>
                {content.footer.showPoweredBy && <p className="text-[10px] text-white/50 mt-1">Powered by Lumina Stock</p>}
              </El>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

function ProductImg({ productImages, id, name, elStyles, size }: {
  productImages: Record<string, string>; id: string; name: string;
  elStyles: Record<string, import("@/types/storefront").StorefrontElementStyle>;
  size: "sm" | "md" | "lg";
}) {
  const h = size === "lg" ? "h-28" : size === "md" ? "h-20" : "h-14 w-14";
  const imgFit = elStyles["products.image"]?.imageFit ?? "cover";
  const imgPos = elStyles["products.image"]?.imagePosition ?? "center";
  return (
    <div className={`${h} bg-zinc-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 w-full`}>
      {productImages[id]
        ? <img src={productImages[id]} alt={name} style={{ width: "100%", height: "100%", objectFit: imgFit === "contain" ? "contain" : imgFit === "fill" ? "fill" : "cover", objectPosition: imgPos }} />
        : <span className="text-2xl">📦</span>}
    </div>
  );
}

function SaleBadge() {
  return <span className="absolute top-1 left-1 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full z-10">SALE</span>;
}

function PreviewProductBtns({ p, name, primaryColor, btnRadius, waUrl }: {
  p: StorefrontContent["products"]; name: string; primaryColor: string; btnRadius: string;
  waUrl: (n: string) => string | null;
}) {
  if (!p.enableBuyButton && !p.enableAddToCart) return null;
  return (
    <div className="flex gap-1 mt-2 flex-wrap">
      {p.enableBuyButton && (
        <a href={waUrl(name) ?? undefined} target="_blank" rel="noopener noreferrer"
          onClick={(e) => { e.stopPropagation(); if (!waUrl(name)) e.preventDefault(); }}
          style={{ backgroundColor: primaryColor, borderRadius: btnRadius, fontSize: "10px", padding: "4px 8px", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "3px" }}>
          📱 {p.buyButtonText || "Buy Now"}
        </a>
      )}
      {p.enableAddToCart && (
        <button onClick={(e) => e.stopPropagation()}
          style={{ borderRadius: btnRadius, fontSize: "10px", padding: "4px 8px", border: `1px solid ${primaryColor}`, color: primaryColor, background: "transparent", cursor: "pointer" }}>
          🛒 {p.cartButtonText || "Add to Cart"}
        </button>
      )}
    </div>
  );
}
