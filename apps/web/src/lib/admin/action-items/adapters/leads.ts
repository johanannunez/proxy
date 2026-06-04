import type { ColdLeadsData, WinbackQueueData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

export function coldLeadActionItems(data: ColdLeadsData): ActionItem[] {
  return data.topLeads.map((l) => ({
    id: `lead:${l.id}`,
    type: "lead",
    lane: "growth",
    title: `${l.name} has gone cold`,
    context: `${l.daysDormant}d dormant${l.estimatedMrr ? ` · ~$${l.estimatedMrr}/mo` : ""}`,
    deadline: null,
    liveNow: false,
    moneyAtRisk: l.estimatedMrr || null,
    ownerVisible: false,
    href: `/admin/people/${l.id}`,
  }));
}

export function winbackActionItems(data: WinbackQueueData): ActionItem[] {
  return data.contacts.map((c) => ({
    id: `winback:${c.id}`,
    type: "winback",
    lane: "growth",
    title: c.insightTitle ?? `Win back ${c.name}`,
    context: `${c.stage} · ${c.daysDormant}d dormant`,
    deadline: null,
    liveNow: false,
    moneyAtRisk: c.estimatedMrr || null,
    ownerVisible: false,
    href: `/admin/people/${c.id}`,
  }));
}
