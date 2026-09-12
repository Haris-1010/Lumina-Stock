# Lumina Stock — Complete User Guide

> **Version:** 2.0 (Retail + Wholesale)  
> **Last updated:** April 2026

---

## Table of Contents

1. [What is Lumina Stock?](#1-what-is-lumina-stock)
2. [Getting Started — Sign Up & Business Type](#2-getting-started)
3. [Dashboard](#3-dashboard)
4. [Inventory](#4-inventory)
5. [Cashier (Point of Sale)](#5-cashier-point-of-sale)
6. [Sales History](#6-sales-history)
7. [Customers](#7-customers)
8. [Suppliers](#8-suppliers)
9. [Purchase Orders](#9-purchase-orders)
10. [Invoices](#10-invoices)
11. [Returns](#11-returns)
12. [Stock Adjustments](#12-stock-adjustments)
13. [Analytics](#13-analytics)
14. [Forecasts (AI)](#14-forecasts-ai)
15. [Dead Stock](#15-dead-stock)
16. [Expiry Tracking](#16-expiry-tracking)
17. [AI Assistant](#17-ai-assistant)
18. [Wholesale Dashboard](#18-wholesale-dashboard)
19. [Wholesale Orders](#19-wholesale-orders)
20. [Price Groups](#20-price-groups)
21. [Storefront](#21-storefront)
22. [Ad Promotions & Marketing](#22-ad-promotions--marketing)
23. [Settings](#23-settings)
24. [Recycle Bin](#24-recycle-bin)
25. [Real-World Use Cases](#25-real-world-use-cases)

---

## 1. What is Lumina Stock?

Lumina Stock is an **AI-powered inventory management system** built for businesses of all sizes — from a single retail shop to a wholesale distributor managing hundreds of B2B customers. It combines:

- **Real-time inventory tracking** — always know exactly what you have in stock
- **Point-of-sale cashier** — sell directly to walk-in customers
- **Wholesale order management** — handle bulk B2B orders with approval workflows
- **AI forecasting** — predict what will run out before it happens
- **Financial tools** — invoices, purchase orders, and payment tracking
- **Multi-language support** — full Urdu (RTL) and English interfaces

### Who is it for?

| Business Type | How They Use It |
|---|---|
| **Retail shop** | POS cashier, daily sales, customer loyalty, stock alerts |
| **Wholesale distributor** | B2B orders, price tiers, credit limits, bulk invoicing |
| **Hybrid (Retail + Wholesale)** | Switch modes from the sidebar — full access to both |
| **Pharmacy / Grocery** | Expiry tracking, reorder alerts, dead stock detection |
| **Clothing / Electronics store** | SKU management, return processing, dead stock recovery |

---

## 2. Getting Started

### Sign-Up Flow

When you create an account you go through **3 steps**:

#### Step 1 — Choose a Plan
| Plan | Best For | Price |
|---|---|---|
| **Starter (Free)** | Solo operators, testing the system | Free |
| **Pro** | Growing businesses needing AI + analytics | $29/mo |
| **Enterprise** | Large operations needing audit logs + platform control | $99/mo |

> **Tip:** Start on Free to learn the system. Upgrade when you need AI forecasting, purchase orders, or more than 100 products.

#### Step 2 — Choose Your Business Type

This shapes which features and sidebar navigation you see:

- **Retail** — You sell directly to end customers (walk-ins, online orders). You get the POS cashier, sales history, and retail analytics.
- **Wholesale** — You sell in bulk to other businesses. You get wholesale order management, price groups, credit limits, and B2B dashboards.
- **Both** — You do both. A **mode switcher** appears in the sidebar footer — tap it to switch between Retail and Wholesale views instantly.

> **Real scenario:** Ahmed runs a clothing store that also sells bulk to smaller shops. He chooses "Both", so on weekday mornings he switches to Wholesale to process B2B orders, and in the evening he switches back to Retail for walk-in customers.

#### Step 3 — Account Details
Fill in your name, email, password, and business name. Your subdomain (e.g. `ahmed-clothes.luminastocks.com`) is auto-generated from your business name — you can customize it.

---

## 3. Dashboard

### What It Does
The Dashboard is your **mission control** — a live snapshot of your business health loaded the moment you log in.

### What You See
- **Revenue this week/month** — total sales amount
- **Units sold** — how many items have been sold
- **Low stock alerts** — products falling below their reorder point
- **Recent sales** — the last few transactions
- **Top selling products** — what's moving fastest
- **Stock value** — total value of your current inventory

### Real-World Scenario

> **Sara** opens Lumina Stock every morning before her pharmacy opens. The Dashboard immediately shows her:
> - 3 products are low on stock (highlighted in amber)
> - Yesterday's revenue was PKR 45,000
> - "Panadol Extra" is her top seller this week
> 
> In under 30 seconds she knows exactly what needs attention before the shop opens.

### Tips
- **Wholesale Dashboard** is a separate page (sidebar → Wholesale Dashboard) with B2B-specific metrics: pending approvals, outstanding balances, top wholesale customers.
- Dashboard cards are live — refresh the page to get the latest numbers.
- Click any low-stock alert to jump directly to that product.

---

## 4. Inventory

### What It Does
Inventory is your **product master list** — every item you stock lives here. You create, edit, search, and organize products from this page.

### Key Fields Per Product

| Field | What It Means |
|---|---|
| **SKU** | Unique product code (e.g. `SHIRT-RED-L`) |
| **Category** | Group products (e.g. Electronics, Clothing, Medicine) |
| **Cost Price** | What you paid the supplier |
| **Selling Price** | What you charge retail customers |
| **Wholesale Price** | What you charge wholesale customers (optional) |
| **Current Stock** | Units currently in stock |
| **Reorder Point** | Alert threshold — get notified when stock drops below this |
| **Lead Time (days)** | How long it takes your supplier to restock |
| **Min Order Qty** | Minimum units a wholesale customer must order |
| **Expiry Date** | For perishable goods |

### Real-World Scenarios

**Scenario A — Retail electronics store:**
> Bilal adds a product: Samsung Galaxy A35 (SKU: `SAM-A35`, Category: Smartphones, Cost: PKR 45,000, Selling: PKR 55,000, Reorder Point: 5). When stock drops to 5 units, he automatically gets an alert to reorder.

**Scenario B — Wholesale medicines:**
> A distributor adds "Paracetamol 500mg" with Wholesale Price: PKR 800/box, Min Order Qty: 10 boxes. When a pharmacy orders via Wholesale Orders, they see this price automatically.

**Scenario C — CSV import for 500 products:**
> Instead of adding one by one, download the CSV template, fill it with all products in Excel, and upload. All 500 products are imported in seconds.

### Tips
- Use the **filter by category** to quickly find products in a busy inventory.
- **Soft delete** (Recycle Bin) means deleting a product doesn't erase its sales history — it just hides it.
- Products with `isPublic = true` appear on your **Storefront** (online shop).
- Set accurate **Lead Time** values — the AI Forecast uses them to predict when to order.

---

## 5. Cashier (Point of Sale)

### What It Does
The Cashier is your **walk-in sales screen** — add items to a cart, apply discounts, take payment, and print a receipt. It works completely **offline** (if internet drops during a sale, the transaction is saved locally and synced when back online).

### Step-by-Step: Completing a Sale

1. **Search for a product** — type the name or SKU in the product search box
2. **Add to cart** — click `+` to add it
3. **Set quantity** — adjust in the cart
4. **Set sale unit** — choose UNIT, DOZEN (×12 price), or KG (fractional weight)
5. **Apply discount** — enter a percentage in the discount column (e.g. 10% off for a loyal customer)
6. **Select customer** — pick from your customer list or leave as "Walk-in"
7. **Enter cash received** — change is calculated automatically
8. **Complete Sale & Print Receipt** — stock is deducted, sale is recorded

### Real-World Scenarios

**Scenario A — Quick sale:**
> A customer walks in and buys 2 bottles of shampoo and 1 soap. Zara searches "shampoo", adds 2, searches "soap", adds 1, enters PKR 500 cash, clicks Complete. The receipt prints with the shop logo and the customer's change (PKR 200).

**Scenario B — Loyal customer discount:**
> Regular customer Hassan comes in. Zara selects his name from the customer dropdown (so the sale is linked to his record), adds his items, then types "15" in the discount field on his favourite product. The receipt shows the original price, discount amount, and final price.

**Scenario C — Offline sale:**
> The internet goes down mid-day. Lumina Stock keeps working — sales are saved locally. When connectivity returns, all offline sales sync automatically to the server. The "pending sync" badge disappears from the header.

**Scenario D — Image scan:**
> Tap the camera icon. Point the phone at the product. The AI identifies it and adds it to the cart automatically — no typing needed.

### Tips
- The **Sales History tab** on the Cashier page shows today's transactions. Click any sale to reprint its receipt.
- Receipts include your **org logo, address, and phone** (set these in Settings).
- **Customer name on receipt** appears when you select a customer — useful for B2B receipts given to clients.
- If a product is out of stock, it won't appear in search results (prevents accidental overselling).

---

## 6. Sales History

### What It Does
A complete log of every sale ever made — searchable and filterable by date, customer, or product.

### Real-World Scenarios

**Scenario A — End of day audit:**
> At closing time, the owner filters Sales History by "Today" and checks that total sales match the cash in the register. Any discrepancy triggers an investigation.

**Scenario B — Customer dispute:**
> A customer claims they were overcharged on a sale last week. The manager searches by customer name, finds the transaction, and reprints the original receipt to verify.

**Scenario C — Product performance check:**
> The owner wants to know how many units of "Product X" were sold last month. Filter by product name and date range — the total quantity and revenue appear instantly.

### Tips
- **Export** sales data to CSV for accounting software.
- Sales are soft-deleted (moved to Recycle Bin) — you can recover accidentally deleted sales.
- Sales linked to wholesale customers are separate from wholesale orders — retail cashier sales stay here even if the customer is a wholesale account.

---

## 7. Customers

### What It Does
A database of all your customers — both retail and wholesale. Track who buys from you, how much they owe, their contact info, and their purchase history.

### Customer Fields

| Field | Purpose |
|---|---|
| **Name** | Contact person's full name |
| **Company Name** | For wholesale customers (e.g. "Al-Noor Pharmacy") |
| **Email / Phone** | Contact details for follow-up |
| **Credit Limit** | Maximum amount they can owe you (wholesale) |
| **Payment Terms** | Net 30, Net 60, etc. (days to pay invoice) |
| **Price Group** | Wholesale discount tier (Gold, Silver, VIP) |
| **Customer Type** | RETAIL or WHOLESALE |
| **Tax Number** | NTN/STRN for formal B2B invoicing |

### Real-World Scenarios

**Scenario A — Retail loyalty tracking:**
> Ayesha visits the store regularly. Her record shows she's spent PKR 120,000 this year. The cashier sees this and offers her a loyalty discount. Her full purchase history is one click away.

**Scenario B — Wholesale B2B customer:**
> "City Medical Store" orders medicines every 2 weeks. Their record shows:
> - Company: City Medical Store
> - Credit Limit: PKR 500,000
> - Price Group: Gold (15% off)
> - Outstanding Balance: PKR 230,000 (orders delivered but not yet paid)
> 
> Before processing a new order, the sales manager checks the outstanding balance against the credit limit.

**Scenario C — Overdue payment follow-up:**
> The Customers page shows "New Hope Pharmacy" has exceeded their credit limit. The manager calls them using the phone number in their profile to arrange payment before approving a new order.

### Tips
- Filter by **Customer Type = WHOLESALE** to see only B2B accounts.
- Customers with a **Price Group** automatically get that discount when a wholesale order is created for them.
- **Credit Used** is tracked against Credit Limit — the system warns you when creating wholesale orders if the limit will be exceeded.
- Deleting a customer is soft — their sales history is preserved.

---

## 8. Suppliers

### What It Does
Track the businesses you **buy from**. Link suppliers to products and purchase orders so you always know your supply chain.

### Supplier Fields

| Field | Purpose |
|---|---|
| **Name** | Supplier / vendor name |
| **Contact / Email** | Who to call when you need to reorder |
| **Performance Rating** | 0–5 stars — your subjective score of their reliability |

### Real-World Scenarios

**Scenario A — Reorder time:**
> Stock of "Panadol Extra" drops below reorder point. The system shows the supplier linked to this product: "Pharma Distributors Ltd." The manager calls the contact number directly from Lumina and creates a Purchase Order.

**Scenario B — Comparing suppliers:**
> The owner is considering switching from Supplier A (rating: 2/5, always late) to Supplier B. They update performance ratings after each delivery. Over time, ratings guide future purchasing decisions.

**Scenario C — Products by supplier:**
> Before calling a supplier, filter Inventory by that supplier to see their full product list and current stock levels — so you can place a comprehensive order instead of multiple small ones.

---

## 9. Purchase Orders

### What It Does
Purchase Orders (POs) are formal orders you send to **your suppliers** to restock inventory. They create a paper trail, track delivery status, and automatically update stock when received.

### PO Workflow
```
DRAFT → SENT → PARTIALLY_RECEIVED → RECEIVED → CANCELLED
```

### Real-World Scenarios

**Scenario A — Routine restocking:**
> The AI Forecast flags that "Samsung Chargers" will run out in 8 days. The manager creates a PO for 50 units to supplier "Tech Imports Ltd" at PKR 800 each (cost: PKR 40,000). The PO status is set to SENT. When the shipment arrives 5 days later, they mark it RECEIVED — the 50 units are added to inventory automatically.

**Scenario B — Partial delivery:**
> An order for 100 units arrives with only 60 units (supplier was short-stocked). The manager marks the PO as PARTIALLY_RECEIVED, entering 60 as received quantity. The remaining 40 are tracked as outstanding and the supplier follows up.

**Scenario C — Cost tracking:**
> At month end, the owner views all received POs to calculate total inventory cost for that month — used for COGS (cost of goods sold) in accounting.

### Tips
- POs are linked to **Invoices** — after receiving a PO, generate an invoice from it to pay the supplier formally.
- **Offline POs** work the same as offline sales — queued locally and synced when online.
- Set **Lead Time** accurately on products; the AI uses it to tell you "order now or you'll run out."

---

## 10. Invoices

### What It Does
Invoices are **formal billing documents** sent to customers (Sales Invoices) or received from suppliers (Purchase Invoices). They track how much is owed and what has been paid.

### Invoice Statuses
| Status | Meaning |
|---|---|
| **DRAFT** | Created but not sent |
| **ISSUED** | Sent to the customer/supplier |
| **PARTIALLY_PAID** | Some payment received |
| **PAID** | Fully settled |
| **OVERDUE** | Past due date with unpaid balance |
| **CANCELLED** | Voided |

### Real-World Scenarios

**Scenario A — Monthly B2B billing:**
> At end of month, the wholesale manager creates invoices for all "DELIVERED" wholesale orders. Each invoice is emailed to the respective pharmacy/clinic. Payment terms are Net 30 — if not paid in 30 days, the invoice turns OVERDUE automatically.

**Scenario B — Supplier payment:**
> After receiving a PO from "Pharma Distributors", a Purchase Invoice is created for PKR 150,000 (30-day payment terms). When payment is made, the accounts team marks it PAID and records the transaction method (bank transfer).

**Scenario C — Customer dispute:**
> A customer says they already paid. The manager opens their invoice, checks the payment log — it shows a PKR 50,000 partial payment was recorded on a specific date by a specific team member. The remaining PKR 30,000 is still outstanding.

### Tips
- Invoices are linked to **Account Transactions** for full financial audit trails.
- The **Outstanding Balance** on each invoice = Total Amount − Paid Amount.
- You can accept payments by Cash, Bank Transfer, JazzCash, EasyPaisa, or Stripe.

---

## 11. Returns

### What It Does
Process product returns from customers — reverse a sale, restock inventory, and optionally issue a refund.

### Real-World Scenarios

**Scenario A — Defective product:**
> A customer returns a defective phone charger bought 3 days ago. The cashier finds the original sale in Returns, selects the charger, marks reason as "Defective", and processes the return. The charger is restocked and a refund receipt is generated.

**Scenario B — Wrong item:**
> A wholesale customer received the wrong variant of a product. The sales manager processes the return for that order line. Stock is updated and the invoice balance is adjusted.

### Tips
- Returns automatically add stock back to inventory.
- Returns are linked to the original sale for accurate financial reporting.
- Returns don't appear in Sales History as a new sale — they reduce the original sale's contribution to revenue reports.

---

## 12. Stock Adjustments

### What It Does
Manually correct stock levels — useful for stocktakes, damages, theft, or errors discovered during physical counts.

### When to Use

| Situation | Adjustment Type |
|---|---|
| Physical count shows more than system | **Add** (surplus found) |
| Physical count shows less than system | **Subtract** (loss/theft/damage) |
| Product damaged in warehouse | **Subtract** with note "water damage" |
| Stock found in backroom | **Add** with note "backroom count" |
| Opening stock when first setting up | **Add** to bring system in line |

### Real-World Scenario

> **Monthly stocktake at a grocery store:**  
> The manager counts all physical stock over a weekend. On Monday, they open Adjustments and compare system quantities vs physical counts for each item:
> - Milk (system: 45, physical: 43) → Subtract 2 with note "expired, discarded"
> - Biscuits (system: 100, physical: 108) → Add 8 with note "found in storage room"
> 
> All adjustments are logged with timestamp and reason — perfect for audit trails.

### Tips
- Every adjustment creates an **Inventory Log** entry — you can always trace who changed what and when.
- Run a **stocktake** quarterly (or monthly for high-value items).
- Adjustments appear in Analytics as "MANUAL" change type, separate from SALE/RESTOCK entries.

---

## 13. Analytics

### What It Does
Visualises your business performance through charts, tables, and KPIs. Answers questions like "which products are most profitable?", "which day do I sell most?", and "how is this month vs last month?".

### Key Reports Available
- **Revenue over time** — daily/weekly/monthly revenue trend
- **Top products by revenue** — what earns the most
- **Top products by units sold** — what moves fastest
- **Sales by category** — which category drives your business
- **Customer spending** — who your highest-value customers are
- **Inventory value trend** — your stock investment over time

### Real-World Scenarios

**Scenario A — Seasonal planning:**
> A clothing store owner views the monthly revenue chart and spots that sales spike every March (Eid season) and drop in July. He uses this to plan extra stock purchases in February.

**Scenario B — Product pruning:**
> Analytics shows "Brand X Face Wash" has the lowest revenue-per-unit in the cosmetics category. The owner decides to discontinue it and replace it with a higher-margin product.

**Scenario C — Sales team performance:**
> A wholesale business filters sales by "cashier name" to see which team member closed the most sales last month — used for performance bonuses.

### Tips
- Combine Analytics with **Forecasts** — Analytics tells you what happened; Forecasts tells you what will happen.
- Export charts as images for business review presentations.
- Filter by **date range** (last 7 days, 30 days, custom) for precise analysis.

---

## 14. Forecasts (AI)

### What It Does
Uses AI to **predict future stock needs** based on your actual sales history. It tells you: "at the current rate, this product will run out in X days — order Y units by date Z."

### How It Works
1. The AI analyses your sales velocity (units sold per day/week) for each product
2. It factors in your set **Lead Time** (how many days until stock arrives after ordering)
3. It generates a "reorder now" list with recommended quantities and order-by dates

### Real-World Scenarios

**Scenario A — Pharmacy:**
> Forecasts shows "Augmentin 625mg" will run out in 6 days. Lead time from supplier is 4 days. System flags: "ORDER TODAY — you have a 2-day buffer." The pharmacist creates a PO immediately.

**Scenario B — Seasonal spike detection:**
> In October, the AI notices unusually high sales velocity for "Flu Medicine" — 3x higher than the 90-day average. It flags this as a potential seasonal spike and recommends ordering 2x the usual quantity.

**Scenario C — Over-stock detection:**
> Forecasts shows "Brand X Shoes (Size 12)" have enough stock for 180 days based on current sales rate. The owner stops reordering that SKU and considers a clearance sale to free up cash.

### Tips
- **Higher accuracy** comes from more sales history — the longer you use the system, the better the forecasts get.
- Adjust **Lead Time** per product for accurate order-by date calculations.
- Review forecasts **weekly** — market conditions change and the AI adapts.
- Forecasts are only available on **Pro** and **Enterprise** plans.

---

## 15. Dead Stock

### What It Does
Identifies products that have **not sold in a long time** — tying up cash and warehouse space. The AI categorises them by severity so you can take action.

### Dead Stock Categories
| Category | Meaning | Suggested Action |
|---|---|---|
| **Critical** | No sales in 180+ days | Urgent clearance or write-off |
| **Warning** | No sales in 90–180 days | Discount campaign or supplier return |
| **Watch** | No sales in 30–90 days | Monitor, consider small promotion |

### Real-World Scenarios

**Scenario A — Annual cleanup:**
> At year-end, the Dead Stock page shows PKR 380,000 worth of products haven't sold in over 90 days. The manager runs a "End of Season Sale" promotion, discounting dead stock by 40%. This recovers PKR 200,000 in cash and frees up shelf space.

**Scenario B — Wrong buying decision:**
> A "Smart TV Brand X" has been sitting unsold for 5 months. Dead Stock flags it as Critical. Investigation reveals the model was discontinued and customers prefer a newer version. The owner negotiates a return with the supplier.

**Scenario C — Monthly review:**
> Every first Monday of the month, the manager checks Dead Stock → Watch category. Any product that hasn't sold in 30 days gets a 10% shelf-edge discount before it moves to Warning.

### Tips
- **Dead stock = frozen cash.** PKR 1,000 sitting on a shelf unsold for 6 months is PKR 1,000 that could have been reinvested.
- Use dead stock data when negotiating **supplier return policies** — show them exact figures.
- Combine with **Ad Promotions** to run targeted discount campaigns for dead stock items.

---

## 16. Expiry Tracking

### What It Does
Monitors products with **expiry dates** — medicines, food, cosmetics. Alerts you before they expire so you can sell, return, or discard them in time.

### Alert Levels
| Alert | Timeframe |
|---|---|
| **Expired** | Past expiry date |
| **Critical** | Expires within 7 days |
| **Warning** | Expires within 30 days |
| **Upcoming** | Expires within 90 days |

### Real-World Scenarios

**Scenario A — Pharmacy compliance:**
> A pharmacy uses Expiry Tracking as their daily morning checklist. Any product expiring within 7 days is pulled from shelves immediately. This prevents selling expired medicines — both a legal and health risk.

**Scenario B — FEFO selling (First Expired, First Out):**
> A grocery store uses expiry dates to ensure older stock is sold first. When a product has multiple batches, the cashier is reminded to sell the one expiring soonest.

**Scenario C — Supplier return before expiry:**
> A cosmetics store notices 50 units of "SPF50 Sunscreen" expire in 25 days with no sales in sight. They contact the supplier and return 40 units under their return policy (most suppliers accept returns if 3+ weeks before expiry).

### Tips
- Set expiry dates when receiving stock via **Purchase Orders** — this automates tracking.
- Products with `expiresAt` set automatically appear in Expiry Tracking.
- Create an **Adjustment** entry when discarding expired products to keep stock counts accurate.

---

## 17. AI Assistant

### What It Does
A conversational AI chatbot that knows your entire inventory, sales, and business data. Ask it anything about your business in plain language (English or Urdu) and it responds with data-backed answers.

### What You Can Ask

**Inventory questions:**
- "Which products are running low on stock?"
- "What is the total value of my inventory?"
- "How many units of Panadol do I have?"

**Sales questions:**
- "What were my total sales today?"
- "Which product sold the most this week?"
- "How does this month compare to last month?"

**Business intelligence:**
- "Which customer has spent the most in the last 3 months?"
- "What is my most profitable product category?"
- "Show me all out-of-stock products"

**Actionable queries:**
- "Which products should I reorder this week?"
- "What is my slowest moving product?"
- "Which products expire in the next 30 days?"

### Real-World Scenarios

**Scenario A — Morning briefing:**
> The owner opens the AI Assistant on their phone before getting out of bed. They type: "Give me a summary of yesterday's business." The AI responds with: total sales amount, number of transactions, top 3 products sold, and any stock alerts.

**Scenario B — Customer visit preparation:**
> Before a meeting with a wholesale customer, the sales manager asks: "Show me all orders for City Medical Store in the last 6 months." The AI lists every order with dates and amounts — no manual report needed.

**Scenario C — Quick reorder decision:**
> A supplier calls asking if you need to reorder. The manager asks the AI: "Do I need to reorder anything from Pharma Distributors this week?" The AI cross-references current stock, sales velocity, and lead times, then gives a clear yes/no with specific product quantities.

### Tips
- The AI has access to **your organisation's data only** — it's private and secure.
- You can ask follow-up questions in the same conversation — the AI remembers context.
- The floating chat bubble (bottom right of every page) gives instant access without leaving your current page.
- Available on **Pro** and **Enterprise** plans.

---

## 18. Wholesale Dashboard

### What It Does
Your **B2B business overview** — a dedicated dashboard showing wholesale-specific metrics separate from your retail operations.

### What You See
- **Total wholesale orders** (all time)
- **Pending approval** — orders waiting for your sign-off (highlighted in amber if non-zero)
- **Total B2B revenue** (from delivered/invoiced orders)
- **Outstanding balance** — value of approved/processing/shipped orders not yet paid
- **Recent orders** — last 5 wholesale orders with status chips
- **Top customers** — your highest-spending wholesale accounts

### Real-World Scenario

> **Monday morning for a wholesale distributor:**
> Imran opens the Wholesale Dashboard first thing. He sees:
> - 3 orders are "Pending Approval" (amber alert) — he clicks through to review them
> - Outstanding balance is PKR 2.3 million — he cross-checks with Accounts
> - "Al-Noor Pharmacy" is his top customer this month
> - 2 orders are "Shipped" — he expects delivery confirmation today
> 
> The dashboard gives him a complete B2B status check in under 1 minute.

---

## 19. Wholesale Orders

### What It Does
Manages bulk B2B orders from creation through delivery. Each order has a formal **approval workflow** ensuring nothing ships without sign-off.

### Order Workflow
```
DRAFT → PENDING APPROVAL → APPROVED → PROCESSING → SHIPPED → DELIVERED → INVOICED
                         ↓
                      CANCELLED
```

| Status | Who Does What |
|---|---|
| **DRAFT** | Sales creates the order — not yet submitted |
| **PENDING APPROVAL** | Submitted for manager review |
| **APPROVED** | Manager has approved — ready to process |
| **PROCESSING** | Warehouse is picking/packing |
| **SHIPPED** | Dispatched to customer |
| **DELIVERED** | Customer has received |
| **INVOICED** | Invoice has been raised for payment |
| **CANCELLED** | Order rejected or abandoned |

### Creating a Wholesale Order

1. Click **New Order**
2. Select the **B2B customer** (their price group discount is auto-applied)
3. Search and add **products** — wholesale prices load automatically
4. Adjust **quantities** (minimum order quantity is enforced)
5. Set per-item **discount %** if needed on top of the price group discount
6. Add **notes** (delivery instructions, PO reference number)
7. **Save as Draft** (come back later) OR **Submit for Approval** (send to manager)

### Real-World Scenarios

**Scenario A — Standard B2B order:**
> Karachi General Store places a monthly order for cleaning supplies. The sales rep creates the order, selects the customer (they're in the "Silver" price group — 10% off), adds 20 products, and submits for approval. The manager reviews and approves. The warehouse packs and ships. When delivered, the manager marks it DELIVERED and raises an invoice for Net-30 payment.

**Scenario B — Negotiated deal:**
> A new pharmacy chain wants to try your products and negotiates an extra 5% discount on their first order. The sales rep creates the order, selects the customer (no price group yet), and manually sets 5% discount on each product line. After this trial goes well, they're added to a price group for future orders.

**Scenario C — Rejected order:**
> A customer submits an order but their outstanding balance already exceeds their credit limit. The manager reviews the Pending Approval order, sees the credit warning, and clicks Reject (→ CANCELLED). They contact the customer to settle the outstanding balance first.

### Tips
- The order form shows the customer's **credit used vs credit limit** — check before approving.
- **Price group discounts** are applied automatically when you select the customer — no manual calculation needed.
- Approved orders that change status to DELIVERED trigger a reminder to raise an invoice.
- All order history is preserved even for cancelled orders — useful for audit trails.

---

## 20. Price Groups

### What It Does
Defines **tiered wholesale pricing** — different customer segments get different discount levels automatically. Instead of negotiating prices on every order, you assign customers to a group and the discount applies everywhere.

### How It Works
1. Create a price group: **"Gold — 15% off"**
2. Assign wholesale customers to this group
3. When creating a wholesale order for a Gold customer, 15% is pre-applied to every item
4. You can still add per-item discounts on top (e.g. extra 5% on a specific product)

### Common Price Group Structures

| Group | Discount | Who Gets It |
|---|---|---|
| **Standard** | 5% | New wholesale customers |
| **Silver** | 10% | Regular accounts (buying 6+ months) |
| **Gold** | 15% | High-volume accounts |
| **Platinum / VIP** | 20%+ | Top 5–10 accounts |
| **Clearance** | 30% | For clearing specific overstock |

### Real-World Scenario

> **Medical supplies distributor:**
> 
> Ali manages 85 pharmacy accounts. Instead of setting prices individually, he creates 4 price groups:
> - Standard (5%): 40 small pharmacies
> - Silver (12%): 30 mid-size pharmacies  
> - Gold (18%): 12 hospital pharmacies
> - Platinum (25%): 3 large hospital chains
> 
> When "Central Hospital" (Platinum) places a wholesale order, the 25% discount applies automatically to every product. Ali can focus on the relationship, not the math.

### Tips
- Price groups apply to **wholesale prices** (not retail selling price).
- If a product has no wholesale price set, the price group discount applies to the **retail selling price**.
- You can always **override per item** on individual orders for special deals.
- Change a customer's price group at any time — it only affects future orders.

---

## 21. Storefront

### What It Does
Your **online shop** — a public-facing product catalogue where customers can browse and (if configured) place orders. Products marked `isPublic` in Inventory appear here.

### Real-World Scenario

> A home goods store marks their top 30 products as public. Customers scan a QR code on receipts that leads to the storefront. They can browse stock availability and call/WhatsApp to place orders. This acts as a digital catalogue without needing a separate website.

### Tips
- Mark products as **Public** in the Inventory edit screen to include them in the storefront.
- Upload your **organisation logo** and set your address/phone in Settings — these appear on the storefront header.
- Enable **WhatsApp integration** in Settings to add a WhatsApp chat button on the storefront.

---

## 22. Ad Promotions & Marketing

### What It Does
**Ad Promotions:** Plan and track your advertising campaigns (Facebook, Instagram, Google Ads) — track spend vs revenue to measure ROI.

**Marketing:** Organic marketing tools — social media scheduling, content planning, and integration with ReachFlow for automated outreach.

### Real-World Scenario

> A clothing retailer runs a Eid sale campaign. In Ad Promotions, they log a PKR 50,000 Facebook Ads spend. Over the campaign period, they compare that spend against the spike in sales revenue in Analytics. Result: PKR 320,000 in additional revenue = 6.4x return on ad spend. They increase the budget for next Eid.

---

## 23. Settings

### What It Does
Configure every aspect of your organization — branding, currency, team members, permissions, billing, API keys, and integrations.

### Key Settings Areas

#### Organisation Profile
- **Business name, logo, address, phone** — appear on receipts, invoices, and the storefront
- **Currency** — set once (e.g. PKR, USD, AED) — used everywhere
- **Theme colour** — changes the accent colour of the entire UI
- **WhatsApp number** — enables WhatsApp buttons on storefront

#### Team Members & Permissions
- Invite team members with **OWNER / ADMIN / MEMBER** roles
- **OWNER** — full access including billing and platform settings
- **ADMIN** — full operational access, no billing
- **MEMBER** — configurable — you choose exactly which pages and actions each member can access

**Scenario:** A shop owner has 3 cashiers. Each is added as MEMBER with only "Cashier" page access. They can process sales but can't see the Analytics, change prices, or delete inventory.

#### Custom Permissions (Per Employee)
Go to Settings → Team → click a member → toggle individual permissions:
- Can they see the Inventory page? ✓/✗
- Can they delete products? ✓/✗
- Can they process returns? ✓/✗
- Can they use the AI assistant? ✓/✗

This level of control means every employee sees only what they need.

#### Subscription / Billing
- View current plan, usage (products, team members, API calls)
- Upgrade/downgrade plan
- View payment history

#### API Keys
For developers who want to integrate Lumina Stock with other systems (e.g. ERP, accounting software). Create keys with names like "Accounting Integration" and revoke them when no longer needed.

---

## 24. Recycle Bin

### What It Does
A **safety net** for deleted records — products, sales, customers, and suppliers that have been deleted are moved here first. You can restore them with one click, or permanently delete them.

### Real-World Scenarios

**Scenario A — Accidental deletion:**
> A team member accidentally deletes the wrong product. The manager opens Recycle Bin, finds it, and clicks Restore. All sales history linked to that product is intact — nothing was lost.

**Scenario B — Permanent cleanup:**
> At year-end, the manager reviews the Recycle Bin. Products that were discontinued 2 years ago and have no active links are permanently deleted to clean up the database.

### Tips
- Items in Recycle Bin **don't count** toward your plan limits (products/customers).
- Items are kept in Recycle Bin indefinitely until you permanently delete them.
- Permanently deleted records **cannot be recovered** — use with caution.

---

## 25. Real-World Use Cases

### Use Case 1 — Small Retail Shop (Clothing / Grocery)

**Profile:** Single owner, 1–2 cashiers, 50–500 products, walk-in customers only.

**Daily workflow:**
1. Open **Dashboard** — check low stock alerts and yesterday's revenue
2. Use **Cashier** throughout the day for all sales
3. End of day: review **Sales History** for the day's transactions
4. Weekly: check **Dead Stock** to identify slow movers for discounting
5. Monthly: check **Forecasts** for reorder recommendations → create **Purchase Orders**
6. Ask the **AI Assistant**: "What are my top 5 selling products this month?"

**Most valuable pages:** Cashier, Dashboard, Forecasts, Dead Stock

---

### Use Case 2 — Wholesale/Distribution Business

**Profile:** 5–20 staff, 200–2,000 products, 20–100 B2B customers, large order volumes.

**Daily workflow:**
1. Open **Wholesale Dashboard** — check pending approvals and outstanding balances
2. Review **Wholesale Orders** in PENDING_APPROVAL — approve or reject
3. Update order statuses as shipments go out (PROCESSING → SHIPPED → DELIVERED)
4. Create **Invoices** for DELIVERED orders at end of week
5. Weekly: review **B2B Customers** — chase overdue payments
6. Monthly: review **Price Groups** — consider moving loyal customers to better tiers

**Most valuable pages:** Wholesale Dashboard, Wholesale Orders, Customers, Invoices, Price Groups

---

### Use Case 3 — Pharmacy / Medical Supplies

**Profile:** Strict expiry tracking, regulatory compliance, mix of retail walk-ins and B2B hospital accounts.

**Daily workflow:**
1. **Expiry Tracking** — pull any Critical (expiring within 7 days) items from shelves
2. **Cashier** — retail customers throughout the day
3. **Wholesale Orders** — hospital and clinic orders (B2B)
4. Weekly: **Forecasts** — medicines run out fast; weekly ordering is critical
5. Monthly: **Adjustments** — stocktake, discard expired items

**Most valuable pages:** Expiry Tracking, Cashier, Forecasts, Wholesale Orders, Purchase Orders

---

### Use Case 4 — Electronics / High-Value Retail

**Profile:** Expensive SKUs, serial number tracking, returns are common, warranty tracking matters.

**Daily workflow:**
1. **Cashier** — detailed receipts with customer name for warranty purposes
2. **Returns** — process warranty returns, restock refurbished items
3. **Adjustments** — damage or theft adjustments with notes
4. **Inventory** — detailed product descriptions and supplier links
5. **Invoices** — formal invoicing for business clients buying in quantity

**Most valuable pages:** Cashier, Returns, Inventory, Invoices, Analytics

---

### Use Case 5 — Hybrid Business (Retail + Wholesale)

**Profile:** Sells to walk-in customers AND wholesale to smaller retailers/businesses.

**Setup:**
- During signup: choose **"Both"** as Business Type
- A **mode switcher** appears in the sidebar footer

**Workflow:**
- **Mornings (Wholesale mode):** Process B2B orders from last night, approve orders, update shipment statuses, check outstanding balances
- **Afternoons (Retail mode):** Walk-in customers served via Cashier, retail sales recorded
- **Shared:** Inventory, Suppliers, and Purchase Orders are visible in both modes — stock is unified

**Pro tip:** Give your wholesale team MEMBER access with only Wholesale pages enabled. Give your retail cashiers access to only the Cashier page. The owner can see everything in both modes.

---

## Quick Reference Card

| I want to… | Go to… |
|---|---|
| Sell to a walk-in customer | Cashier |
| Process a bulk B2B order | Wholesale Orders → New Order |
| See how much I earned today | Dashboard or Sales History |
| Know what to reorder | Forecasts |
| Find products about to expire | Expiry Tracking |
| See what's not selling | Dead Stock |
| Add/edit products | Inventory |
| Create a supplier invoice | Invoices |
| Order stock from supplier | Purchase Orders |
| Handle a customer return | Returns |
| Fix incorrect stock count | Adjustments |
| Check B2B outstanding payments | Wholesale Dashboard or Customers |
| Set wholesale pricing tiers | Price Groups |
| Ask any business question | AI Assistant |
| Restore a deleted item | Recycle Bin |
| Add a team member | Settings → Team |

---

*Lumina Stock — Built to help businesses grow, not just track inventory.*
