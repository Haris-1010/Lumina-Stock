import { Badge } from "@/components/ui/badge";

function maskSecret(value: string | undefined) {
  if (!value) return "Not set";
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function PaymentGatewayIntegration({
  language,
  appUrl,
}: {
  language: "en" | "ur";
  appUrl: string;
}) {
  const jazzMerchantId = process.env.JAZZCASH_MERCHANT_ID?.trim();
  const jazzPassword = process.env.JAZZCASH_PASSWORD?.trim();
  const jazzSalt = process.env.JAZZCASH_INTEGRITY_SALT?.trim();

  const easyStoreId = process.env.EASYPAISA_STORE_ID?.trim();
  const easyHashKey = process.env.EASYPAISA_HASH_KEY?.trim();

  const jazzReady = Boolean(jazzMerchantId && jazzPassword && jazzSalt);
  const easyReady = Boolean(easyStoreId && easyHashKey);

  const baseUrl = appUrl.trim().replace(/\/$/, "");
  const jazzWebhook = baseUrl
    ? `${baseUrl}/api/webhooks/jazzcash`
    : "/api/webhooks/jazzcash";
  const easyWebhook = baseUrl
    ? `${baseUrl}/api/webhooks/easypaisa`
    : "/api/webhooks/easypaisa";

  const labels =
    language === "ur"
      ? {
          title: "JazzCash / EasyPaisa انٹیگریشن",
          desc: "اپنے مرچنٹ اکاؤنٹس کنیکٹ کریں تاکہ رقم موصول/ارسال ہونے کی اپڈیٹس سافٹ ویئر میں خودکار آئیں۔",
          connected: "Connected",
          setupRequired: "Setup Required",
          incoming: "موصولہ",
          outgoing: "ارسال",
          liveFeed: "Live Transaction Feed",
          liveFeedDesc: "ویب ہُک کنفیگر ہونے کے بعد ادائیگی ریکارڈز اور نوٹیفکیشنز خودکار اپڈیٹ ہوں گے۔",
          webhook: "Webhook URL",
          merchantId: "Merchant ID",
          storeId: "Store ID",
          keysHint: "Credentials کو environment variables میں سیٹ کریں: JAZZCASH_* اور EASYPAISA_*",
        }
      : {
          title: "JazzCash / EasyPaisa Integration",
          desc: "Connect your merchant accounts so received/sent amount updates flow directly into the software.",
          connected: "Connected",
          setupRequired: "Setup Required",
          incoming: "Incoming",
          outgoing: "Outgoing",
          liveFeed: "Live Transaction Feed",
          liveFeedDesc: "After webhook setup, payment records and notifications update automatically.",
          webhook: "Webhook URL",
          merchantId: "Merchant ID",
          storeId: "Store ID",
          keysHint: "Set credentials through environment variables: JAZZCASH_* and EASYPAISA_*",
        };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-zinc-600">{labels.desc}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-zinc-900">JazzCash</p>
            {jazzReady ? <Badge variant="success">{labels.connected}</Badge> : <Badge variant="warning">{labels.setupRequired}</Badge>}
          </div>
          <p className="mt-2 text-xs text-zinc-600">{labels.merchantId}: {maskSecret(jazzMerchantId)}</p>
          <p className="mt-1 text-xs text-zinc-600">{labels.webhook}: <span className="font-mono">{jazzWebhook}</span></p>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-zinc-900">EasyPaisa</p>
            {easyReady ? <Badge variant="success">{labels.connected}</Badge> : <Badge variant="warning">{labels.setupRequired}</Badge>}
          </div>
          <p className="mt-2 text-xs text-zinc-600">{labels.storeId}: {maskSecret(easyStoreId)}</p>
          <p className="mt-1 text-xs text-zinc-600">{labels.webhook}: <span className="font-mono">{easyWebhook}</span></p>
        </div>
      </div>

      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <p className="font-semibold text-emerald-900">{labels.liveFeed}</p>
        <p className="mt-1">{labels.liveFeedDesc}</p>
        <p className="mt-2 text-xs">
          {labels.incoming}: + | {labels.outgoing}: -
        </p>
      </div>

      <p className="text-xs text-zinc-500">{labels.keysHint}</p>
    </div>
  );
}
