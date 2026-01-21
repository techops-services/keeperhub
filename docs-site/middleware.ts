import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Valid top-level routes from the docs content
const VALID_ROUTES = new Set([
  "",
  "faq",
  "api",
  "getting-started",
  "intro",
  "keeper-runs",
  "keepers",
  "notifications",
  "practices",
  "users-teams-orgs",
  "wallet-management",
  "workflows",
]);

// Routes that should bypass the check (static assets, API routes, etc.)
const BYPASS_PREFIXES = ["/_next", "/api", "/favicon", "/_pagefind"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Bypass static assets and internal routes
  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Get the first path segment (top-level route)
  const segments = pathname.split("/").filter(Boolean);
  const topLevelRoute = segments[0]?.toLowerCase() || "";

  // Check if the top-level route is valid
  if (!VALID_ROUTES.has(topLevelRoute)) {
    // Return 404 for invalid routes without hitting the page component
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
