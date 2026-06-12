import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyApiToken } from "@/lib/api-tokens";
import { taskToVTodo, generateETag, parseVTodoStatus } from "@/lib/caldav-utils";
import { resolveOrgForRequestHost } from "@/lib/organizations/cache";

/**
 * Proxy proxy (formerly middleware): CalDAV server + session refresh + route protection.
 *
 * Responsibilities:
 *   1. Serve CalDAV requests for Fantastical integration (/caldav/*, /.well-known/caldav).
 *   2. Resolve the organization for the request host (multi-tenant subdomains
 *      and white-label custom domains) and inject x-org-* request headers.
 *      First-party hosts (www/app/localhost/previews) always resolve to the
 *      Proxy org with no database lookup.
 *   3. Refresh the Supabase session cookie on every request.
 *   4. Subdomain routing: app.myproxyhost.com serves the authenticated workspace;
 *      www.myproxyhost.com serves the marketing site and login.
 *   5. Gate /workspace/* and /admin/* behind authentication.
 *   6. Redirect non-admins away from /admin.
 *   7. Redirect already-logged-in users away from /login and /signup.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = request.nextUrl.hostname;

  // Bare domain → www
  if (hostname === "myproxyhost.com") {
    const url = request.nextUrl.clone();
    url.hostname = "www.myproxyhost.com";
    url.protocol = "https";
    return NextResponse.redirect(url, 308);
  }

  // CalDAV: well-known discovery
  if (pathname === "/.well-known/caldav") {
    return NextResponse.redirect(new URL("/caldav/", request.url), 301);
  }

  // CalDAV: handle all /caldav/* requests
  if (pathname.startsWith("/caldav")) {
    return handleCalDAV(request, pathname);
  }

  // ── Organization context (multi-tenant routing) ────────────────────────────
  // Strip any client-supplied org headers first: downstream server code must
  // only ever trust values set by this proxy, never by the caller.
  request.headers.delete("x-org-id");
  request.headers.delete("x-org-slug");
  request.headers.delete("x-org-plan");

  const org = await resolveOrgForRequestHost(hostname);
  if (!org) {
    // Unknown *.myproxyhost.com subdomain: send to the main site.
    return NextResponse.redirect("https://www.myproxyhost.com/");
  }
  // Mutating request.headers before every NextResponse.next({ request }) call
  // (including the one recreated inside the cookie setAll handler) forwards
  // these headers to all downstream server components and route handlers.
  request.headers.set("x-org-id", org.id);
  request.headers.set("x-org-slug", org.slug);
  request.headers.set("x-org-plan", org.planTier);

  const isApp = hostname === "app.myproxyhost.com";
  const isWww = hostname === "www.myproxyhost.com";
  // Widen auth cookies to .myproxyhost.com so they are shared between www. and app.
  const cookieDomain = isApp || isWww ? ".myproxyhost.com" : undefined;

  let proxyResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          proxyResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            proxyResponse.cookies.set(name, value, {
              ...options,
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            }),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isWorkspaceRoute = pathname.startsWith("/workspace");
  const isAdminRoute = pathname.startsWith("/admin");
  const isAppRoute = isWorkspaceRoute || isAdminRoute;
  const isAuthPage = pathname === "/" || pathname === "/login" || pathname === "/signup";

  // ── app.myproxyhost.com ────────────────────────────────────────────────────
  if (isApp) {
    if (!user) {
      return NextResponse.redirect("https://www.myproxyhost.com/login");
    }

    if (isAuthPage || isAdminRoute) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (isAuthPage) {
        const url = request.nextUrl.clone();
        url.pathname = profile?.role === "admin" ? "/admin" : "/workspace/home";
        return NextResponse.redirect(url);
      }

      if (isAdminRoute && profile?.role !== "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/workspace/home";
        return NextResponse.redirect(url);
      }
    }

    // Two-factor gate on protected routes (enrolled-but-unverified, or admins
    // missing a factor). Runs before letting the request through.
    if (isAppRoute) {
      const mfaRedirect = await evaluateMfaGate(
        supabase,
        request,
        pathname,
        isAdminRoute,
      );
      if (mfaRedirect) return mfaRedirect;
    }

    if (pathname.startsWith("/admin/treasury")) {
      proxyResponse.headers.set(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://cdn.plaid.com",
          "style-src 'self' 'unsafe-inline'",
          "connect-src 'self' https://*.plaid.com https://api.stripe.com",
          "frame-src 'self' https://cdn.plaid.com",
          "img-src 'self' data: https:",
          "font-src 'self' data:",
        ].join("; "),
      );
    }

    return proxyResponse;
  }

  // ── www.myproxyhost.com ────────────────────────────────────────────────────
  if (isWww) {
    if (isAppRoute) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("redirect", pathname);
        return NextResponse.redirect(url);
      }
      // Authenticated user on www. hitting app routes → move them to app.
      return NextResponse.redirect(
        `https://app.myproxyhost.com${pathname}${request.nextUrl.search}`,
      );
    }

    if (isAuthPage && user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const dest = profile?.role === "admin" ? "/admin" : "/workspace/home";
      return NextResponse.redirect(`https://app.myproxyhost.com${dest}`);
    }

    return proxyResponse;
  }

  // ── localhost (dev) ────────────────────────────────────────────────────────
  if (isAppRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/workspace/home";
      return NextResponse.redirect(url);
    }
  }

  // Two-factor gate on protected routes (dev/localhost).
  if (isAppRoute && user) {
    const mfaRedirect = await evaluateMfaGate(
      supabase,
      request,
      pathname,
      isAdminRoute,
    );
    if (mfaRedirect) return mfaRedirect;
  }

  if (isAuthPage && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const url = request.nextUrl.clone();
    url.pathname = profile?.role === "admin" ? "/admin" : "/workspace/home";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin/treasury")) {
    proxyResponse.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.plaid.com",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' https://*.plaid.com https://api.stripe.com",
        "frame-src 'self' https://cdn.plaid.com",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
      ].join("; "),
    );
  }

  return proxyResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

// ---------------------------------------------------------------------------
// Two-factor (AAL) gate
// ---------------------------------------------------------------------------

/**
 * Path prefixes that must never be gated by the 2FA middleware, to avoid
 * redirect loops (the verify/enroll/recover screens and auth plumbing) and to
 * leave public/auth routes untouched.
 */
