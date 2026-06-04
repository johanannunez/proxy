/**
 * Seed demo responses for the "Guest Survey" form so the responses view
 * can be previewed with realistic data. Uses real profiles + properties.
 *
 * Idempotent: every row it writes is tagged metadata.seed = true and the
 * script deletes prior seeded rows before inserting. Remove all seeded
 * data with: pnpm exec tsx scripts/seed-guest-survey.ts --clear
 *
 * Run:  set -a && . ./.env.local && set +a && pnpm exec tsx scripts/seed-guest-survey.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SECRET_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const FORM_ID = "cdd0cfac-f121-4a79-818f-0a5bc8014f8f";
const CLEAR_ONLY = process.argv.includes("--clear");

// Real profiles (people) + properties (workspaces) from this org.
type Row = {
  profileId: string;
  propertyId: string;
  daysAgo: number;
  durationMin: number; // minutes between start and completion
  status: "complete" | "in_progress" | "no_data";
  data: Record<string, unknown>;
};

const F = {
  overall: "field_002",
  clean: "field_003",
  comms: "field_004",
  accuracy: "field_005",
  enjoyed: "field_007",
  improve: "field_008",
  again: "field_009",
} as const;

const ROWS: Row[] = [
  {
    profileId: "9d6859ff-f130-482e-be4c-1596adbfc45b", // Vanessa Cyprien
    propertyId: "8d0b5119-2131-40c2-9084-79a0f68f6b86", // 524 S Sycamore Unit A, Pasco
    daysAgo: 2,
    durationMin: 4,
    status: "complete",
    data: {
      [F.overall]: 5,
      [F.clean]: 5,
      [F.comms]: 5,
      [F.accuracy]: 5,
      [F.enjoyed]:
        "The place was spotless and the check-in instructions were flawless. The little welcome note and local coffee recommendations made it feel personal.",
      [F.improve]:
        "Honestly nothing major. Maybe a second set of bath towels for a longer stay.",
      [F.again]: "Definitely yes",
    },
  },
  {
    profileId: "4ba7f670-99bf-4bd1-9d25-e60a2ccf03eb", // Olga Karastanov
    propertyId: "478c0409-f305-4c7c-8e23-4c1e2d81a7f0", // 19 S Edison Unit A, Kennewick
    daysAgo: 4,
    durationMin: 6,
    status: "complete",
    data: {
      [F.overall]: 4,
      [F.clean]: 5,
      [F.comms]: 4,
      [F.accuracy]: 4,
      [F.enjoyed]:
        "Great location, walking distance to everything we needed. Bed was very comfortable.",
      [F.improve]:
        "The wifi dropped a couple of times in the evening. A mesh extender in the back bedroom would help.",
      [F.again]: "Probably yes",
    },
  },
  {
    profileId: "a6ef6f28-1b58-415b-931e-0e7a1b6673ef", // Sergey Stefoglo
    propertyId: "149b40b1-7a8c-400c-90dc-db0809fc4671", // 403 E 8th Ave Unit A, Spokane
    daysAgo: 6,
    durationMin: 3,
    status: "complete",
    data: {
      [F.overall]: 5,
      [F.clean]: 4,
      [F.comms]: 5,
      [F.accuracy]: 5,
      [F.enjoyed]:
        "Communication was incredible. Every question answered within minutes. The space looked exactly like the photos.",
      [F.improve]: "A few more kitchen utensils would be a nice touch.",
      [F.again]: "Definitely yes",
    },
  },
  {
    profileId: "8d6cb405-f635-4c60-914d-c364296bf15c", // Cassandra Hirtle
    propertyId: "5992d034-a250-4667-9aa9-dd5c0f4037b9", // 1431 Jadwin Ave, Richland
    daysAgo: 9,
    durationMin: 7,
    status: "complete",
    data: {
      [F.overall]: 3,
      [F.clean]: 3,
      [F.comms]: 4,
      [F.accuracy]: 3,
      [F.enjoyed]: "The neighborhood was quiet and parking was easy.",
      [F.improve]:
        "The kitchen floor felt a little sticky on arrival and one of the lamps in the living room didn't work. Quick fixes but worth flagging.",
      [F.again]: "Probably yes",
    },
  },
  {
    profileId: "b5e8c146-f470-4375-8341-ea274aecca65", // Denise Cook
    propertyId: "38bc7176-d9c0-4beb-bb85-9017fd94368d", // 5814 Pierre Dr Unit B, Pasco
    daysAgo: 12,
    durationMin: 5,
    status: "complete",
    data: {
      [F.overall]: 5,
      [F.clean]: 5,
      [F.comms]: 5,
      [F.accuracy]: 4,
      [F.enjoyed]:
        "We loved the patio. Perfect spot for morning coffee. The house was warm and welcoming.",
      [F.improve]:
        "Listing said the second bedroom had a queen but it was a full. Not a dealbreaker, just update the description.",
      [F.again]: "Definitely yes",
    },
  },
  {
    profileId: "710684d0-14bb-4f7d-8e12-6d2384dd69a0", // Lisbeth Romero
    propertyId: "74f7d52c-05f9-40f0-918a-ceca07bdf518", // 3513 W 1st Pl, Kennewick
    daysAgo: 15,
    durationMin: 4,
    status: "complete",
    data: {
      [F.overall]: 4,
      [F.clean]: 4,
      [F.comms]: 5,
      [F.accuracy]: 5,
      [F.enjoyed]: "Smooth self check-in and a spotless bathroom. Felt very safe.",
      [F.improve]: "Could use blackout curtains in the main bedroom.",
      [F.again]: "Definitely yes",
    },
  },
  // ── In progress: started, partial answers, never completed ──
  {
    profileId: "f8004a01-d522-4197-a9e2-7120d4f2d0bd", // Samuel Reyes
    propertyId: "6e3f0d08-f45e-4448-939d-e8f80592f80d", // 34 Downing Dr, GA
    daysAgo: 1,
    durationMin: 0,
    status: "in_progress",
    data: {
      [F.overall]: 5,
      [F.clean]: 4,
      [F.comms]: 5,
    },
  },
  {
    profileId: "a48c67e6-ea33-4daa-8ea1-c9b7fb863a39", // Alina Tochinskiy
    propertyId: "980f2c5d-281c-4de5-83b9-534a3b01b24c", // 1433 Jadwin Ave, Richland
    daysAgo: 3,
    durationMin: 0,
    status: "in_progress",
    data: {
      [F.overall]: 4,
      [F.clean]: 4,
    },
  },
  // ── No data: opened the link, never started filling ──
  {
    profileId: "57eed56f-a80d-4235-abe3-23fe9bfa3ec4", // Joeli Nunez
    propertyId: "31ecfca0-7ce0-42b0-a802-b8109456ae35", // 1 W Penmarch Pl, SD
    daysAgo: 1,
    durationMin: 0,
    status: "no_data",
    data: {},
  },
];

function iso(daysAgo: number, addMinutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setMinutes(d.getMinutes() + addMinutes);
  return d.toISOString();
}

async function clearSeed() {
  const { error } = await db
    .from("form_responses")
    .delete()
    .eq("form_id", FORM_ID)
    .contains("metadata", { seed: true });
  if (error) console.error("clear responses error:", error.message);
  const { error: vErr } = await db
    .from("form_views")
    .delete()
    .eq("form_id", FORM_ID)
    .eq("user_agent", "seed-demo");
  if (vErr) console.error("clear views error:", vErr.message);
  console.log("Cleared prior seeded rows.");
}

async function main() {
  await clearSeed();
  if (CLEAR_ONLY) {
    console.log("Done (clear only).");
    return;
  }

  const rows = ROWS.map((r) => {
    const startedAt = r.status === "no_data" ? null : iso(r.daysAgo);
    const completedAt =
      r.status === "complete" ? iso(r.daysAgo, r.durationMin) : null;
    // submitted_at is the record timestamp; use completion when finished,
    // otherwise the start (or open) time.
    const submittedAt = completedAt ?? startedAt ?? iso(r.daysAgo);
    return {
      form_id: FORM_ID,
      respondent_profile_id: r.profileId,
      property_id: r.propertyId,
      data: r.data,
      metadata: { seed: true, source: "demo-seed" },
      submitted_at: submittedAt,
      started_at: startedAt,
      completed_at: completedAt,
    };
  });

  const { data: inserted, error } = await db
    .from("form_responses")
    .insert(rows)
    .select("id, completed_at, started_at");
  if (error) {
    console.error("insert responses error:", error.message);
    process.exit(1);
  }

  // Realistic view funnel: more views than responses.
  const VIEW_COUNT = 27;
  const views = Array.from({ length: VIEW_COUNT }, (_, i) => ({
    form_id: FORM_ID,
    viewed_at: iso(Math.floor(Math.random() * 16), Math.floor(Math.random() * 600)),
    user_agent: "seed-demo",
  }));
  const { error: vErr } = await db.from("form_views").insert(views);
  if (vErr) console.error("insert views error:", vErr.message);

  const complete = rows.filter((r) => r.completed_at).length;
  const inProgress = rows.filter((r) => r.started_at && !r.completed_at).length;
  const noData = rows.filter((r) => !r.started_at).length;
  console.log(`Inserted ${inserted?.length ?? 0} responses:`);
  console.log(`  Complete:    ${complete}`);
  console.log(`  In progress: ${inProgress}`);
  console.log(`  No data:     ${noData}`);
  console.log(`Inserted ${VIEW_COUNT} views.`);
  console.log(
    `Completion rate: ${Math.round((complete / rows.length) * 100)}% (${complete}/${rows.length})`,
  );
}

main().then(() => process.exit(0));
