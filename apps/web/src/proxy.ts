import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";
import { createClient } from "@supabase/supabase-js";
import { verifyApiToken } from "@/lib/api-tokens";
import { taskToVTodo, generateETag, parseVTodoStatus } from "@/lib/caldav-utils";

/**
 * Parcel proxy (formerly middleware): CalDAV server + session refresh + route protection.
 *
 * Responsibilities:
 *   1. Serve CalDAV requests for Fantastical integration (/caldav/*, /.well-known/caldav).
 *   2. Refresh the Supabase session cookie on every request.
 *   3. Gate /portal/* and /admin/* behind authentication.
 *   4. Redirect non-admins away from /admin.
 *   5. Redirect already-logged-in users away from /login and /signup.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ---- CalDAV: well-known discovery ----
  if (pathname === "/.well-known/caldav") {
    return NextResponse.redirect(new URL("/caldav/", request.url), 301);
  }

  // ---- CalDAV: handle all /caldav/* requests ----
  if (pathname.startsWith("/caldav")) {
    return handleCalDAV(request, pathname);
  }

  // ---- Supabase session refresh + route protection ----
  let proxyResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            proxyResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPortalRoute = pathname.startsWith("/portal");
  const isAdminRoute = pathname.startsWith("/admin");

  if ((isPortalRoute || isAdminRoute) && !user) {
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
      url.pathname = "/portal/dashboard";
      return NextResponse.redirect(url);
    }
  }

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  if (isAuthPage && user) {
    const { data: authPageProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = authPageProfile?.role === "admin" ? "/admin" : "/portal/dashboard";
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
// CalDAV handler (Fantastical integration)
// ---------------------------------------------------------------------------

// Service role bypass is safe here: the caller is authenticated via
// verifyApiToken (Basic-auth Bearer token hashed against api_tokens),
// and every downstream CalDAV query in this file scopes with
// `.eq("created_by", profileId)`. See apps/web/docs/rls-audit.md.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
      headers: { "WWW-Authenticate": 'Basic realm="Parcel CalDAV"' },
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
        <displayname>Parcel</displayname>
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
        <displayname>Parcel Tasks</displayname>
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.theparcelco.com";
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.theparcelco.com";
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
