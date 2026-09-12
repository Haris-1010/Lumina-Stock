import type { StorefrontContent, StorefrontCustomization } from "@/types/storefront";
import { getFontStyle, applyElStyle } from "@/types/storefront";

type OrgData = {
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  websiteUrl: string | null;
  theme: string | null;
  currencyCode: string;
};

type ProductData = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  sellingPrice: number;
  currentStock: number;
};

interface Props {
  org: OrgData;
  products: ProductData[];
  content: StorefrontContent;
}

const THEME_HEX: Record<string, string> = {
  emerald: "#059669", sky: "#0284c7", violet: "#7c3aed",
  rose: "#e11d48", amber: "#d97706", zinc: "#3f3f46",
};

function getBtnRadius(style?: StorefrontCustomization["buttonStyle"]) {
  if (style === "pill") return "9999px";
  if (style === "square") return "0";
  return "12px";
}

function getNavStyles(style: StorefrontCustomization["navStyle"], primaryColor: string) {
  switch (style) {
    case "white":       return { bg: "#ffffff", text: primaryColor, border: "1px solid #e4e4e7" };
    case "dark":        return { bg: "#18181b", text: "#ffffff",     border: "none" };
    case "transparent": return { bg: "rgba(0,0,0,0.25)", text: "#ffffff", border: "none", backdropFilter: "blur(8px)" };
    default:            return { bg: primaryColor, text: "#ffffff",  border: "none" };
  }
}

const NAV_SECTION_ANCHORS: Record<string, { href: string; label: string }> = {
  products:     { href: "#products",     label: "Products" },
  about:        { href: "#about",        label: "About" },
  features:     { href: "#features",     label: "Features" },
  testimonials: { href: "#testimonials", label: "Reviews" },
  faq:          { href: "#faq",          label: "FAQ" },
  contact:      { href: "#contact",      label: "Contact" },
};