const MFA_EXEMPT_PREFIXES = [
  "/verify-2fa",
  "/enroll-2fa",
  "/recover-2fa",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/api",
  "/caldav",
  "/.well-known",
  "/_next",
];

function isMfaExempt(pathname: string): boolean {
  return MFA_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Decide whether a logged-in user on a protected route must be redirected for
 * two-factor reasons. Uses the Supabase MFA API directly on the middleware
 * client (the server-only mfa.ts lib must not be imported here).
 *
 *   a) Enrolled but unverified this session (next aal2, current aal1)
 *      → /verify-2fa.
 *   b) Admin on /admin/* with no verified factor → /enroll-2fa (required).
 *   c) Owners with no factor are left untouched (2FA is optional for them).
 *
 * Returns a redirect response, or null to let the request continue.
 */
async function evaluateMfaGate(
  supabase: SupabaseClient<Database>,
  request: NextRequest,
  pathname: string,
  isAdminRoute: boolean,
): Promise<NextResponse | null> {
  // Dev-only escape hatch: when running locally with DEV_SKIP_MFA enabled,
  // bypass the 2FA gate so automated tooling (screenshots, agents) can reach
  // admin without a rotating TOTP code. Dead in production — NODE_ENV is never
  // "development" there, and /api/dev/auth already 404s in prod.
  if (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_SKIP_MFA === "true"
  ) {
    return null;
  }

  if (isMfaExempt(pathname)) return null;

  // `currentLevel` comes from the JWT aal claim (read locally from the session)
  // and is reliable. `nextLevel` is NOT: it is derived from session.user.factors
  // which is not consistently populated in the middleware session, so we never
  // gate on it. Fail open if the read returns nothing so a transient hiccup
  // cannot trap a user in a redirect loop.
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal) return null;

  // A session already elevated to aal2 has cleared its second factor this
  // session. Nothing to enforce, and this skips the listFactors call below on
  // the hot path for verified users.
  if (aal.currentLevel === "aal2") return null;

  // Authoritative enrollment check. listFactors performs a /user fetch, the
  // same source the /enroll-2fa page uses, which keeps the two in lockstep and
  // prevents an enroll <-> admin redirect loop. (Perf note: this runs once per
  // protected navigation for non-elevated sessions; a future optimization could
  // cache enrollment status in a cookie or custom JWT claim.)
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = (factors?.totp ?? []).some(
    (factor) => factor.status === "verified",
  );

  // (a) Enrolled but session still at aal1 → force the login-time verify screen.
  if (hasVerifiedTotp) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-2fa";
    url.search = "";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // (b) Admins are required to enroll. No verified factor on an admin route →
  // force the enrollment wizard.
  if (isAdminRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/enroll-2fa";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // (c) Owners with no factor: untouched (2FA is optional for them).
  return null;
}

// ---------------------------------------------------------------------------
// CalDAV handler (Fantastical integration)
// ---------------------------------------------------------------------------

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  );
}

