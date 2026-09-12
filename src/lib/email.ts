import "server-only";

/**
 * Email utility — sends transactional emails via SMTP.
 * Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.
 * Gracefully skips sending when not configured (logs a warning instead).
 */

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!isEmailConfigured()) {
    // Not configured — log and skip silently so the app works without email setup
    console.warn(
      "[email] SMTP not configured — skipping email to",
      payload.to,
      "|",
      payload.subject
    );
    return false;
  }

  try {
    // Dynamic import so nodemailer is only loaded when needed
    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? `"Lumina Stock" <${process.env.SMTP_USER}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html.replace(/<[^>]+>/g, " ").trim(),
    });

    return true;
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return false;
  }
}

// ──────────────────────────────────────────
// Email templates
// ──────────────────────────────────────────

export function buildWelcomeEmailHtml(params: {
  userName: string;
  orgName: string;
  loginUrl: string;
}): string {
  const { userName, orgName, loginUrl } = params;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Welcome to Lumina Stock</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#059669,#047857);padding:32px;">
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;">✦ Lumina Stock</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Smart Inventory Management</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#111827;margin:0 0 8px;font-size:20px;">Welcome aboard, ${userName}!</h2>
      <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Your organization <strong style="color:#111827;">${orgName}</strong> has been created and is ready to go.</p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="color:#166534;font-weight:600;margin:0 0 12px;font-size:14px;">What you can do with your Starter plan:</p>
        <ul style="color:#166534;margin:0;padding-left:20px;font-size:13px;line-height:1.8;">
          <li>Add up to 100 products to your inventory</li>
          <li>Use the Cashier / Point of Sale module</li>
          <li>Track stock levels and get low-stock alerts</li>
          <li>Detect dead stock in your inventory</li>
          <li>Generate QR codes for your products</li>
          <li>Access via REST API (2 keys, 10 req/min)</li>
        </ul>
      </div>

      <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">Click the button below to log in to your dashboard and get started:</p>

      <a href="${loginUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Go to My Dashboard →</a>

      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f0f0f0;">
        <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;">Need more products, AI assistant, or team members?</p>
        <p style="color:#9ca3af;font-size:12px;margin:0;">Upgrade to <strong>Pro ($29/mo)</strong> or <strong>Enterprise ($99/mo)</strong> from your Settings page anytime.</p>
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">You received this because you signed up for Lumina Stock.</p>
    </div>
  </div>
</body>
</html>`;
}


export function buildLowStockEmailHtml(params: {
  orgName: string;
  items: Array<{ name: string; sku: string; currentStock: number; reorderPoint: number }>;
  language: "en" | "ur";
}): string {
  const { orgName, items, language } = params;
  const isUrdu = language === "ur";

  const title = isUrdu ? "کم اسٹاک الرٹ" : "Low Stock Alert";
  const greeting = isUrdu
    ? `${orgName} کی ٹیم کو سلام،`
    : `Hello ${orgName} team,`;
  const intro = isUrdu
    ? "درج ذیل مصنوعات کا اسٹاک ری آرڈر پوائنٹ سے نیچے آ گیا ہے:"
    : "The following products have fallen below their reorder points:";
  const action = isUrdu
    ? "فوری پرچیز آرڈر بنائیں تاکہ اسٹاک آؤٹ سے بچا جا سکے۔"
    : "Please create a purchase order to avoid stockouts.";
  const footer = isUrdu ? "لومینا اسٹاک" : "Lumina Stock";

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${item.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-family:monospace;">${item.sku}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#dc2626;font-weight:600;">${item.currentStock}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${item.reorderPoint}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">⚠️ ${title}</h1>
      <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px;">${orgName}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#374151;margin:0 0 16px;">${greeting}</p>
      <p style="color:#374151;margin:0 0 20px;">${intro}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#fef3c7;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#92400e;">${isUrdu ? "مصنوع" : "Product"}</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#92400e;">SKU</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#92400e;">${isUrdu ? "موجودہ اسٹاک" : "Current Stock"}</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#92400e;">${isUrdu ? "ری آرڈر پوائنٹ" : "Reorder Point"}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#374151;margin:20px 0 0;padding-top:16px;border-top:1px solid #f0f0f0;">${action}</p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by ${footer}</p>
    </div>
  </div>
</body>
</html>`;
}

export function buildStockoutEmailHtml(params: {
  orgName: string;
  items: Array<{ name: string; sku: string }>;
  language: "en" | "ur";
}): string {
  const { orgName, items, language } = params;
  const isUrdu = language === "ur";

  const title = isUrdu ? "اسٹاک آؤٹ الرٹ — فوری توجہ درکار!" : "Stockout Alert — Immediate Action Required!";

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${item.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-family:monospace;">${item.sku}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:24px 32px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">🚨 ${title}</h1>
      <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px;">${orgName}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#374151;margin:0 0 20px;">${isUrdu ? "درج ذیل مصنوعات کا اسٹاک صفر ہو گیا ہے:" : "The following products are completely out of stock:"}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#fee2e2;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#991b1b;">${isUrdu ? "مصنوع" : "Product"}</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#991b1b;">SKU</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#dc2626;font-weight:600;margin:20px 0 0;padding-top:16px;border-top:1px solid #fee2e2;">${isUrdu ? "فوری پرچیز آرڈر بنائیں!" : "Create a purchase order immediately!"}</p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Powered by Lumina Stock</p>
    </div>
  </div>
</body>
</html>`;
}
