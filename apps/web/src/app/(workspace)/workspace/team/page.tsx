import type { Metadata } from "next";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { MembersShell } from "./MembersShell";

export const metadata: Metadata = { title: "Members" };
export const dynamic = "force-dynamic";

type ProxyTeamMember = {
  id: string;
  name: string;
  role: string;
  location: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  bio: string | null;
  member_since: string | null;
  languages: string[] | null;
  specialties: string[] | null;
  founding_member: boolean | null;
  website_url: string | null;
  is_messageable: boolean | null;
};

type OwnerMember = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  responsibility: string | null;
  location: string | null;
};

export default async function MembersPage() {
  const { userId, client, realUserId } = await getWorkspaceContext();

  const [{ data: profile }, proxyTeamResult] = await Promise.all([
    client
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("id, full_name, email, phone, avatar_url, location" as any)
      .eq("id", userId)
      .single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any)
      .from("proxy_team")
      .select("id, name, role, location, avatar_url, sort_order, email, phone, linkedin_url, instagram_url, bio, member_since, languages, specialties, founding_member, website_url, is_messageable")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const proxyTeam: ProxyTeamMember[] = proxyTeamResult.data ?? [];

  let ownerMembers: OwnerMember[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileAny = profile as any;
  const workspaceId = profileAny?.workspace_id ?? null;

  if (workspaceId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membersRaw } = await (client as any)
      .from("profiles")
      .select("id, full_name, email, phone, avatar_url, location")
      .eq("workspace_id", workspaceId)
      .eq("role", "owner")
      .order("created_at", { ascending: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const members: any[] = membersRaw ?? [];

    ownerMembers = (members ?? []).map((m) => ({
      id: m.id,
      full_name: m.full_name,
      email: m.email ?? "",
      phone: m.phone,
      avatar_url: m.avatar_url,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responsibility: (m as any).responsibility ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      location: (m as any).location ?? null,
    }));
  } else {
    ownerMembers = profile
      ? [
          {
            id: userId,
            full_name: profileAny.full_name,
            email: profileAny.email ?? "",
            phone: profileAny.phone,
            avatar_url: profileAny.avatar_url,
            responsibility: profileAny.responsibility ?? null,
            location: profileAny.location ?? null,
          },
        ]
      : [];
  }

  return (
    <MembersShell
      proxyTeam={proxyTeam}
      ownerMembers={ownerMembers}
      currentUserId={realUserId}
    />
  );
}
