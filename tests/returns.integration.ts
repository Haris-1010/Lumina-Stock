// Explicit local database integration check. Every fixture write is rolled back.
import "dotenv/config";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { recordReturn } from "../src/lib/record-return";
import { getSalesSummary } from "../src/lib/sales-summary";
import { getDashboardPeriod } from "../src/lib/dashboard-period";

async function main() {
  const rollback = new Error("ROLLBACK_TEST_FIXTURES");
  try {
    await db.$transaction(async tx => {
      const org = await tx.organization.findFirst({ select: { id: true } });
      assert.ok(org);
      const now = new Date();
      const ranges = ["daily", "weekly", "monthly"].map(p => getDashboardPeriod(p, now));
      const before = await Promise.all(ranges.map(r => getSalesSummary(org.id, r.start, now, tx)));
      const product = await tx.product.create({ data: { organizationId: org.id, sku: `RETURN-CHECK-${Date.now()}`, name: "Temporary return integration fixture", category: "Test", currentStock: 10, costPrice: 40, sellingPrice: 100 } });
      await tx.inventoryLog.create({data:{organizationId:org.id,productId:product.id,changeType:"RETURN",quantity:1,note:"CUSTOMER_RETURN|RESALEABLE|||RESTOCKED",createdAt:new Date(now.getTime()-86400000)}});
      const order = await tx.salesOrder.create({ data: { organizationId: org.id, orderNumber: `RETURN-CHECK-${Date.now()}`, date: now, totalAmount: 180, items: { create: { productId: product.id, quantity: 2, price: 100, metadata: { enteredQuantity: 2, saleUnit: "UNIT", discountPct: 10 } } } } });
      await tx.product.update({where:{id:product.id},data:{currentStock:{decrement:2}}});
      const sold = await getSalesSummary(org.id, ranges[0].start, new Date(), tx);
      assert.equal(Math.round((sold.netSales - before[0].netSales)*100),18000);
      await recordReturn(tx, org.id, { productId: product.id, quantity: 1, returnType: "CUSTOMER_RETURN", condition: "RESALEABLE", salesOrderId: order.id, requestId: "fixture-first" });
      const partial = await getSalesSummary(org.id,ranges[0].start,new Date(),tx);
      assert.equal(Math.round((partial.netSales-before[0].netSales)*100),9000);
      assert.equal((await tx.product.findUniqueOrThrow({where:{id:product.id}})).currentStock,9);
      // Original order/invoice basis stays intact; separate ledger explains the refund.
      assert.equal((await tx.salesOrder.findUniqueOrThrow({where:{id:order.id}})).totalAmount,180);
      await recordReturn(tx,org.id,{productId:product.id,quantity:1,returnType:"CUSTOMER_RETURN",condition:"RESALEABLE",salesOrderId:order.id,requestId:"fixture-second"});
      await recordReturn(tx,org.id,{productId:product.id,quantity:1,returnType:"CUSTOMER_RETURN",condition:"RESALEABLE",salesOrderId:order.id,requestId:"fixture-second"});
      for (let i=0;i<ranges.length;i++) {
        const after=await getSalesSummary(org.id,ranges[i].start,new Date(),tx);
        assert.equal(after.netSales,before[i].netSales,`${ranges[i].period}: fully returned sale contributes zero net revenue`);
        assert.equal(after.netUnits,before[i].netUnits,`${ranges[i].period}: fully returned sale contributes zero net units`);
      }
      assert.equal((await tx.product.findUniqueOrThrow({where:{id:product.id}})).currentStock,10);
      await assert.rejects(recordReturn(tx,org.id,{productId:product.id,quantity:1,returnType:"CUSTOMER_RETURN",condition:"RESALEABLE",salesOrderId:order.id,requestId:"fixture-overreturn"}),/exceeds/);
      await recordReturn(tx,org.id,{productId:product.id,quantity:2,returnType:"SUPPLIER_RETURN",condition:"RESALEABLE",requestId:"fixture-supplier"});
      assert.equal((await tx.product.findUniqueOrThrow({where:{id:product.id}})).currentStock,8);
      assert.equal((await getSalesSummary(org.id,ranges[0].start,new Date(),tx)).netSales,before[0].netSales);
      // A refund recorded tomorrow affects tomorrow, not today's completed period.
      await tx.inventoryLog.updateMany({where:{organizationId:org.id,productId:product.id,changeType:"RETURN"},data:{createdAt:new Date(now.getTime()+86400000)}});
      const today=await getSalesSummary(org.id,ranges[0].start,new Date(),tx);
      assert.equal(Math.round((today.netSales-before[0].netSales)*100),18000);
      console.log("PASS: new receipts with historical unlinked returns, persisted full/partial returns, discounts, daily/weekly/monthly totals, stock, duplicates, over-returns, supplier direction, and return-date boundaries.");
      throw rollback;
    },{isolationLevel:"Serializable",timeout:30000});
  } catch(error) { if(error!==rollback) throw error; }
  console.log("All database fixture changes rolled back.");
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
