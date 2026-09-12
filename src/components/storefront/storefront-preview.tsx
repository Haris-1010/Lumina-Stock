"use client";

import type { StorefrontContent, StorefrontCustomization } from "@/types/storefront";
import { getFontStyle } from "@/types/storefront";

type OrgPreviewData = {
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  websiteUrl: string | null;
  theme: string | null;
  currencyCode: string;
};

type ProductPreviewData = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  sellingPrice: number;
  currentStock: number;
};

interface Props {
  org: OrgPreviewData;
  products: ProductPreviewData[];
  content: StorefrontContent;
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

function getNavBg(style: StorefrontCustomization["navStyle"], primary: string) {
  if (style === "white") return "#ffffff";
  if (style === "dark") return "#18181b";
  if (style === "transparent") return "rgba(0,0,0,0.25)";
  return primary;
}

function getNavText(style: StorefrontCustomization["navStyle"], primary: string) {
  if (style === "white") return primary;
  return "#ffffff";
}

export function StorefrontPreview({ org, products, content }: Props) {
  const theme = org.theme ?? "emerald";
  const primaryColor = content.customization?.primaryColor || THEME_HEX[theme] || THEME_HEX.emerald;
  const fontStyle = getFontStyle(content.customization?.fontFamily);
  const productImages = content.customization?.productImages ?? {};
  const sectionOrder = content.sectionOrder ?? ["hero", "products", "about", "features", "contact", "footer"];
  const navStyle = content.customization?.navStyle;
  const navBg = getNavBg(navStyle, primaryColor);
  const navText = getNavText(navStyle, primaryColor);
  const btnRadius = getBtnRadius(content.customization?.buttonStyle);

  const icons: Record<string, string> = {
    ShieldCheck: "🛡️", Truck: "🚚", Star: "⭐", HeadphonesIcon: "🎧",
    Heart: "❤️", Zap: "⚡", Award: "🏆", Package: "📦", CheckCircle: "✅",
  };

  return (
    <div style={{ fontFamily: fontStyle }} className="bg-white antialiased text-[13px]">
      {/* Nav */}
      <header style={{ backgroundColor: navBg, color: navText }}
        className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {org.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} className="h-6 w-6 rounded object-cover" />
          )}
          <span className="font-bold text-sm" style={{ color: navText }}>{org.name}</span>
        </div>
        <span className="text-xs opacity-70" style={{ color: navText }}>Products · About · Contact</span>
      </header>

