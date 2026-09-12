export interface StorefrontHeroSection {
  enabled: boolean;
  headline: string;
  subheadline: string;
  ctaText: string;
}

export interface StorefrontAboutSection {
  enabled: boolean;
  title: string;
  body: string;
}

export interface StorefrontFeatureHighlight {
  icon: string;
  title: string;
  description: string;
}

export interface StorefrontFeaturesSection {
  enabled: boolean;
  title: string;
  highlights: StorefrontFeatureHighlight[];
}

export interface StorefrontProductsSection {
  enabled: boolean;
  title: string;
  subtitle: string;
  enableBuyButton?: boolean;
  buyButtonText?: string;
  whatsappNumber?: string;
  whatsappMessage?: string;
  enableAddToCart?: boolean;
  cartButtonText?: string;
  enableSaleBadge?: boolean;
}

export interface StorefrontContactSection {
  enabled: boolean;
  title: string;
  body: string;
  showPhone: boolean;
  showAddress: boolean;
}

export interface StorefrontFooterSection {
  enabled: boolean;
  tagline: string;
  showPoweredBy: boolean;
}

export interface StorefrontTestimonial {
  quote: string;
  name: string;
  role: string;
}

export interface StorefrontTestimonialsSection {
  enabled: boolean;
  title: string;
  items: StorefrontTestimonial[];
}

export interface StorefrontFaqItem {
  q: string;
  a: string;
}

export interface StorefrontFaqSection {
  enabled: boolean;
  title: string;
  items: StorefrontFaqItem[];
}

export type StorefrontFontSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

export interface StorefrontElementStyle {
  textAlign?: "left" | "center" | "right";
  fontWeight?: "bold" | "normal";
  color?: string;
  backgroundColor?: string;
  fontSize?: StorefrontFontSize;
  imageFit?: "cover" | "contain" | "fill" | "none";
  imagePosition?: "center" | "top" | "bottom" | "left" | "right";
}

export interface StorefrontCustomization {
  primaryColor?: string;
  heroImageUrl?: string;
  heroOverlay?: boolean;
  fontFamily?: "sans" | "serif" | "display" | "mono";
  productImages?: Record<string, string>;
  heroLayout?: "centered" | "split" | "fullscreen" | "compact";
  navStyle?: "solid" | "white" | "dark" | "transparent";
  buttonStyle?: "rounded" | "pill" | "square";
  productsLayout?: "grid" | "grid-large" | "list";
  footerStyle?: "simple" | "detailed";
  elementStyles?: Record<string, StorefrontElementStyle>;
  saleProducts?: Record<string, boolean>;
}

export interface StorefrontContent {
  version: 1;
  generatedAt: string;
  sectionOrder: string[];
  hero: StorefrontHeroSection;
  about: StorefrontAboutSection;
  features: StorefrontFeaturesSection;
  products: StorefrontProductsSection;
  contact: StorefrontContactSection;
  footer: StorefrontFooterSection;
  testimonials?: StorefrontTestimonialsSection;
  faq?: StorefrontFaqSection;
  customization?: StorefrontCustomization;
}

export const DEFAULT_SECTION_ORDER = ["hero", "products", "about", "features", "contact", "footer"] as const;

export const FONT_SIZE_PX: Record<StorefrontFontSize, string> = {
  xs: "12px", sm: "14px", base: "16px", lg: "18px", xl: "20px",
  "2xl": "24px", "3xl": "30px", "4xl": "36px", "5xl": "48px",
};

export function applyElStyle(
  elementStyles: Record<string, StorefrontElementStyle> | undefined,
  key: string
): React.CSSProperties {
  const s = elementStyles?.[key];
  if (!s) return {};
  return {
    textAlign: s.textAlign,
    fontWeight: s.fontWeight,
    color: s.color,
    backgroundColor: s.backgroundColor,
    fontSize: s.fontSize ? FONT_SIZE_PX[s.fontSize] : undefined,
  };
}

export const FONT_OPTIONS: { value: StorefrontCustomization["fontFamily"]; label: string; style: string }[] = [
  { value: "sans",    label: "Modern (Sans)",    style: "system-ui, -apple-system, sans-serif" },
  { value: "serif",   label: "Classic (Serif)",  style: "Georgia, 'Times New Roman', serif" },
  { value: "display", label: "Elegant (Display)", style: "'Playfair Display', Georgia, serif" },
  { value: "mono",    label: "Technical (Mono)", style: "'Courier New', Courier, monospace" },
];

export function getFontStyle(fontFamily?: StorefrontCustomization["fontFamily"]): string {
  return FONT_OPTIONS.find((f) => f.value === fontFamily)?.style ?? FONT_OPTIONS[0].style;
}

export function buildDefaultTestimonials(orgName: string): StorefrontTestimonialsSection {
  return {
    enabled: true,
    title: "What Our Customers Say",
    items: [
      { quote: `${orgName} has amazing products and fast service!`, name: "Sarah M.", role: "Regular Customer" },
      { quote: "Great quality, will definitely order again.", name: "James K.", role: "Verified Buyer" },
      { quote: "Highly recommend to everyone looking for great deals.", name: "Priya R.", role: "Loyal Customer" },
    ],
  };
}

export function buildDefaultFaq(orgName: string): StorefrontFaqSection {
  return {
    enabled: true,
    title: "Frequently Asked Questions",
    items: [
      { q: "How can I place an order?", a: `Contact ${orgName} directly via phone or visit us in person.` },
      { q: "What payment methods do you accept?", a: "We accept cash, bank transfer, and major cards." },
      { q: "Do you offer delivery?", a: "Yes, we offer delivery. Please contact us for details and pricing." },
      { q: "Can I return a product?", a: "We have a flexible return policy. Contact us within 7 days of purchase." },
    ],
  };
}

export function buildDefaultContent(orgName: string): StorefrontContent {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hero: {
      enabled: true,
      headline: `Welcome to ${orgName}`,
      subheadline: "Quality products, great prices. Browse our catalog below.",
      ctaText: "Shop Now",
    },
    about: {
      enabled: true,
      title: `About ${orgName}`,
      body: "We are committed to providing the best products and service to our customers.",
    },
    features: {
      enabled: true,
      title: "Why Choose Us",
      highlights: [
        { icon: "ShieldCheck", title: "Quality Guaranteed", description: "Every product is carefully selected for quality." },
        { icon: "Truck",       title: "Fast Delivery",      description: "Quick and reliable delivery to your doorstep." },
        { icon: "HeadphonesIcon", title: "Great Support",   description: "Our team is here to help you whenever you need it." },
      ],
    },
    products: {
      enabled: true,
      title: "Our Products",
      subtitle: "Browse our full range of available products.",
    },
    contact: {
      enabled: true,
      title: "Get in Touch",
      body: "Have questions? We'd love to hear from you.",
      showPhone: true,
      showAddress: true,
    },
    footer: {
      enabled: true,
      tagline: `© ${new Date().getFullYear()} ${orgName}. All rights reserved.`,
      showPoweredBy: true,
    },
    customization: {},
  };
}