async function authenticate(
  authHeader: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<string | null> {
  if (!authHeader.startsWith("Basic ")) return null;
  const decoded = atob(authHeader.slice(6));
  const colonIdx = decoded.indexOf(":");
  if (colonIdx === -1) return null;
  const token = decoded.slice(colonIdx + 1);
  if (!token) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await verifyApiToken(token, supabase as any);
  return result?.profileId ?? null;
}

async function handleCalDAV(request: NextRequest, pathname: string): Promise<NextResponse> {
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        Allow: "OPTIONS, GET, PUT, PROPFIND, REPORT",
        DAV: "1, calendar-access",
        "Content-Length": "0",
      },
    });
  }

  const supa = getServiceClient();
  const profileId = await authenticate(request.headers.get("Authorization") ?? "", supa);
  if (!profileId) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Proxy CalDAV"' },
    });
  }

  if (method === "PROPFIND") return handlePropfind(pathname);
  if (method === "REPORT" && (pathname === "/caldav/tasks/" || pathname === "/caldav/tasks")) {
    return handleReport(supa, profileId);
  }
  if (method === "GET" && pathname.match(/\/caldav\/tasks\/.+\.ics$/)) {
    return handleGet(supa, profileId, pathname);
  }
  if (method === "PUT" && pathname.match(/\/caldav\/tasks\/.+\.ics$/)) {
    return handlePut(supa, profileId, pathname, request);
  }

  return new NextResponse("Method Not Allowed", { status: 405 });
}

function handlePropfind(pathname: string): NextResponse {
  if (pathname === "/caldav/" || pathname === "/caldav") {
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <response>
    <href>/caldav/</href>
    <propstat>
      <prop>
        <displayname>Proxy</displayname>
        <resourcetype><principal/></resourcetype>
        <C:calendar-home-set><href>/caldav/</href></C:calendar-home-set>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>`, 207);
  }

  if (pathname === "/caldav/tasks/" || pathname === "/caldav/tasks") {
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <response>
    <href>/caldav/tasks/</href>
    <propstat>
      <prop>
        <displayname>Proxy Tasks</displayname>
        <resourcetype><collection/><C:calendar/></resourcetype>
        <C:supported-calendar-component-set>
          <C:comp name="VTODO"/>
        </C:supported-calendar-component-set>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>
</multistatus>`, 207);
  }

  return new NextResponse("Not Found", { status: 404 });
}

async function handleReport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  profileId: string,
): Promise<NextResponse> {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, caldav_uid, title, due_at, status, priority, updated_at")
    .eq("created_by", profileId)
    .not("due_at", "is", null)
    .neq("status", "done")
    .not("caldav_uid", "is", null);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.myproxyhost.com";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responses = (tasks ?? []).map((t: any) => {
    const vtodo = taskToVTodo({
      id: t.id,
      caldavUid: t.caldav_uid,
      title: t.title,
      dueAt: t.due_at,
      status: t.status,
      priority: t.priority ?? 4,
      updatedAt: t.updated_at,
    }, baseUrl);
    const etag = generateETag(t.updated_at);
    return `  <response>
    <href>/caldav/tasks/${t.caldav_uid}.ics</href>
    <propstat>
      <prop>
        <getetag>${etag}</getetag>
        <C:calendar-data><![CDATA[${vtodo}]]></C:calendar-data>
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>`;
  });

  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
${responses.join("\n")}
</multistatus>`, 207);
}

async function handleGet(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  profileId: string,
  pathname: string,
): Promise<NextResponse> {
  const uid = extractUid(pathname);
  const { data: task } = await supabase
    .from("tasks")
    .select("id, caldav_uid, title, due_at, status, priority, updated_at")
    .eq("caldav_uid", uid)
    .eq("created_by", profileId)
    .single();

  if (!task) return new NextResponse("Not Found", { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.myproxyhost.com";
  const vtodo = taskToVTodo({
    id: task.id, caldavUid: task.caldav_uid, title: task.title,
    dueAt: task.due_at, status: task.status, priority: task.priority ?? 4,
    updatedAt: task.updated_at,
  }, baseUrl);

  return new NextResponse(vtodo, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      ETag: generateETag(task.updated_at),
    },
  });
}

async function handlePut(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  profileId: string,
  pathname: string,
  request: NextRequest,
): Promise<NextResponse> {
  const uid = extractUid(pathname);
  const body = await request.text();
  const newStatus = parseVTodoStatus(body);

  if (newStatus === "COMPLETED") {
    const { count } = await supabase
      .from("tasks")
      .update({ status: "done", completed_at: new Date().toISOString() }, { count: "exact" })
      .eq("caldav_uid", uid)
      .eq("created_by", profileId);

    if ((count ?? 0) === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }
  }

  return new NextResponse(null, { status: 204 });
}

function extractUid(pathname: string): string {
  return pathname.split("/").pop()?.replace(/\.ics$/, "") ?? "";
}

function xmlResponse(xml: string, status: number): NextResponse {
  return new NextResponse(xml, {
    status,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
