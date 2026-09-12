import { NextResponse } from "next/server";

export async function GET() {
  const csv = `sku,name,description,category,stock,cost_price,selling_price,lead_time,reorder_point
SKU-001,Wireless Mouse,Ergonomic wireless mouse,Electronics,150,12.50,29.99,5,20
SKU-002,USB-C Cable,1m braided USB-C cable,Accessories,300,3.00,9.99,3,50
SKU-003,Laptop Stand,Adjustable aluminum stand,Electronics,45,25.00,59.99,7,10
SKU-004,Desk Pad,Large leather desk pad,Office,200,8.00,24.99,4,30
SKU-005,Webcam HD,1080p HD webcam,Electronics,80,18.00,44.99,6,15`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=lumina-stock-sample.csv",
    },
  });
}
