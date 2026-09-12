import { cn } from "@/lib/utils";

// ─── Logomark ─────────────────────────────────────────────────────────────────
// An isometric crystal — three rhombus faces in emerald gradient, evoking a gem
// that catches light (Lumina = Latin for "lights").
// The three-face cube also echoes stacked inventory boxes.

interface LogomarkProps {
  size?: number;
  className?: string;
}

export function LuminaLogomark({ size = 36, className }: LogomarkProps) {
  const id = "lumina";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Lumina"
      className={className}
    >
      <defs>
        {/* Top face — brightest, catches overhead light */}
        <linearGradient id={`${id}-top`} x1="4" y1="4" x2="36" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#34d399" />
        </linearGradient>
        {/* Right face — mid tone */}
        <linearGradient id={`${id}-right`} x1="36" y1="13" x2="20" y2="39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        {/* Left face — in shadow, darkest */}
        <linearGradient id={`${id}-left`} x1="4" y1="13" x2="20" y2="39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669" />
          <stop offset="1" stopColor="#065f46" />
        </linearGradient>
        {/* Gleam highlight on top face */}
        <linearGradient id={`${id}-gleam`} x1="12" y1="6" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.35" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ── Three faces of the isometric cube ─────────────────────────────── */}
      {/* Hex vertices: top(20,4) upper-right(36,13) lower-right(36,30)
          bottom(20,39) lower-left(4,30) upper-left(4,13)
          Center where faces meet: (20,22)                                    */}

      {/* Top face */}
      <polygon
        points="20,4 36,13 20,22 4,13"
        fill={`url(#${id}-top)`}
      />
      {/* Right face */}
      <polygon
        points="36,13 36,30 20,39 20,22"
        fill={`url(#${id}-right)`}
      />
      {/* Left face */}
      <polygon
        points="4,13 20,22 20,39 4,30"
        fill={`url(#${id}-left)`}
      />

      {/* ── Crisp edge lines ──────────────────────────────────────────────── */}
      {/* Top ridge — brightens the top two edges */}
      <polyline
        points="4,13 20,4 36,13"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="0.75"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Vertical spine from apex to center */}
      <line
        x1="20" y1="4" x2="20" y2="22"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.5"
      />

      {/* ── Gleam — asymmetric light catch on top-left facet ─────────────── */}
      <polygon
        points="20,4 12,8.5 20,14 28,8.5"
        fill={`url(#${id}-gleam)`}
      />

      {/* ── Tiny star spark at apex ───────────────────────────────────────── */}
      <path
        d="M20 2 L20.6 3.8 L22.4 4 L20.6 4.2 L20 6 L19.4 4.2 L17.6 4 L19.4 3.8 Z"
        fill="rgba(255,255,255,0.9)"
      />
    </svg>
  );
}

// ─── Full logo (mark + wordmark) ──────────────────────────────────────────────

interface LuminaLogoProps {
  /** Show the text wordmark beside the mark */
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Override text colour (defaults to zinc-900 dark:zinc-100) */
  lightText?: boolean;
}

export function LuminaLogo({
  showWordmark = true,
  size = "md",
  className,
  lightText = false,
}: LuminaLogoProps) {
  const markSize = size === "sm" ? 26 : size === "lg" ? 48 : 34;
  const nameClass =
    size === "sm"
      ? "text-[11px] tracking-[0.12em]"
      : size === "lg"
      ? "text-base tracking-[0.16em]"
      : "text-[13px] tracking-[0.14em]";
  const subClass =
    size === "sm"
      ? "text-[8px] tracking-[0.24em] mt-0.5"
      : "text-[9px] tracking-[0.28em] mt-0.5";

  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <LuminaLogomark size={markSize} />
      {showWordmark && (
        <div>
          <p
            className={cn(
              "font-extrabold leading-none",
              nameClass,
              lightText
                ? "text-white"
                : "text-zinc-900 dark:text-zinc-100"
            )}
          >
            LUMINA
          </p>
          <p
            className={cn(
              "font-semibold uppercase leading-none",
              subClass,
              lightText
                ? "text-white/60"
                : "text-zinc-400 dark:text-zinc-500"
            )}
          >
            Stock
          </p>
        </div>
      )}
    </div>
  );
}