      {sectionOrder.map((key) => {
        // ── Hero ──
        if (key === "hero" && content.hero.enabled) {
          const heroImageUrl = content.customization?.heroImageUrl;
          const showOverlay = content.customization?.heroOverlay !== false;
          const layout = content.customization?.heroLayout ?? "centered";

          const baseStyle: React.CSSProperties = {
            backgroundColor: primaryColor,
            backgroundImage: heroImageUrl ? `url(${heroImageUrl})` : undefined,
            backgroundSize: "cover", backgroundPosition: "center",
            position: "relative",
          };

          if (layout === "fullscreen") {
            return (
              <section key="hero" style={{ ...baseStyle, minHeight: "300px", display: "flex", alignItems: "center" }} className="text-white px-5">
                {heroImageUrl && showOverlay && <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />}
                <div style={{ position: "relative", zIndex: 1 }} className="w-full text-center space-y-2 py-8">
                  <h1 className="text-2xl font-extrabold">{content.hero.headline}</h1>
                  <p className="text-sm text-white/80">{content.hero.subheadline}</p>
                  <span style={{ borderRadius: btnRadius, display: "inline-block", padding: "6px 16px", backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", fontSize: "12px", color: "white" }}>
                    {content.hero.ctaText}
                  </span>
                </div>
              </section>
            );
          }

          if (layout === "split") {
            return (
              <section key="hero" style={{ ...baseStyle, backgroundImage: undefined }} className="text-white">
                <div style={{ display: "flex", minHeight: "160px" }}>
                  <div className="flex-1 px-5 py-6 space-y-2">
                    <h1 className="text-lg font-extrabold leading-tight">{content.hero.headline}</h1>
                    <p className="text-xs text-white/80">{content.hero.subheadline}</p>
                    <span style={{ borderRadius: btnRadius, display: "inline-block", padding: "4px 12px", backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", fontSize: "11px", color: "white" }}>
                      {content.hero.ctaText}
                    </span>
                  </div>
                  {heroImageUrl ? (
                    <div className="w-2/5 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div style={{ backgroundColor: "rgba(255,255,255,0.1)", width: "40%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px" }}>🛍️</div>
                  )}
                </div>
              </section>
            );
          }

          if (layout === "compact") {
            return (
              <section key="hero" style={baseStyle} className="text-white py-4 px-5">
                {heroImageUrl && showOverlay && <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />}
                <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="flex-1 space-y-1">
                    <h1 className="text-base font-bold">{content.hero.headline}</h1>
                    <p className="text-xs text-white/80">{content.hero.subheadline}</p>
                  </div>
                  <span style={{ borderRadius: btnRadius, padding: "5px 12px", backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", fontSize: "11px", color: "white", whiteSpace: "nowrap" }}>
                    {content.hero.ctaText}
                  </span>
                </div>
              </section>
            );
          }

          // Default: centered
          return (
            <section key="hero" style={baseStyle} className="text-white py-10 px-5">
              {heroImageUrl && showOverlay && <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />}
              <div style={{ position: "relative", zIndex: 1 }} className="text-center space-y-2">
                <h1 className="text-xl font-extrabold">{content.hero.headline}</h1>
                <p className="text-sm text-white/80">{content.hero.subheadline}</p>
                <span style={{ borderRadius: btnRadius, display: "inline-block", padding: "6px 16px", backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", fontSize: "12px", color: "white" }}>
                  {content.hero.ctaText}
                </span>
              </div>
            </section>
          );
        }

        // ── Products ──
        if (key === "products" && content.products.enabled) {
          const visible = products.slice(0, 4);
          const layout = content.customization?.productsLayout;
          return (
            <section key="products" className="py-8 px-4 bg-zinc-50">
              <div className="text-center mb-4">
                <h2 className="text-base font-bold text-zinc-900">{content.products.title}</h2>
                <p className="text-zinc-500 text-xs mt-0.5">{content.products.subtitle}</p>
              </div>
              {visible.length === 0 ? (
                <p className="text-center text-zinc-400 text-xs py-4">No public products yet.</p>
              ) : layout === "list" ? (
                <div className="space-y-2 max-w-2xl mx-auto">
                  {visible.map((p) => (
                    <div key={p.id} className="bg-white rounded-xl border border-zinc-200 p-3 flex gap-3">
                      <div className="h-14 w-14 bg-zinc-100 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {productImages[p.id] ? <img src={productImages[p.id]} alt={p.name} className="h-full w-full object-cover" /> : <span className="text-xl">📦</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-zinc-900 text-xs truncate">{p.name}</h3>
                        <span style={{ color: primaryColor }} className="font-bold text-sm">{org.currencyCode} {p.sellingPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : layout === "grid-large" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {visible.map((p) => (
                    <div key={p.id} className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
                      <div className="h-28 bg-zinc-100 overflow-hidden flex items-center justify-center">
                        {productImages[p.id] ? <img src={productImages[p.id]} alt={p.name} className="h-full w-full object-cover" /> : <span className="text-3xl">📦</span>}
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-zinc-900 text-xs truncate">{p.name}</h3>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span style={{ color: primaryColor }} className="font-bold text-sm">{org.currencyCode} {p.sellingPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {visible.map((p) => (
                    <div key={p.id} className="bg-white rounded-xl border border-zinc-200 p-3 shadow-sm">
                      <div className="h-20 bg-zinc-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                        {productImages[p.id] ? <img src={productImages[p.id]} alt={p.name} className="h-full w-full object-cover" /> : <span className="text-2xl">📦</span>}
                      </div>
                      <p className="text-[9px] text-zinc-400 uppercase mb-0.5">{p.category}</p>
                      <h3 className="font-semibold text-zinc-900 text-[11px] leading-snug truncate">{p.name}</h3>
                      <span style={{ color: primaryColor }} className="font-bold text-xs mt-1 block">{org.currencyCode} {p.sellingPrice.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        }

        // ── About ──
        if (key === "about" && content.about.enabled) {
          return (
            <section key="about" className="py-8 px-4 bg-white">
              <div className="text-center space-y-2">
                <h2 style={{ color: primaryColor }} className="text-base font-bold">{content.about.title}</h2>
                <p className="text-zinc-600 text-xs leading-relaxed">{content.about.body}</p>
              </div>
            </section>
          );
        }

        // ── Features ──
        if (key === "features" && content.features.enabled) {
          return (
            <section key="features" className="py-8 px-4 bg-zinc-50">
              <h2 className="text-base font-bold text-zinc-900 text-center mb-4">{content.features.title}</h2>
              <div className="grid grid-cols-3 gap-3">
                {content.features.highlights.map((h, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 shadow-sm text-center space-y-1 border border-zinc-100">
                    <div style={{ backgroundColor: primaryColor }} className="h-8 w-8 rounded-lg flex items-center justify-center mx-auto text-base">
                      {icons[h.icon] ?? "✨"}
                    </div>
                    <h3 className="font-bold text-zinc-900 text-[11px]">{h.title}</h3>
                    <p className="text-[10px] text-zinc-500">{h.description}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // ── Testimonials ──
        if (key === "testimonials" && content.testimonials?.enabled) {
          return (
            <section key="testimonials" className="py-8 px-4 bg-white">
              <h2 style={{ color: primaryColor }} className="text-base font-bold text-center mb-4">{content.testimonials.title}</h2>
              <div className="grid grid-cols-3 gap-3">
                {content.testimonials.items.map((item, i) => (
                  <div key={i} className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-2">
                    <p className="text-[10px] text-zinc-600 italic leading-relaxed line-clamp-3">&ldquo;{item.quote}&rdquo;</p>
                    <p className="text-[10px] font-semibold text-zinc-800">{item.name}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // ── FAQ ──
        if (key === "faq" && content.faq?.enabled) {
          return (
            <section key="faq" className="py-8 px-4 bg-zinc-50">
              <h2 className="text-base font-bold text-zinc-900 text-center mb-4">{content.faq.title}</h2>
              <div className="space-y-2">
                {content.faq.items.slice(0, 3).map((item, i) => (
                  <div key={i} className="bg-white rounded-xl border border-zinc-100 p-3">
                    <h3 style={{ color: primaryColor }} className="font-bold text-[11px] mb-1">{item.q}</h3>
                    <p className="text-[10px] text-zinc-600 leading-relaxed line-clamp-2">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // ── Contact ──
        if (key === "contact" && content.contact.enabled) {
          return (
            <section key="contact" className="py-8 px-4 bg-white">
              <div className="text-center space-y-2">
                <h2 className="text-base font-bold text-zinc-900">{content.contact.title}</h2>
                <p className="text-zinc-500 text-xs">{content.contact.body}</p>
                {content.contact.showPhone && org.phone && (
                  <p className="text-xs"><span className="mr-1">📞</span>{org.phone}</p>
                )}
                {content.contact.showAddress && org.address && (
                  <p className="text-xs text-zinc-600"><span className="mr-1">📍</span>{org.address}</p>
                )}
              </div>
            </section>
          );
        }

        // ── Footer ──
        if (key === "footer" && content.footer.enabled) {
          const footerStyle = content.customization?.footerStyle;
          if (footerStyle === "detailed") {
            return (
              <footer key="footer" style={{ backgroundColor: primaryColor }} className="text-white py-6 px-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-bold text-sm">{org.name}</p>
                    <p className="text-[10px] text-white/60 mt-0.5">{content.footer.tagline}</p>
                  </div>
                  <div>
                    {org.phone && <p className="text-[10px] text-white/70">📞 {org.phone}</p>}
                    {org.address && <p className="text-[10px] text-white/70">📍 {org.address}</p>}
                  </div>
                </div>
              </footer>
            );
          }
          return (
            <footer key="footer" style={{ backgroundColor: primaryColor }} className="text-white py-5 px-4 text-center">
              <p className="text-xs text-white/80">{content.footer.tagline || `© ${new Date().getFullYear()} ${org.name}`}</p>
              {content.footer.showPoweredBy && (
                <p className="text-[10px] text-white/50 mt-1">Powered by Lumina Stock</p>
              )}
            </footer>
          );
        }

        return null;
      })}
    </div>
  );
}
