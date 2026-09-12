/**
 * Lumina Stock — Demo Seed Script
 *
 * Creates a fully-populated demo organization with realistic sample data.
 * Run: npm run db:seed
 *
 * Demo credentials:
 *   Email:    demo@lumina.com
 *   Password: DemoPassword123
 *
 * WARNING: This ONLY touches the demo organization. It will NOT delete any
 * real tenant data. If the demo org already exists it is re-created cleanly.
 */

import { config } from "dotenv";
config({ path: ".env.local", override: true });
config({ path: ".env" });
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@lumina.com";
const DEMO_PASSWORD = "DemoPassword123";
const DEMO_ORG_NAME = "Lumina Demo Store";

const categories = ["Electronics", "Accessories", "Peripherals", "Audio", "Storage"];

const productNames: Record<string, string[]> = {
  Electronics: [
    "ProBook Laptop 15\"",
    "SlimBook Air 13\"",
    "NexPhone X500",
    "NexPhone Lite 8",
    "ProTab 10\" Tablet",
    "FitPulse Smartwatch 2",
    "ClearView HD Webcam",
    "VisionPro 24\" FHD Monitor",
    "SpeedWave AC1200 Router",
    "QuickCharge 65W USB-C Adapter",
  ],
  Accessories: [
    "USB-C to USB-A Cable 3m",
    "ProBook 15\" Sleeve Case",
    "JuiceBox 20,000mAh Power Bank",
    "HDMI 2.1 Cable 2m",
    "Mouse Pad XL Leather",
    "Laptop Stand Adjustable",
    "Screen Protector 15\"",
    "Anti-Glare Filter 24\"",
    "Cable Management Clips 50-Pack",
    "USB Hub 7-Port",
  ],
  Peripherals: [
    "ErgoClick Wireless Mouse",
    "TypeForce Mech TKL Keyboard",
    "Numpad USB Wired",
    "Barcode Scanner USB",
    "Fingerprint Reader USB",
    "Graphic Tablet A5",
    "Label Printer Thermal",
    "Receipt Printer 80mm",
    "Card Reader Multi-Format",
    "Drawing Stylus Active",
  ],
  Audio: [
    "SoundAir 3 TWS Earbuds",
    "BassMax Over-Ear Headphones",
    "BlastBox BT Speaker",
    "DeskMic USB Condenser",
    "Conference Speakerphone",
    "Headphone Amp USB",
    "Studio Monitor 5\"",
    "Soundbar Desktop 2.0",
    "Noise Canceling Earbuds Pro",
    "Gaming Headset 7.1",
  ],
  Storage: [
    "DataVault 2TB External HDD",
    "FlashRun 64GB USB Drive",
    "SpeedSSD 1TB Portable",
    "NAS Drive 4TB",
    "SD Card 128GB V30",
    "MicroSD 256GB A2",
    "M.2 SSD 512GB NVMe",
    "Raid Enclosure 2-Bay",
    "USB Flash 32GB 3-Pack",
    "Cloud Backup 1TB Key",
  ],
};

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

