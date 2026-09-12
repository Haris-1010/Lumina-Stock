import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost";
const SUBDOMAIN_COOKIE = "lumina-subdomain";

const publicPaths = ["/api/webhooks", "/api/csv-upload/sample", "/store"];
const exactPublicPaths = ["/"];

function getSubdomain(host: string) {
  const hostnameWithoutPort = host.split(":")[0].toLowerCase();
  const appDomainWithoutPort = APP_DOMAIN.split(":")[0].toLowerCase();

  const isSubdomain =
    hostnameWithoutPort !== appDomainWithoutPort &&
    hostnameWithoutPort !== `www.${appDomainWithoutPort}` &&
    hostnameWithoutPort.endsWith(`.${appDomainWithoutPort}`);

  if (!isSubdomain) return null;

  const subdomain = hostnameWithoutPort
    .slice(0, hostnameWithoutPort.length - appDomainWithoutPort.length - 1)
    .trim();

  if (!subdomain || !/^[a-z0-9-]+$/.test(subdomain)) {
    return null;
  }

  return subdomain;
}

function applySubdomainCookie(response: NextResponse, subdomain: string | null) {
  if (subdomain) {
    response.cookies.set(SUBDOMAIN_COOKIE, subdomain, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return;
  }

  response.cookies.delete(SUBDOMAIN_COOKIE);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const subdomain = getSubdomain(request.headers.get("host") ?? "");
  const requestHeaders = new Headers(request.headers);

  if (subdomain) {
    requestHeaders.set("x-lumina-subdomain", subdomain);
  } else {
    requestHeaders.delete("x-lumina-subdomain");
  }

  const passThrough = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    applySubdomainCookie(response, subdomain);
    return response;
  };

  // API routes manage auth at the route layer (session or API key).
  if (pathname.startsWith("/api/")) {
    return passThrough();
  }

  // Rewrite all subdomain traffic to the path-based public storefront (no auth required)
  if (subdomain) {
    const url = request.nextUrl.clone();
    url.pathname = `/store/${subdomain}`;
    const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    applySubdomainCookie(response, subdomain);
    return response;
  }

  // Allow public paths
  if (exactPublicPaths.includes(pathname)) {
    return passThrough();
  }
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return passThrough();
  }

  // Allow static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return passThrough();
  }

  // Single-store mode: no session check needed — auth handled at component level
  return passThrough();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
