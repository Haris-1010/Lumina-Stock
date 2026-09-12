import { NextRequest, NextResponse } from "next/server";

const REACHFLOW_BASE = process.env.REACHFLOW_BASE_URL ?? "http://localhost:4300";
const REACHFLOW_KEY = process.env.REACHFLOW_API_KEY ?? "";

async function proxy(req: NextRequest, params: Promise<{ route: string[] }>) {
  const { route } = await params;
  const path = route.join("/");
  const search = req.nextUrl.search;
  const url = `${REACHFLOW_BASE}/api/reachflow/${path}${search}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(REACHFLOW_KEY ? { Authorization: `Bearer ${REACHFLOW_KEY}` } : {}),
  };

  const body = req.method !== "GET" && req.method !== "HEAD"
    ? await req.text()
    : undefined;

  try {
    const res = await fetch(url, { method: req.method, headers, body });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "ReachFlow server unreachable" }, { status: 502 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  return proxy(req, params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  return proxy(req, params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  return proxy(req, params);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  return proxy(req, params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  return proxy(req, params);
}
