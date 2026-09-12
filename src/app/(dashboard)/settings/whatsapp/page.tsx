"use client";

import { useState, useEffect } from "react";
import {
  MessageCircle, CheckCircle2, AlertTriangle, Loader2,
  ExternalLink, Phone, Zap, Bot, Bell, FileText, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getWhatsAppSettingsForCurrentOrganization,
  saveWhatsAppSettingsForCurrentOrganization,
  sendWhatsAppTestMessageForCurrentOrganization,
} from "@/lib/actions/whatsapp-settings";

const CAPABILITIES = [
  { icon: Bell, label: "Low-stock & stockout alerts", desc: "Instant WhatsApp notifications when inventory runs critical" },
  { icon: Bot, label: "AI Assistant via WhatsApp", desc: "Message your AI inventory assistant directly from WhatsApp" },
  { icon: FileText, label: "Send invoices & payslips", desc: "Ask the bot to send the latest invoice or payment for any customer" },
  { icon: MessageCircle, label: "Inventory queries", desc: "\"How many units of X do I have?\" — answered instantly" },
];

const SETUP_STEPS = [
  {
    num: 1,
    title: "Create a Meta App",
    body: "Go to developers.facebook.com → Create App → Business → Add WhatsApp product.",
  },
  {
    num: 2,
    title: "Get API credentials",
    body: "In your Meta App → WhatsApp → API Setup: copy the Phone Number ID and generate a permanent System User access token.",
  },
  {
    num: 3,
    title: "Add env vars to Vercel",
    body: "In your Vercel project settings add: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN (any secret string you choose).",
  },
  {
    num: 4,
    title: "Register the webhook",
    body: "In Meta App → WhatsApp → Configuration, set the webhook URL to: https://your-domain.com/api/whatsapp/webhook and enter the same WHATSAPP_VERIFY_TOKEN.",
  },
  {
    num: 5,
    title: "Enter your phone & test",
    body: "Enter your WhatsApp number below and click Send Test Message to verify everything works.",
  },
];

export default function WhatsAppSettingsPage() {
  const [phone, setPhone] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    getWhatsAppSettingsForCurrentOrganization().then((data) => {
      if ("error" in data) return;
      setPhone(data.whatsappPhone ?? "");
      setEnabled(data.whatsappEnabled);
      setApiConfigured(data.apiConfigured);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    const res = await saveWhatsAppSettingsForCurrentOrganization({ phone, enabled });
    setResult(res.error ? { type: "error", message: res.error } : { type: "success", message: "Settings saved." });
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    const res = await sendWhatsAppTestMessageForCurrentOrganization();
    setResult(res.error ? { type: "error", message: res.error } : { type: "success", message: "Test message sent! Check your WhatsApp." });
    setTesting(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-emerald-500" />
          WhatsApp Integration
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Receive important notifications and control your AI assistant directly from WhatsApp.
        </p>
      </div>

      {/* API status banner */}
      {!loading && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
          apiConfigured
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
            : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
        }`}>
          {apiConfigured
            ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          }
          <div>
            {apiConfigured
              ? <p><strong>API credentials found.</strong> Your WhatsApp Business API is configured.</p>
              : <>
                  <p><strong>API credentials not configured.</strong> Add the environment variables in Vercel to enable sending messages.</p>
                  <p className="mt-1 text-xs opacity-80">Required: WHATSAPP_PHONE_NUMBER_ID · WHATSAPP_ACCESS_TOKEN · WHATSAPP_VERIFY_TOKEN</p>
                </>
            }
          </div>
        </div>
      )}

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-zinc-400" />
            What you can do
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3 rounded-lg border border-zinc-100 dark:border-zinc-800 p-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{label}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* WhatsApp commands */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-zinc-400" />
            Available WhatsApp Commands
          </CardTitle>
          <CardDescription>Send any of these to your business number from your WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {[
              ["help", "Show the command menu"],
              ["low stock", "List items below reorder point"],
              ["inventory summary", "Stock count overview"],
              ["send invoice [number or name]", "Get invoice details + PDF link"],
              ["send payslip for [customer name]", "Latest paid invoice for that person"],
              ["Any question", "AI answers in plain English"],
            ].map(([cmd, desc]) => (
              <div key={cmd} className="flex items-start gap-4 px-3 py-2.5">
                <code className="text-xs font-mono text-emerald-700 dark:text-emerald-400 whitespace-nowrap flex-shrink-0">{cmd}</code>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Phone number settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-zinc-400" />
            Your WhatsApp Number
          </CardTitle>
          <CardDescription>
            This is the number that will receive notifications and can send commands to the AI assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Phone Number (international format, without +)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm text-zinc-400 font-mono px-3 py-2 rounded-l-lg border border-r-0 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">+</span>
                  <input
                    type="tel"
                    className="flex-1 rounded-r-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    placeholder="923001234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Include country code. Example: 923001234567 for Pakistan (+92 300 1234567)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => setEnabled((v) => !v)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    enabled ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <span className="text-sm text-zinc-600 dark:text-zinc-300">
                  {enabled ? "WhatsApp notifications enabled" : "WhatsApp notifications disabled"}
                </span>
              </div>

              {result && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  result.type === "success"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                }`}>
                  {result.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {result.message}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  {saving ? "Saving…" : "Save Settings"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !phone}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <MessageCircle className="h-3.5 w-3.5 mr-1" />}
                  {testing ? "Sending…" : "Send Test Message"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Setup guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-zinc-400" />
            Setup Guide
          </CardTitle>
          <CardDescription>First time? Follow these 5 steps to connect WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SETUP_STEPS.map((step) => (
            <div key={step.num} className="flex gap-3">
              <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 mt-0.5">
                {step.num}
              </span>
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{step.title}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{step.body}</p>
              </div>
            </div>
          ))}

          <div className="pt-2">
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:underline dark:text-emerald-400"
            >
              <ExternalLink className="h-3 w-3" />
              Meta WhatsApp Cloud API — Getting Started
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
