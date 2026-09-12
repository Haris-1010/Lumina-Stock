/**
 * adevolve/api/express.ts
 *
 * Express-specific adapters for AdEvolve.
 * Intentionally uses `any` for Express types so this file compiles even when
 * `express` is not installed (e.g. during a Next.js / Vercel build).
 *
 * Usage (Express app):
 *   import { createExpressRouter } from '@/adevolve/api/express';
 *   app.use('/api/adevolve', createExpressRouter());
 *
 * Usage (standalone server):
 *   STANDALONE=true node dist/adevolve/api/express.js
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HandlerRequest, HandlerResponse } from "../types";
import { router } from "./routes";
import { corsHeaders } from "./middleware";
import { defaultConfig } from "../adevolve.config";

export function createExpressRouter(): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require("express");
  const r = express.Router();

  const toHandlerReq = (req: any, params?: Record<string, string>): HandlerRequest => ({
    method: req.method,
    pathname: req.path,
    body: req.body,
    params: { ...(req.params as Record<string, string>), ...params },
    headers: req.headers as Record<string, string>,
  });

  const send = (res: any, result: HandlerResponse): void => {
    const cors = corsHeaders();
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
    res.status(result.status).json(result.body);
  };

  r.use(express.json());
  r.options("*", async (req: any, res: any) => send(res, await router(toHandlerReq(req))));
  r.post("/validate", async (req: any, res: any) => send(res, await router(toHandlerReq(req))));
  r.post("/optimize", async (req: any, res: any) => send(res, await router(toHandlerReq(req))));
  r.post("/campaign", async (req: any, res: any) => send(res, await router(toHandlerReq(req))));
  r.post("/campaigns", async (req: any, res: any) => send(res, await router(toHandlerReq(req))));
  r.get("/campaign/:id", async (req: any, res: any) =>
    send(res, await router(toHandlerReq(req, { id: req.params.id }))));
  r.get("/metrics", async (req: any, res: any) => send(res, await router(toHandlerReq(req))));

  return r;
}

export function startStandaloneServer(port = defaultConfig.port): void {
  if (typeof process === "undefined" || process.env["STANDALONE"] !== "true") {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const express = require("express");
    const app = express();

    app.use("/api/adevolve", createExpressRouter());

    app.get("/health", (_req: any, res: any) => {
      res.json({ status: "ok", service: "adevolve", mockMode: defaultConfig.mockMode });
    });

    app.listen(port, () => {
      console.log(`[AdEvolve] Standalone server running on http://localhost:${port}`);
      console.log(`[AdEvolve] Mock mode: ${defaultConfig.mockMode}`);
    });
  } catch (err) {
    console.error("[AdEvolve] Failed to start standalone server:", err);
    console.error("Ensure Express is installed: npm install express @types/express");
  }
}

startStandaloneServer();
