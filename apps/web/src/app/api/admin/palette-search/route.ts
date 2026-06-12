import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listScope,
  searchAll,
  type PaletteScope,
  type PaletteSearchResponse,
} from "@/lib/admin/palette-search";

export const dynamic = "force-dynamic";

const VALID_SCOPES: PaletteScope[] = [
  "all",
  "contacts",
  "owners",
  "properties",
  "tasks",
  "projects",
];

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin";
}

export async function GET(request: Request) {
  const ok = await requireAdmin();
  if (!ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const scopeParam = (url.searchParams.get("scope") ?? "all") as PaletteScope;
  const scope: PaletteScope = VALID_SCOPES.includes(scopeParam) ? scopeParam : "all";

  if (q.length > 0) {
    const results = await searchAll(q, 5);
    return NextResponse.json(results satisfies PaletteSearchResponse, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (scope !== "all") {
    const list = await listScope(scope, 10);
    const response: PaletteSearchResponse = {
      contacts: scope === "contacts" ? list : [],
      owners: scope === "owners" ? list : [],
      properties: scope === "properties" ? list : [],
      tasks: scope === "tasks" ? list : [],
      projects: scope === "projects" ? list : [],
      documents: [],
      templates: [],
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.json(
    {
      contacts: [], owners: [], properties: [], tasks: [], projects: [],
      documents: [], templates: [],
    } satisfies PaletteSearchResponse,
    { headers: { "Cache-Control": "no-store" } },
  );
}
