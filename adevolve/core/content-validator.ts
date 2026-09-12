/**
 * adevolve/core/content-validator.ts
 *
 * Validates ad content (text, image, video) and returns a structured
 * ContentReport with a 0–100 quality score and actionable suggestions.
 *
 * Design rules:
 *  - Zero network calls — all validation is local / heuristic
 *  - Platform-agnostic at the core (adapters apply platform-specific limits)
 *  - Returns `valid: true` even if score is low (low score = usable but sub-optimal)
 */

import type { ContentInput, ContentReport } from "../types";

// ─── Shareability signals (used for intent === "post") ────────────────────────

const EMOTIONAL_WORDS = new Set([
  "amazing", "proud", "excited", "thrilled", "grateful", "inspired",
  "incredible", "wonderful", "fantastic", "brilliant", "love", "joy",
  "passionate", "delighted", "honoured", "blessed", "overjoyed",
  "remarkable", "outstanding", "extraordinary",
]);

const STORYTELLING_OPENERS = [
  /^we just\b/i,
  /^today we\b/i,
  /^behind the scenes/i,
  /^i('ve)? (just|recently)\b/i,
  /^our team\b/i,
  /^it('s| is) official/i,
  /^introducing\b/i,
  /^here('s| is) (how|what|why)\b/i,
];

// ─── Text Validation ──────────────────────────────────────────────────────────

const CTA_PATTERNS = [
  /\b(buy|shop|order|purchase|get|grab|claim|download|try|start|sign up|register|subscribe|learn more|discover|explore|book|schedule|contact|call|request|apply|join|unlock|access)\b/i,
];

const POSITIVE_TONE_WORDS = new Set([
  "amazing", "excellent", "proven", "guaranteed", "easy", "simple", "free",
  "save", "boost", "improve", "grow", "increase", "powerful", "trusted",
  "award-winning", "best", "top", "leading", "premium", "exclusive", "new",
  "transform", "unlock", "achieve", "success", "results", "effective",
]);

const NEGATIVE_TONE_WORDS = new Set([
  "bad", "terrible", "awful", "worst", "failure", "useless", "cheap", "hate",
  "ugly", "broken", "scam", "lie", "fake", "boring", "slow", "weak",
]);

const SPAM_PATTERNS = [
  /\b(click here|click now|100% free|cash bonus|you have been selected|winner|congratulations)\b/gi,
  /!{3,}/, // 3+ exclamation marks
  /\$\$\$/, // triple dollar
  /[A-Z]{5,}/, // excessive CAPS
];

function validateText(
  content: string,
  intent?: "ad" | "post",
): Omit<ContentReport, "valid"> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const isPost = intent === "post";
  const wordCount = content.trim().split(/\s+/).length;
  const charCount = content.length;

  // ── Length checks ────────────────────────────────────────────────
  // Posts have a lower minimum (20 chars); ads require at least 50
  const minBlockingChars = 20;
  const minWarnChars = isPost ? 20 : 50;

  if (charCount < minBlockingChars) {
    issues.push("Text is too short (< 20 characters).");
    suggestions.push(
      isPost
        ? "Add at least 20 characters so your post has meaningful content."
        : "Expand the ad copy to at least 50 characters for meaningful context.",
    );
    score -= 30;
  } else if (!isPost && charCount < minWarnChars) {
    issues.push("Text is very short — may lack context for viewers.");
    suggestions.push("Add a benefit statement or social proof to strengthen the copy.");
    score -= 10;
  }

  if (charCount > 2000) {
    issues.push("Text exceeds 2,000 characters — most platforms will truncate.");
    suggestions.push("Trim the copy to under 500 characters for primary ad text.");
    score -= 15;
  } else if (charCount > 1000) {
    suggestions.push("Consider shortening to under 500 characters for better readability.");
    score -= 5;
  }

  // ── CTA presence (ads only — posts don't require a CTA) ──────────
  if (!isPost) {
    const hasCTA = CTA_PATTERNS.some((p) => p.test(content));
    if (!hasCTA) {
      issues.push("No clear call-to-action (CTA) detected.");
      suggestions.push(
        'Add a strong action verb CTA such as "Get Started Free", "Shop Now", or "Book a Demo".',
      );
      score -= 20;
    }
  }

  // ── Shareability signals (posts only) ────────────────────────────
  if (isPost) {
    const words = content.toLowerCase().split(/\W+/);
    const emotionalCount = words.filter((w) => EMOTIONAL_WORDS.has(w)).length;
    if (emotionalCount > 0) {
      score += Math.min(emotionalCount * 5, 15); // up to +15 for emotional language
    }

    const hasStorytelling = STORYTELLING_OPENERS.some((p) => p.test(content));
    if (hasStorytelling) {
      score += 10;
      suggestions.push("Storytelling opener detected — great for organic reach and engagement.");
    }

    if (!content.includes("?")) {
      suggestions.push("Add a question to invite comments and boost engagement.");
    } else {
      score += 5; // question mark bonus
    }
  }

  // ── Tone analysis ────────────────────────────────────────────────
  const words = content.toLowerCase().split(/\W+/);
  const positiveCount = words.filter((w) => POSITIVE_TONE_WORDS.has(w)).length;
  const negativeCount = words.filter((w) => NEGATIVE_TONE_WORDS.has(w)).length;

  if (negativeCount > positiveCount) {
    issues.push(`Negative tone detected — ${isPost ? "post" : "ad copy"} may underperform.`);
    suggestions.push("Replace negative language with benefit-focused, positive framing.");
    score -= 15;
  } else if (positiveCount === 0) {
    suggestions.push("Add persuasive power words (e.g. 'proven', 'exclusive', 'free') to lift engagement.");
    score -= 5;
  }

  // ── Keyword density ──────────────────────────────────────────────
  if (wordCount > 5) {
    const uniqueWords = new Set(words.filter((w) => w.length > 3));
    const density = uniqueWords.size / wordCount;
    if (density < 0.3) {
      issues.push("High word repetition detected — content feels spammy.");
      suggestions.push("Vary your vocabulary to improve readability and quality score.");
      score -= 10;
    }
  }

  // ── Spam / policy checks ─────────────────────────────────────────
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      issues.push("Content contains potentially policy-violating patterns (spam signals).");
      suggestions.push("Remove excessive capitalisation, multiple exclamation marks, or banned phrases.");
      score -= 20;
      break;
    }
  }

  // ── Readability (Flesch-Kincaid approximation) ───────────────────
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  if (sentences > 0 && wordCount / sentences > 25) {
    suggestions.push("Break long sentences into shorter ones (aim for < 20 words per sentence).");
    score -= 5;
  }

  return { score: Math.max(0, Math.min(100, score)), issues, suggestions };
}

