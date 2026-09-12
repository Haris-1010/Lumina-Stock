"use client";

import { useEffect, useState } from "react";
import { QrCode, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useI18n } from "@/components/providers/i18n-provider";

interface ProductQRDialogProps {
  product: { id: string; sku: string; name: string } | null;
  onClose: () => void;
}

export function ProductQRDialog({ product, onClose }: ProductQRDialogProps) {
  const { language } = useI18n();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const labels = {
    title: language === "ur" ? "QR کوڈ" : "QR Code",
    description: language === "ur"
      ? "پرنٹ کریں یا ڈاؤن لوڈ کریں"
      : "Print or download this QR code for your shelf label",
    download: language === "ur" ? "ڈاؤن لوڈ" : "Download PNG",
    sku: language === "ur" ? "SKU:" : "SKU:",
    close: language === "ur" ? "بند کریں" : "Close",
  };

  useEffect(() => {
    if (!product) {
      setDataUrl(null);
      setError(false);
      return;
    }

    setDataUrl(null);
    setError(false);

    const text = `SKU:${product.sku}|${product.name}`;

    import("qrcode")
      .then((mod) => {
        const QRCode = mod.default ?? mod;
        return (QRCode as { toDataURL: (text: string, opts: object) => Promise<string> }).toDataURL(text, {
          width: 256,
          margin: 2,
          color: { dark: "#18181b", light: "#ffffff" },
          errorCorrectionLevel: "M",
        });
      })
      .then((url) => setDataUrl(url))
      .catch(() => setError(true));
  }, [product]);

  function handleDownload() {
    if (!dataUrl || !product) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${product.sku}.png`;
    a.click();
  }

  const qrReady = Boolean(dataUrl);

  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xs rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            {labels.title}
          </DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative flex h-[256px] w-[256px] items-center justify-center rounded-xl border-2 border-zinc-200 bg-white dark:border-zinc-700 shadow-sm overflow-hidden">
            {error ? (
              <p className="text-xs text-red-500 text-center px-4">
                {language === "ur" ? "QR کوڈ بنانے میں مسئلہ آیا۔" : "Failed to generate QR code."}
              </p>
            ) : dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} alt={`QR code for ${product?.sku}`} className="h-[240px] w-[240px]" />
            ) : (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-emerald-500" />
            )}
          </div>

          {product && (
            <div className="text-center">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{product.name}</p>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">{labels.sku} {product.sku}</p>
            </div>
          )}

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              {labels.close}
            </Button>
            <Button
              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleDownload}
              disabled={!qrReady}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {labels.download}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
