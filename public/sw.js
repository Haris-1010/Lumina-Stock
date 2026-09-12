// Lumina Stock — Service Worker
// Strategy:
//   • Next.js JavaScript → network only to avoid mixing builds
//   • Fonts, images → cache-first
//   • HTML pages → network-first with short TTL, fall back to cached version
//   • /api/* → network only (never cache sensitive data)

const CACHE_NAME = "lumina-v7";
const IS_LOCAL_DEV = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1" || self.location.port === "3000";

// ─── Install ─────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Clear only this application’s old caches on install
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("lumina-")).map((key) => caches.delete(key)))
    ).then(() => caches.open(CACHE_NAME))
  );
});

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("lumina-") && (IS_LOCAL_DEV || key !== CACHE_NAME)).map((key) => caches.delete(key)));
    if (IS_LOCAL_DEV) {
      // Upgrade old workers even when their cached app bundle cannot run the new cleanup.
      await self.registration.unregister();
      const tabs = await self.clients.matchAll({ type: "window" });
      await Promise.all(tabs.map((tab) => tab.navigate(tab.url).catch(() => {})));
      return;
    }
    await self.clients.claim();
  })());
});

// ─── Offline fallback HTML ────────────────────────────────────────────────────

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lumina Stock — Offline</title>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;
      min-height:100vh;margin:0;background:#f4f4f5;color:#3f3f46}
    .card{background:#fff;border-radius:16px;padding:40px;text-align:center;max-width:380px;
      box-shadow:0 1px 4px rgba(0,0,0,.1)}
    h1{font-size:20px;margin:0 0 8px;color:#18181b}
    p{font-size:14px;color:#71717a;margin:0 0 20px;line-height:1.6}
    .tip{font-size:12px;color:#a1a1aa;margin:16px 0 0;line-height:1.5}
    a{display:inline-block;padding:10px 24px;background:#059669;color:#fff;
      border-radius:10px;text-decoration:none;font-size:14px;font-weight:600}
    a:hover{background:#047857}
  </style>
</head>
<body>
  <div class="card">
    <h1>📶 You are offline</h1>
    <p>Lumina Stock is working in offline mode.</p>
    <a href="/cashier" onclick="location.reload()">Open Cashier</a>
    <p class="tip">AI Assistant requires an internet connection.</p>
  </div>
</body>
</html>`;

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  if (IS_LOCAL_DEV) return;
  const { request } = event;
  const url = new URL(request.url);

  // Development chunks reuse URLs as code changes; never serve them from cache.
  if (url.pathname.startsWith("/_next/dev/") || url.pathname.startsWith("/_next/static/")) return;

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET (POST/PUT/DELETE go straight to network)
  if (request.method !== "GET") return;

  // ── API calls — always network-only ───────────────────────────────────────
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/sign-")) return;
  if (url.pathname.startsWith("/suspended")) return;

  // ── Static files (images, fonts, manifest, icons) — cache-first ──────────
  if (
    url.pathname.startsWith("/_next/image") ||
    /\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response("", { status: 503 }));
      })
    );
    return;
  }

  // ── HTML navigation — network-first, NO automatic caching ─────────────────
  // We no longer auto-cache HTML pages — that causes stale content on deploys.
  // Only serve from cache when truly offline.
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              new Response(OFFLINE_HTML, {
                headers: { "Content-Type": "text/html; charset=utf-8" },
              })
          )
        )
    );
    return;
  }

  // ── Everything else — network with cache fallback ─────────────────────────
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || new Response("", { status: 503 })))
  );
});