// ─── Image Validation ─────────────────────────────────────────────────────────

interface ImageSpec {
  name: string;
  width: number;
  height: number;
  aspectRatio: string;
}

const STANDARD_IMAGE_SPECS: ImageSpec[] = [
  { name: "Facebook Feed (Landscape)", width: 1200, height: 628, aspectRatio: "1.91:1" },
  { name: "Instagram Feed (Square)", width: 1080, height: 1080, aspectRatio: "1:1" },
  { name: "Instagram Story / TikTok", width: 1080, height: 1920, aspectRatio: "9:16" },
  { name: "LinkedIn Sponsored (Landscape)", width: 1200, height: 627, aspectRatio: "1.91:1" },
  { name: "Twitter / X Card", width: 1200, height: 675, aspectRatio: "16:9" },
  { name: "Google Display (Rectangle)", width: 300, height: 250, aspectRatio: "6:5" },
  { name: "Google Display (Leaderboard)", width: 728, height: 90, aspectRatio: "8.09:1" },
];

function parseBase64ImageDimensions(
  base64: string,
): { width: number; height: number } | null {
  // For PNG: read width/height from IHDR chunk bytes 16–23
  try {
    if (!base64.includes("data:image/png") && !base64.includes("data:image")) {
      return null;
    }
    // Strip data URI prefix
    const raw = base64.replace(/^data:[^;]+;base64,/, "");
    const bytes = Buffer.from(raw, "base64");

    if (bytes.length < 24) return null;

    // PNG signature check
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      const width = bytes.readUInt32BE(16);
      const height = bytes.readUInt32BE(20);
      return { width, height };
    }

    // JPEG: scan for SOF0 (0xFF 0xC0) marker
    for (let i = 0; i < bytes.length - 8; i++) {
      if (bytes[i] === 0xff && (bytes[i + 1] === 0xc0 || bytes[i + 1] === 0xc2)) {
        const height = bytes.readUInt16BE(i + 5);
        const width = bytes.readUInt16BE(i + 7);
        return { width, height };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function estimateBase64FileSizeBytes(base64: string): number {
  const raw = base64.replace(/^data:[^;]+;base64,/, "").replace(/=/g, "");
  return Math.floor((raw.length * 3) / 4);
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function validateImage(content: string, mimeType?: string): Omit<ContentReport, "valid"> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const isBase64 = content.startsWith("data:") || /^[A-Za-z0-9+/]={0,2}$/.test(content.slice(0, 20));
  const isUrl = content.startsWith("http://") || content.startsWith("https://");

  if (!isBase64 && !isUrl) {
    issues.push("Image content must be a base64 data URI or an HTTPS URL.");
    suggestions.push("Provide a base64-encoded image (data:image/jpeg;base64,...) or a public HTTPS URL.");
    return { score: 0, issues, suggestions };
  }

  if (isBase64) {
    // File size check
    const sizeBytes = estimateBase64FileSizeBytes(content);
    if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      issues.push(`Image file size (~${Math.round(sizeBytes / 1024 / 1024)} MB) exceeds the 10 MB limit.`);
      suggestions.push("Compress the image to under 5 MB for optimal delivery speed.");
      score -= 30;
    } else if (sizeBytes > 5 * 1024 * 1024) {
      suggestions.push("Image is large (> 5 MB) — consider compressing for faster load times.");
      score -= 10;
    }

    // Dimension check
    const dims = parseBase64ImageDimensions(content);
    if (dims) {
      const { width, height } = dims;
      const ratio = width / height;
      const matchedSpec = STANDARD_IMAGE_SPECS.find(
        (s) => Math.abs(s.width / s.height - ratio) < 0.05,
      );

      if (!matchedSpec) {
        issues.push(
          `Non-standard aspect ratio (${width}×${height}). Common specs: 1.91:1, 1:1, 9:16, 16:9.`,
        );
        suggestions.push(
          "Crop to 1200×628 (Facebook), 1080×1080 (Instagram square), or 1080×1920 (Story/TikTok).",
        );
        score -= 20;
      } else {
        suggestions.push(`Dimensions match ${matchedSpec.name} spec — good.`);
      }

      if (width < 600 || height < 300) {
        issues.push(`Image resolution (${width}×${height}) is too low. Minimum recommended: 600×300.`);
        suggestions.push("Use a minimum resolution of 1200×628 for crisp display across all placements.");
        score -= 25;
      }
    } else {
      suggestions.push("Could not decode image dimensions. Verify the file is a valid JPEG or PNG.");
      score -= 5;
    }

    // Mime type check
    const detectedType = mimeType ?? (content.match(/data:(image\/[^;]+)/)?.[1] ?? "unknown");
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(detectedType)) {
      issues.push(`MIME type '${detectedType}' may not be supported by all platforms.`);
      suggestions.push("Use JPEG or PNG for maximum cross-platform compatibility.");
      score -= 10;
    }
  }

  if (isUrl) {
    // URL format validation
    try {
      const url = new URL(content);
      if (url.protocol !== "https:") {
        issues.push("Image URL must use HTTPS.");
        suggestions.push("Replace http:// with https:// in the image URL.");
        score -= 20;
      }
      // Tip: infer format from URL extension
      const ext = url.pathname.split(".").pop()?.toLowerCase();
      if (ext && !["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
        suggestions.push(
          `URL extension '.${ext}' may not be a valid image format. Prefer .jpg, .png, or .webp.`,
        );
        score -= 5;
      }
    } catch {
      issues.push("Image URL is malformed.");
      score -= 30;
    }
    suggestions.push(
      "For URL-based images, verify the asset is publicly accessible and returns a 200 status.",
    );
  }

  return { score: Math.max(0, score), issues, suggestions };
}

// ─── Video Validation ─────────────────────────────────────────────────────────

const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  "mp4", "mov", "avi", "webm", "mkv", "flv",
]);