async function main() {
  console.log("🌱 Seeding Lumina Stock demo account...\n");

  // ── Clean up any existing demo org only ─────────────────────────────────
  const existingUser = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existingUser) {
    console.log("  ↻  Existing demo org found — cleaning up before re-seed...");
    await prisma.organization.delete({ where: { id: existingUser.organizationId } });
    console.log("  ✔  Old demo org removed\n");
  }

  // ── Organization ─────────────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      currencyCode: "PKR",
      subscriptionStatus: "PRO",
      niche: "electronics",
      theme: "emerald",
      layout: "list",
      onboardingComplete: true,
      // Demo runs both retail + wholesale so reviewers see every screen.
      businessType: "BOTH",
      activeMode: "RETAIL",
      storefrontEnabled: true,
    },
  });

  // ── Demo user ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email: DEMO_EMAIL,
      passwordHash,
      role: "OWNER",
      organizationId: org.id,
    },
  });

  console.log(`  ✔  Organization: ${org.name}`);
  console.log(`  ✔  User: ${user.email}`);

  // ── Suppliers ────────────────────────────────────────────────────────────
  const supplierData = [
    { name: "TechParts Global",   contact: "Ahmed Hassan",  email: "orders@techparts.example",    performanceRating: 4.7 },
    { name: "ElecSupply Co.",      contact: "Sara Malik",    email: "sales@elecsupply.example",    performanceRating: 4.2 },
    { name: "GadgetWholesale",    contact: "Tariq Yusuf",   email: "trade@gadgetwholesale.example", performanceRating: 3.9 },
    { name: "AudioDepot",         contact: "Nadia Farooq",  email: "orders@audiodepot.example",   performanceRating: 4.5 },
    { name: "StorageWorld",       contact: "Bilal Khan",    email: "bulk@storageworld.example",   performanceRating: 4.1 },
  ];

  const suppliers = await Promise.all(
    supplierData.map((s) =>
      prisma.supplier.create({ data: { ...s, organizationId: org.id } })
    )
  );

  console.log(`  ✔  ${suppliers.length} suppliers`);

  // ── Products (50 items across 5 categories) ──────────────────────────────
  const products = [];
  let skuCounter = 1001;

  const costRanges: Record<string, [number, number]> = {
    Electronics:  [80, 700],
    Accessories:  [5, 40],
    Peripherals:  [15, 120],
    Audio:        [18, 200],
    Storage:      [8, 120],
  };

  for (const [catIdx, category] of categories.entries()) {
    const names = productNames[category];
    const supplier = suppliers[catIdx % suppliers.length];
    const [costMin, costMax] = costRanges[category];

    for (const name of names) {
      const costPrice = randomFloat(costMin, costMax);
      const markup = randomFloat(1.45, 2.5);
      const sellingPrice = Math.round(costPrice * markup * 100) / 100;
      const currentStock = randomBetween(0, 150);

      const product = await prisma.product.create({
        data: {
          sku: `LSK-${skuCounter++}`,
          name,
          description: `${name} — premium quality for professional and everyday use.`,
          category,
          currentStock,
          costPrice,
          sellingPrice,
          leadTimeDays: randomBetween(3, 14),
          reorderPoint: randomBetween(5, 25),
          supplierId: supplier.id,
          organizationId: org.id,
        },
      });
      products.push(product);

      // Initial stock log
      if (currentStock > 0) {
        await prisma.inventoryLog.create({
          data: {
            organizationId: org.id,
            productId: product.id,
            changeType: "MANUAL",
            quantity: currentStock,
            note: "Opening stock",
          },
        });
      }
    }
  }

  console.log(`  ✔  ${products.length} products`);

  // ── Customers (retail + B2B wholesale) ───────────────────────────────────
  const retailCustomers = await Promise.all(
    [
      { name: "Ayesha Khan",  email: "ayesha.k@example.com", phone: "+92 300 1112233" },
      { name: "Bilal Ahmed",  email: "bilal.a@example.com",  phone: "+92 301 4455667" },
      { name: "Fatima Noor",  email: "fatima.n@example.com", phone: "+92 333 7788990" },
      { name: "Hassan Raza",  email: "hassan.r@example.com", phone: "+92 345 2233445" },
      { name: "Sana Tariq",   email: "sana.t@example.com",   phone: "+92 312 9988776" },
    ].map((c) =>
      prisma.customer.create({
        data: { ...c, customerType: "RETAIL", paymentTerms: 0, organizationId: org.id },
      })
    )
  );

  const b2bCustomers = await Promise.all(
    [
      { name: "Metro Electronics Ltd",   companyName: "Metro Electronics Ltd",   taxNumber: "NTN-4410921", email: "purchasing@metroelec.example", phone: "+92 21 35110011", creditLimit: 50000,  paymentTerms: 30 },
      { name: "CityTech Distributors",   companyName: "CityTech Distributors",   taxNumber: "NTN-7781245", email: "orders@citytech.example",     phone: "+92 42 35880022", creditLimit: 120000, paymentTerms: 45 },
      { name: "Gadget Bazaar Wholesale", companyName: "Gadget Bazaar (Pvt)",     taxNumber: "NTN-2230988", email: "buy@gadgetbazaar.example",    phone: "+92 51 28440033", creditLimit: 30000,  paymentTerms: 15 },
      { name: "PrimeRetail Chain",       companyName: "PrimeRetail Chain Ltd",   taxNumber: "NTN-9911234", email: "supply@primeretail.example",  phone: "+92 21 36770044", creditLimit: 200000, paymentTerms: 60 },
    ].map((c) =>
      prisma.customer.create({
        data: { ...c, customerType: "WHOLESALE", organizationId: org.id },
      })
    )
  );
  console.log(`  ✔  ${retailCustomers.length} retail + ${b2bCustomers.length} B2B customers`);

  // ── Sales orders (300 over last 12 months) ───────────────────────────────
  const now = new Date();

  for (let i = 0; i < 300; i++) {
    const daysAgo = randomBetween(0, 365);
    const orderDate = new Date(now.getTime() - daysAgo * 86_400_000);
    const numItems = randomBetween(1, 4);

    const usedIdx = new Set<number>();
    const selectedProducts = [];
    for (let j = 0; j < numItems; j++) {
      let idx: number;
      do { idx = randomBetween(0, products.length - 1); } while (usedIdx.has(idx));
      usedIdx.add(idx);
      selectedProducts.push(products[idx]);
    }

    const items = selectedProducts.map((p) => ({
      productId: p.id,
      quantity: randomBetween(1, 8),
      price: p.sellingPrice,
    }));

    const totalAmount = items.reduce((s, it) => s + it.quantity * it.price, 0);

    const orderCustomer =
      Math.random() < 0.6
        ? retailCustomers[randomBetween(0, retailCustomers.length - 1)]
        : null;

    await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-${String(i + 1001).padStart(5, "0")}`,
        date: orderDate,
        totalAmount: Math.round(totalAmount * 100) / 100,
        organizationId: org.id,
        customerId: orderCustomer?.id ?? null,
        items: { create: items },
      },
    });
  }

  console.log("  ✔  300 sales orders (12-month history)");

  // ── Purchase orders ───────────────────────────────────────────────────────
  const poStatuses = ["DRAFT", "ORDERED", "RECEIVED"];

  for (let i = 0; i < 15; i++) {
    const supplier = suppliers[i % suppliers.length];
    const status = poStatuses[i % 3];
    const daysAgo = randomBetween(0, 90);

    const numItems = randomBetween(2, 5);
    const usedIdx = new Set<number>();
    const poItems = [];
    for (let j = 0; j < numItems; j++) {
      let idx: number;
      do { idx = randomBetween(0, products.length - 1); } while (usedIdx.has(idx));
      usedIdx.add(idx);
      const p = products[idx];
      poItems.push({ productId: p.id, quantity: randomBetween(5, 30), cost: p.costPrice });
    }

    const totalCost = poItems.reduce((s, it) => s + it.quantity * it.cost, 0);

    await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${String(i + 2001).padStart(5, "0")}`,
        status,
        totalCost: Math.round(totalCost * 100) / 100,
        organizationId: org.id,
        supplierId: supplier.id,
        createdAt: new Date(now.getTime() - daysAgo * 86_400_000),
        items: { create: poItems },
      },
    });
  }

  console.log("  ✔  15 purchase orders");

  // ── Wholesale orders (B2B) ───────────────────────────
  const wsStatuses = [
    "APPROVED", "PROCESSING", "SHIPPED", "DELIVERED", "INVOICED", "PENDING_APPROVAL",
  ] as const;
  let wsCounter = 0;
  for (const cust of b2bCustomers) {
    for (let o = 0; o < randomBetween(2, 3); o++) {
      const numItems = randomBetween(2, 5);
      const usedIdx = new Set<number>();
      const wsItems = [];
      for (let j = 0; j < numItems; j++) {
        let idx: number;
        do { idx = randomBetween(0, products.length - 1); } while (usedIdx.has(idx));
        usedIdx.add(idx);
        const p = products[idx];
        const discountPct = 0;
        const quantity = randomBetween(10, 80);
        const unitPrice = p.sellingPrice;
        const lineTotal = Math.round(quantity * unitPrice * (1 - discountPct / 100) * 100) / 100;
        wsItems.push({ productId: p.id, quantity, unitPrice, discountPct, lineTotal });
      }
      const totalAmount = Math.round(wsItems.reduce((s, it) => s + it.lineTotal, 0) * 100) / 100;
      await prisma.wholesaleOrder.create({
        data: {
          orderNumber: `WS-${String(++wsCounter + 5000).padStart(5, "0")}`,
          status: wsStatuses[randomBetween(0, wsStatuses.length - 1)],
          totalAmount,
          organizationId: org.id,
          customerId: cust.id,
          createdAt: new Date(now.getTime() - randomBetween(0, 120) * 86_400_000),
          items: { create: wsItems },
        },
      });
    }
  }
  console.log(`  ✔  ${wsCounter} wholesale orders`);

  // ── Invoices (sales + purchase) with payments ────────────────────────────
  for (let i = 0; i < 24; i++) {
    const isSales = i % 2 === 0;
    const p = products[randomBetween(0, products.length - 1)];
    const qty = randomBetween(1, 10);
    const unit = isSales ? p.sellingPrice : p.costPrice;
    const subtotal = Math.round(qty * unit * 100) / 100;
    const totalAmount = subtotal;

    const roll = randomBetween(0, 3);
    let status: "PAID" | "PARTIALLY_PAID" | "ISSUED" | "OVERDUE" = "ISSUED";
    let paidAmount = 0;
    if (roll === 0) { status = "PAID"; paidAmount = totalAmount; }
    else if (roll === 1) { status = "PARTIALLY_PAID"; paidAmount = Math.round(totalAmount * 0.5 * 100) / 100; }
    else if (roll === 3) { status = "OVERDUE"; }

    const issueDate = new Date(now.getTime() - randomBetween(5, 120) * 86_400_000);
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${String(i + 9001).padStart(5, "0")}`,
        type: isSales ? "SALES" : "PURCHASE",
        status,
        issueDate,
        dueDate: new Date(issueDate.getTime() + 30 * 86_400_000),
        subtotal,
        totalAmount,
        paidAmount,
        balanceAmount: Math.round((totalAmount - paidAmount) * 100) / 100,
        currency: "USD",
        organizationId: org.id,
        createdByUserId: user.id,
        items: {
          create: [{
            description: p.name,
            quantity: qty,
            unitPrice: Math.round(unit * 100) / 100,
            lineTotal: subtotal,
            productId: p.id,
          }],
        },
      },
    });

    if (paidAmount > 0) {
      await prisma.invoicePayment.create({
        data: {
          amount: paidAmount,
          currency: "USD",
          method: "BANK_TRANSFER",
          gateway: "MANUAL",
          status: "COMPLETED",
          paidAt: new Date(issueDate.getTime() + randomBetween(1, 20) * 86_400_000),
          invoiceId: invoice.id,
          organizationId: org.id,
          createdByUserId: user.id,
        },
      });
    }
  }
  console.log("  ✔  24 invoices (+payments)");

  // ── Additional inventory logs (recent activity) ───────────────────────────
  for (let i = 0; i < 40; i++) {
    const product = products[randomBetween(0, products.length - 1)];
    const types = ["RESTOCK", "RETURN", "MANUAL"] as const;
    const changeType = types[randomBetween(0, types.length - 1)];
    await prisma.inventoryLog.create({
      data: {
        organizationId: org.id,
        productId: product.id,
        changeType,
        quantity: randomBetween(1, 30),
        note: changeType === "RESTOCK" ? "Supplier delivery" : changeType === "RETURN" ? "Customer return" : "Manual count adjustment",
        createdAt: new Date(now.getTime() - randomBetween(0, 30) * 86_400_000),
      },
    });
  }

  console.log("  ✔  40 inventory activity logs\n");
  console.log("════════════════════════════════════════");
  console.log("  ✅  Demo seed complete!");
  console.log("────────────────────────────────────────");
  console.log(`  Email    : ${DEMO_EMAIL}`);
  console.log(`  Password : ${DEMO_PASSWORD}`);
  console.log("════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
