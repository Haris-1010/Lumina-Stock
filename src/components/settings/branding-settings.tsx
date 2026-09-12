"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Upload, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateOrganizationBrandingForCurrentOrganization,
} from "@/lib/actions/organization-settings";

interface Props {
  initialName: string;
  initialLogoUrl?: string | null;
  initialAddress?: string | null;
  initialPhone?: string | null;
  initialWebsiteUrl?: string | null;
}

const subscribeToHydration = () => () => {};

export function BrandingSettings({
  initialName,
  initialLogoUrl,
  initialAddress,
  initialPhone,
  initialWebsiteUrl,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [address, setAddress] = useState(initialAddress ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [uploading, setUploading] = useState(false);
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  async function handleSaveBranding() {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await updateOrganizationBrandingForCurrentOrganization({ name, logoUrl, websiteUrl, address, phone });
      setFeedback(result.success ? { type: "success", message: "Store branding saved. Bills, invoices, and reports will use these details." } : { type: "error", message: result.error || "Failed to save." });
      if (result.success) router.refresh();
    } catch {
      setFeedback({ type: "error", message: "Could not save branding. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject files larger than 500 KB to keep DB size reasonable
    if (file.size > 500 * 1024) {
      setFeedback({ type: "error", message: "Logo file must be under 500 KB. Please resize it first." });
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") {
        setLogoUrl(result);
        setFeedback(null);
      }
      setUploading(false);
    };
    reader.onerror = () => {
      setFeedback({ type: "error", message: "Failed to read the file." });
      setUploading(false);
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  const isDataUrl = logoUrl.startsWith("data:");

  return (
    <div className="space-y-6">
      {/* Branding Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 space-y-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Store Branding</h3>
          <p className="text-sm text-zinc-500 mt-0.5">Store name, logo, and contact information used on bills, invoices, and reports.</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="store-name">Store Name</Label>
            <Input id="store-name" value={name} onChange={event => setName(event.target.value)} maxLength={100} required placeholder="Your store name" />
          </div>
          {/* Logo field */}
          <div className="space-y-1.5">
            {/* Use a plain <label> so suppressHydrationWarning reaches the DOM
                element directly — prevents stale-cache mismatch errors */}
            <label
              htmlFor="logoUrl"
              suppressHydrationWarning
              className="text-sm font-medium leading-none"
            >
              Logo
            </label>

            {/* Mode toggle — only rendered after mount to avoid SSR/client diff */}
            {mounted && (
              <div className="flex gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setUploadMode("url")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    uploadMode === "url"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  <Link2 className="h-3 w-3" />
                  Paste URL
                </button>
                <button
                  type="button"
                  onClick={() => { setUploadMode("file"); fileInputRef.current?.click(); }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    uploadMode === "file"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  <Upload className="h-3 w-3" />
                  Upload File
                </button>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Input area — always renders the URL input initially (SSR-safe).
                After mount, switches to whichever mode the user picks. */}
            {!mounted || uploadMode === "url" ? (
              <>
                <Input
                  id="logoUrl"
                  type="url"
                  placeholder="https://your-site.com/logo.png"
                  value={isDataUrl ? "" : logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
                <p className="text-xs text-zinc-500">Paste a direct link to your logo image (PNG, JPG, SVG).</p>
              </>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors"
              >
                {uploading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500" />
                ) : (
                  <Upload className="h-5 w-5 text-zinc-400" />
                )}
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {uploading ? "Reading file…" : "Click to choose a file"}
                </p>
                <p className="text-xs text-zinc-400">PNG, JPG, SVG, WEBP · max 500 KB</p>
              </div>
            )}

            {/* Preview */}
            {logoUrl && (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-12 w-auto max-w-[160px] rounded border border-zinc-200 object-contain p-1 dark:border-zinc-700"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-zinc-400">Preview</span>
                  <button
                    type="button"
                    onClick={() => { setLogoUrl(""); setFeedback(null); }}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Business Address</Label>
            <Input
              id="address"
              placeholder="e.g. Shop 12, Jodia Bazar, Karachi"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone / WhatsApp</Label>
            <Input
              id="phone"
              placeholder="e.g. +92 300 1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="websiteUrl">Store Website URL</Label>
            <Input
              id="websiteUrl"
              type="url"
              placeholder="https://yourstore.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
            <p className="text-xs text-zinc-500">
              A &quot;Visit Store&quot; button will appear on your dashboard linking to this URL.
            </p>
          </div>
        </div>

        {feedback && (
          <p className={`text-sm rounded-md px-3 py-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {feedback.message}
          </p>
        )}

        <Button onClick={handleSaveBranding} disabled={saving || uploading || !name.trim()}>
          {saving ? "Saving..." : "Save Branding"}
        </Button>
      </div>

    </div>
  );
}