const MAX_VIDEO_DURATION_SECONDS: Record<string, number> = {
  meta: 240,
  google: 30,
  tiktok: 60,
  linkedin: 30 * 60,
  x: 140,
};

const RECOMMENDED_VIDEO_DURATION_SECONDS = {
  min: 6,
  max: 30,
  sweet: 15,
};

function validateVideo(content: string, metadata?: Record<string, unknown>): Omit<ContentReport, "valid"> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const isUrl = content.startsWith("http://") || content.startsWith("https://");
  const isFilePath = content.startsWith("/") || /^[A-Z]:\\/i.test(content) || content.startsWith("./");

  if (!isUrl && !isFilePath) {
    issues.push("Video must be provided as an HTTPS URL or a local file path.");
    return { score: 0, issues, suggestions };
  }

  if (isUrl) {
    try {
      const url = new URL(content);
      if (url.protocol !== "https:") {
        issues.push("Video URL must use HTTPS.");
        score -= 20;
      }
      const ext = url.pathname.split(".").pop()?.toLowerCase() ?? "";
      if (!SUPPORTED_VIDEO_EXTENSIONS.has(ext)) {
        issues.push(`Video extension '.${ext}' may not be supported. Preferred format: MP4 (H.264).`);
        suggestions.push("Re-encode the video as MP4/H.264 for maximum platform compatibility.");
        score -= 15;
      }
    } catch {
      issues.push("Video URL is malformed.");
      score -= 30;
    }
  }

  // Duration checks from metadata
  const duration = typeof metadata?.duration === "number" ? metadata.duration : null;
  if (duration !== null) {
    if (duration < RECOMMENDED_VIDEO_DURATION_SECONDS.min) {
      issues.push(`Video duration (${duration}s) is below the recommended minimum of ${RECOMMENDED_VIDEO_DURATION_SECONDS.min}s.`);
      suggestions.push("Keep videos between 6–30 seconds for optimal completion rates.");
      score -= 20;
    } else if (duration > RECOMMENDED_VIDEO_DURATION_SECONDS.max) {
      suggestions.push(
        `Video is ${duration}s — consider trimming to 15–30s for higher completion rates. 15s performs best on most platforms.`,
      );
      score -= 8;
    } else if (duration === RECOMMENDED_VIDEO_DURATION_SECONDS.sweet) {
      score += 5; // bonus for hitting the sweet spot
      suggestions.push("15-second video is the industry sweet spot for completion rates.");
    }

    // Per-platform duration limits
    for (const [platform, maxDur] of Object.entries(MAX_VIDEO_DURATION_SECONDS)) {
      if (duration > maxDur) {
        issues.push(`Video exceeds ${platform}'s maximum duration of ${maxDur}s.`);
        score -= 10;
        break;
      }
    }
  } else {
    suggestions.push(
      "Pass `metadata.duration` (seconds) for duration compliance checks. Recommended: 15–30s.",
    );
  }

  // Resolution from metadata
  const width = typeof metadata?.width === "number" ? metadata.width : null;
  const height = typeof metadata?.height === "number" ? metadata.height : null;
  if (width !== null && height !== null) {
    if (width < 640 || height < 480) {
      issues.push(`Low resolution (${width}×${height}). Minimum recommended: 1280×720 (720p).`);
      suggestions.push("Use at least 720p (1280×720) resolution; 1080p preferred for premium placements.");
      score -= 20;
    } else if (width >= 1920 && height >= 1080) {
      suggestions.push("1080p resolution — excellent for all placements.");
    }
  } else {
    suggestions.push(
      "Pass `metadata.width` and `metadata.height` for resolution compliance checks.",
    );
  }

  // Codec hint
  const codec = typeof metadata?.codec === "string" ? metadata.codec.toLowerCase() : null;
  if (codec && !["h264", "avc", "avc1", "h.264"].includes(codec)) {
    issues.push(`Codec '${codec}' detected. H.264/AVC is the preferred codec for cross-platform compatibility.`);
    suggestions.push("Re-encode with H.264 codec for maximum platform support.");
    score -= 10;
  }

  if (!issues.length && !suggestions.length) {
    suggestions.push("Video format looks good. Ensure captions/subtitles are included (many users watch silently).");
  }

  return { score: Math.max(0, Math.min(100, score)), issues, suggestions };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate ad content and return a structured ContentReport.
 *
 * @param input - The ContentInput (text | image | video)
 * @returns ContentReport with valid flag, issues, score, and suggestions
 */
export function validateContent(input: ContentInput): ContentReport {
  let result: Omit<ContentReport, "valid">;
  const intent = input.intent; // "ad" | "post" | undefined

  switch (input.type) {
    case "text":
      result = validateText(input.content, intent);
      break;
    case "image":
      result = validateImage(input.content, input.mimeType);
      break;
    case "video":
      result = validateVideo(
        input.content,
        input.metadata as Record<string, unknown> | undefined,
      );
      break;
    default: {
      const _exhaustive: never = input.type;
      result = {
        score: 0,
        issues: [`Unknown content type: ${String(_exhaustive)}`],
        suggestions: ["Use one of: text, image, video."],
      };
    }
  }

  // `valid` = no blocking issues AND score above 30
  const hasBlockingIssues = result.issues.some((i) =>
    i.toLowerCase().includes("must") || i.toLowerCase().includes("malformed"),
  );
  const valid = !hasBlockingIssues && result.score >= 30;

  return { valid, ...result };
}

/** ContentValidator class for dependency-injection usage */
export class ContentValidator {
  validate(input: ContentInput): ContentReport {
    return validateContent(input);
  }
}