export function StorefrontRenderer({ org, products, content }: Props) {
  const theme = org.theme ?? "emerald";
  const primaryColor = content.customization?.primaryColor || THEME_HEX[theme] || THEME_HEX.emerald;
  const fontStyle = getFontStyle(content.customization?.fontFamily);
  const productImages = content.customization?.productImages ?? {};
  const buttonStyle = content.customization?.buttonStyle;
  const sectionOrder = content.sectionOrder ?? ["hero", "products", "about", "features", "contact", "footer"];
  const navStyles = getNavStyles(content.customization?.navStyle, primaryColor);
  const btnRadius = getBtnRadius(buttonStyle);

  const enabledNavLinks = sectionOrder
    .filter((key) => {
      if (key === "hero" || key === "footer") return false;
      const s = content[key as keyof StorefrontContent] as { enabled?: boolean } | undefined;
      return s && "enabled" in s && s.enabled;
    })
    .map((key) => NAV_SECTION_ANCHORS[key])
    .filter(Boolean);

  const sectionMap: Record<string, React.ReactNode> = {
    hero: content.hero.enabled ? (
      <HeroSection key="hero" org={org} section={content.hero} primaryColor={primaryColor}
        customization={content.customization} btnRadius={btnRadius} />
    ) : null,
    products: content.products.enabled ? (
      <ProductsSection key="products" section={content.products} products={products}
        primaryColor={primaryColor} currencyCode={org.currencyCode}
        productImages={productImages} layout={content.customization?.productsLayout} btnRadius={btnRadius}
        saleProducts={content.customization?.saleProducts ?? {}}
        elStyles={content.customization?.elementStyles ?? {}} />
    ) : null,
    about: content.about.enabled ? (
      <AboutSection key="about" section={content.about} primaryColor={primaryColor} />
    ) : null,
    features: content.features.enabled ? (
      <FeaturesSection key="features" section={content.features} primaryColor={primaryColor} />
    ) : null,
    testimonials: content.testimonials?.enabled ? (
      <TestimonialsSection key="testimonials" section={content.testimonials} primaryColor={primaryColor} />
    ) : null,
    faq: content.faq?.enabled ? (
      <FaqSection key="faq" section={content.faq} primaryColor={primaryColor} />
    ) : null,
    contact: content.contact.enabled ? (
      <ContactSection key="contact" section={content.contact} org={org} primaryColor={primaryColor} />
    ) : null,
    footer: content.footer.enabled ? (
      <FooterSection key="footer" section={content.footer} org={org} primaryColor={primaryColor}
        style={content.customization?.footerStyle} />
    ) : null,
  };

  return (
    <div style={{ fontFamily: fontStyle }} className="min-h-screen bg-white antialiased">
      {/* ── Navbar ── */}
      <header style={{ backgroundColor: navStyles.bg, color: navStyles.text, border: navStyles.border, backdropFilter: (navStyles as { backdropFilter?: string }).backdropFilter }}
        className="px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {org.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} className="h-8 w-8 rounded-lg object-cover" />
          )}
          <span className="font-bold text-lg" style={{ color: navStyles.text }}>{org.name}</span>
        </div>
        {enabledNavLinks.length > 0 && (
          <nav className="hidden sm:flex items-center gap-5">
            {enabledNavLinks.map((link) => (
              <a key={link.href} href={link.href}
                style={{ color: navStyles.text }}
                className="text-sm opacity-80 hover:opacity-100 transition-opacity">
                {link.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {sectionOrder.map((key) => sectionMap[key] ?? null)}
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ org, section, primaryColor, customization, btnRadius }: {
  org: OrgData;
  section: StorefrontContent["hero"];
  primaryColor: string;
  customization?: StorefrontContent["customization"];
  btnRadius: string;
}) {
  const heroImageUrl = customization?.heroImageUrl;
  const showOverlay = customization?.heroOverlay !== false;
  const layout = customization?.heroLayout ?? "centered";

  const baseStyle: React.CSSProperties = {
    backgroundColor: primaryColor,
    backgroundImage: heroImageUrl ? `url(${heroImageUrl})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    position: "relative",
  };

  const ctaBtn = (
    <a href="#products"
      style={{ borderRadius: btnRadius, display: "inline-block", marginTop: "8px" }}
      className="bg-white/20 hover:bg-white/30 text-white font-semibold px-8 py-3 transition-colors backdrop-blur-sm border border-white/30">
      {section.ctaText}
    </a>
  );

  const overlay = heroImageUrl && showOverlay ? (
    <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)" }} />
  ) : null;

  if (layout === "fullscreen") {
    return (
      <section style={{ ...baseStyle, minHeight: "100vh", display: "flex", alignItems: "center" }} className="text-white px-6">
        {overlay}
        <div style={{ position: "relative", zIndex: 1 }} className="max-w-4xl mx-auto w-full text-center space-y-6">
          {org.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} className="h-24 w-24 rounded-2xl object-cover mx-auto shadow-xl" />
          )}
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-none">{section.headline}</h1>
          <p className="text-xl sm:text-2xl text-white/80 max-w-2xl mx-auto">{section.subheadline}</p>
          {ctaBtn}
        </div>
      </section>
    );
  }

  if (layout === "split") {
    return (
      <section style={{ ...baseStyle, backgroundImage: undefined }} className="text-white">
        {overlay}
        <div style={{ position: "relative", zIndex: 1, display: "flex", minHeight: "420px" }}>
          <div className="flex-1 flex flex-col justify-center px-10 py-16 space-y-5">
            {org.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt={org.name} className="h-14 w-14 rounded-xl object-cover shadow-lg" />
            )}
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">{section.headline}</h1>
            <p className="text-lg text-white/80 max-w-md">{section.subheadline}</p>
            {ctaBtn}
          </div>
          {heroImageUrl && (
            <div className="hidden md:block w-1/2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          {!heroImageUrl && (
            <div style={{ backgroundColor: "rgba(255,255,255,0.1)" }} className="hidden md:flex w-1/2 items-center justify-center text-8xl">
              🛍️
            </div>
          )}
        </div>
      </section>
    );
  }

  if (layout === "compact") {
    return (
      <section style={baseStyle} className="text-white py-10 px-6">
        {overlay}
        <div style={{ position: "relative", zIndex: 1 }} className="max-w-3xl mx-auto flex items-center gap-6">
          {org.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logoUrl} alt={org.name} className="h-14 w-14 rounded-xl object-cover shadow-lg flex-shrink-0" />
          )}
          <div className="space-y-2 flex-1">
            <h1 className="text-2xl font-bold">{section.headline}</h1>
            <p className="text-sm text-white/80">{section.subheadline}</p>
          </div>
          <a href="#products" style={{ borderRadius: btnRadius, whiteSpace: "nowrap" }}
            className="bg-white/20 hover:bg-white/30 text-white font-semibold px-6 py-2.5 transition-colors border border-white/30 text-sm flex-shrink-0">
            {section.ctaText}
          </a>
        </div>
      </section>
    );
  }

  // Default: centered
  return (
    <section style={baseStyle} className="text-white py-20 px-6">
      {overlay}
      <div style={{ position: "relative", zIndex: 1 }} className="max-w-3xl mx-auto text-center space-y-5">
        {org.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt={org.name} className="h-20 w-20 rounded-2xl object-cover mx-auto shadow-lg mb-2" />
        )}
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">{section.headline}</h1>
        <p className="text-lg sm:text-xl text-white/85">{section.subheadline}</p>
        {ctaBtn}
      </div>
    </section>
  );
}

// ─── Products ─────────────────────────────────────────────────────────────────

function buildWaUrl(section: StorefrontContent["products"], productName: string) {
  const num = (section.whatsappNumber ?? "").replace(/[^0-9]/g, "");
  if (!num) return null;
  const msg = (section.whatsappMessage || "Hi, I want to buy {product}. Is it available?").replace("{product}", productName);
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

function ProductActionBtns({ section, productName, primaryColor, btnRadius }: {
  section: StorefrontContent["products"]; productName: string; primaryColor: string; btnRadius: string;
}) {
  const waUrl = section.enableBuyButton ? buildWaUrl(section, productName) : null;
  return (
    <div className="flex gap-2 mt-3 flex-wrap">
      {section.enableBuyButton && (
        <a href={waUrl ?? undefined} target={waUrl ? "_blank" : undefined} rel="noopener noreferrer"
          style={{ backgroundColor: primaryColor, borderRadius: btnRadius, padding: "8px 14px", color: "white", fontSize: "13px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "5px", textDecoration: "none" }}>
          📱 {section.buyButtonText || "Buy Now"}
        </a>
      )}
      {section.enableAddToCart && (
        <button style={{ borderRadius: btnRadius, padding: "8px 14px", border: `1.5px solid ${primaryColor}`, color: primaryColor, fontSize: "13px", fontWeight: 600, background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}>
          🛒 {section.cartButtonText || "Add to Cart"}
        </button>
      )}
    </div>
  );
}

function ProductsSection({ section, products, primaryColor, currencyCode, productImages, layout, btnRadius, saleProducts, elStyles }: {
  section: StorefrontContent["products"];
  products: ProductData[];
  primaryColor: string;
  currencyCode: string;
  productImages: Record<string, string>;
  layout?: StorefrontCustomization["productsLayout"];
  btnRadius: string;
  saleProducts: Record<string, boolean>;
  elStyles: Record<string, import("@/types/storefront").StorefrontElementStyle>;
}) {
  const isEmpty = products.length === 0;

  return (
    <section id="products" style={{ backgroundColor: elStyles["products.bg"]?.backgroundColor }} className="py-16 px-6 bg-zinc-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 style={{ ...applyElStyle(elStyles, "products.title") }} className="text-3xl font-bold text-zinc-900">{section.title}</h2>
          <p style={{ ...applyElStyle(elStyles, "products.subtitle") }} className="text-zinc-500 mt-2">{section.subtitle}</p>
        </div>

        {isEmpty ? (
          <p className="text-center text-zinc-400 text-sm py-10">No products available yet.</p>
        ) : layout === "list" ? (
          <div className="space-y-4 max-w-3xl mx-auto">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm hover:shadow-md transition-shadow flex gap-4 items-start">
                <div className="h-24 w-24 bg-zinc-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                  {productImages[p.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImages[p.id]} alt={p.name} className="h-full w-full object-cover" />
                  ) : <span className="text-3xl">📦</span>}
                  {(section.enableSaleBadge || saleProducts[p.id]) && <span className="absolute top-1 left-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">SALE</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-400 uppercase tracking-wide mb-0.5">{p.category}</p>
                  <h3 className="font-semibold text-zinc-900">{p.name}</h3>
                  {p.description && <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{p.description}</p>}
                  <ProductActionBtns section={section} productName={p.name} primaryColor={primaryColor} btnRadius={btnRadius} />
                </div>
                <div className="text-right flex-shrink-0">
                  <span style={{ color: primaryColor }} className="font-bold text-xl block">{currencyCode} {p.sellingPrice.toFixed(2)}</span>
                  {p.currentStock > 0
                    ? <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium mt-1 inline-block">In Stock</span>
                    : <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-medium mt-1 inline-block">Out of Stock</span>
                  }
                </div>
              </div>
            ))}
          </div>
        ) : layout === "grid-large" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="h-52 bg-zinc-100 overflow-hidden flex items-center justify-center relative">
                  {productImages[p.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImages[p.id]} alt={p.name} className="h-full w-full object-cover" />
                  ) : <span className="text-5xl">📦</span>}
                  {(section.enableSaleBadge || saleProducts[p.id]) && <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">SALE</span>}
                </div>
                <div className="p-5">
                  <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">{p.category}</p>
                  <h3 className="font-semibold text-zinc-900 text-base">{p.name}</h3>
                  {p.description && <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{p.description}</p>}
                  <div className="mt-4 flex items-center justify-between">
                    <span style={{ color: primaryColor }} className="font-bold text-xl">{currencyCode} {p.sellingPrice.toFixed(2)}</span>
                    {p.currentStock > 0
                      ? <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">In Stock</span>
                      : <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-medium">Out of Stock</span>
                    }
                  </div>
                  <ProductActionBtns section={section} productName={p.name} primaryColor={primaryColor} btnRadius={btnRadius} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Default: grid-4
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-36 bg-zinc-100 rounded-xl mb-4 overflow-hidden flex items-center justify-center relative">
                  {productImages[p.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImages[p.id]} alt={p.name} className="h-full w-full object-cover" />
                  ) : <span className="text-4xl">📦</span>}
                  {(section.enableSaleBadge || saleProducts[p.id]) && <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">SALE</span>}
                </div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">{p.category}</p>
                <h3 className="font-semibold text-zinc-900 text-sm leading-snug">{p.name}</h3>
                {p.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{p.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span style={{ color: primaryColor }} className="font-bold text-lg">{currencyCode} {p.sellingPrice.toFixed(2)}</span>
                  {p.currentStock > 0
                    ? <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">In Stock</span>
                    : <span className="text-xs bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-medium">Out of Stock</span>
                  }
                </div>
                <ProductActionBtns section={section} productName={p.name} primaryColor={primaryColor} btnRadius={btnRadius} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── About ────────────────────────────────────────────────────────────────────

function AboutSection({ section, primaryColor }: { section: StorefrontContent["about"]; primaryColor: string }) {
  return (
    <section id="about" className="py-16 px-6 bg-white">
      <div className="max-w-3xl mx-auto text-center space-y-4">
        <h2 style={{ color: primaryColor }} className="text-3xl font-bold">{section.title}</h2>
        <p className="text-zinc-600 text-lg leading-relaxed">{section.body}</p>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function FeaturesSection({ section, primaryColor }: { section: StorefrontContent["features"]; primaryColor: string }) {
  const icons: Record<string, string> = {
    ShieldCheck: "🛡️", Truck: "🚚", Star: "⭐", HeadphonesIcon: "🎧",
    Heart: "❤️", Zap: "⚡", Award: "🏆", Package: "📦", CheckCircle: "✅",
  };
  return (
    <section id="features" className="py-16 px-6 bg-zinc-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-zinc-900 text-center mb-10">{section.title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {section.highlights.map((h, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-3 border border-zinc-100">
              <div style={{ backgroundColor: primaryColor }} className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto text-2xl">
                {icons[h.icon] ?? "✨"}
              </div>
              <h3 className="font-bold text-zinc-900">{h.title}</h3>
              <p className="text-sm text-zinc-500">{h.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function TestimonialsSection({ section, primaryColor }: {
  section: NonNullable<StorefrontContent["testimonials"]>;
  primaryColor: string;
}) {
  return (
    <section id="testimonials" className="py-16 px-6 bg-white">
      <div className="max-w-5xl mx-auto">
        <h2 style={{ color: primaryColor }} className="text-3xl font-bold text-center mb-10">{section.title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {section.items.map((item, i) => (
            <div key={i} className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100 space-y-4">
              <p className="text-zinc-600 leading-relaxed italic">&ldquo;{item.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div style={{ backgroundColor: primaryColor }} className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-zinc-900 text-sm">{item.name}</p>
                  <p className="text-xs text-zinc-400">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function FaqSection({ section, primaryColor }: {
  section: NonNullable<StorefrontContent["faq"]>;
  primaryColor: string;
}) {
  return (
    <section id="faq" className="py-16 px-6 bg-zinc-50">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-zinc-900 text-center mb-10">{section.title}</h2>
        <div className="space-y-4">
          {section.items.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm">
              <h3 style={{ color: primaryColor }} className="font-bold mb-2">{item.q}</h3>
              <p className="text-zinc-600 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────

function ContactSection({ section, org, primaryColor }: {
  section: StorefrontContent["contact"];
  org: OrgData;
  primaryColor: string;
}) {
  return (
    <section id="contact" className="py-16 px-6 bg-white">
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <h2 className="text-3xl font-bold text-zinc-900">{section.title}</h2>
        <p className="text-zinc-500">{section.body}</p>
        <div className="space-y-2 pt-2">
          {section.showPhone && org.phone && (
            <p className="text-sm">
              <span className="text-zinc-400 mr-2">📞</span>
              <a href={`tel:${org.phone}`} style={{ color: primaryColor }} className="font-medium hover:underline">{org.phone}</a>
            </p>
          )}
          {section.showAddress && org.address && (
            <p className="text-sm text-zinc-600"><span className="text-zinc-400 mr-2">📍</span>{org.address}</p>
          )}
          {org.websiteUrl && (
            <p className="text-sm">
              <span className="text-zinc-400 mr-2">🌐</span>
              <a href={org.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: primaryColor }} className="font-medium hover:underline">{org.websiteUrl}</a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function FooterSection({ section, org, primaryColor, style }: {
  section: StorefrontContent["footer"];
  org: OrgData;
  primaryColor: string;
  style?: StorefrontCustomization["footerStyle"];
}) {
  if (style === "detailed") {
    return (
      <footer style={{ backgroundColor: primaryColor }} className="text-white py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            {org.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logoUrl} alt={org.name} className="h-10 w-10 rounded-lg object-cover mb-3" />
            )}
            <p className="font-bold text-lg">{org.name}</p>
            <p className="text-white/60 text-sm mt-1">{section.tagline}</p>
          </div>
          <div>
            <p className="font-semibold mb-3 text-white/80 uppercase text-xs tracking-wider">Contact</p>
            {org.phone && <p className="text-sm text-white/70 mb-1">📞 {org.phone}</p>}
            {org.address && <p className="text-sm text-white/70">📍 {org.address}</p>}
          </div>
          <div>
            {section.showPoweredBy && (
              <p className="text-xs text-white/40 mt-1">
                Powered by{" "}
                <a href="https://luminastocks.com" className="underline hover:text-white/60">Lumina Stock</a>
              </p>
            )}
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer style={{ backgroundColor: primaryColor }} className="text-white py-8 px-6 text-center">
      <p className="text-sm text-white/80">{section.tagline || `© ${new Date().getFullYear()} ${org.name}`}</p>
      {section.showPoweredBy && (
        <p className="text-xs text-white/50 mt-2">
          Powered by{" "}
          <a href="https://luminastocks.com" className="underline hover:text-white/80 transition-colors">Lumina Stock</a>
        </p>
      )}
    </footer>
  );
}
