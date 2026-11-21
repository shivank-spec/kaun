import { sanitizeCase } from "./generate-case";
import { database } from "./store";
import type { CaseFile, Tone } from "./types";

// The case bank. The free AI tier allows only a few thousand tokens a minute,
// so solo mode serves most cases from cases the AI wrote earlier and keeps the
// live quota for the suspects' answers. Every freshly written case is banked.

export type Bucket = "kolkata" | "hackathon";

export function bucketOf(setting?: string): Bucket | null {
  const s = (setting || "").trim();
  // Players no longer pick a place, so nearly every case goes in one bank.
  if (!s || /^(kolkata|calcutta|anywhere)$/i.test(s) || /hackathon/i.test(s)) return "kolkata";
  return null; // a custom setting is always written live
}

export async function bankCase(bucket: Bucket, tone: Tone, file: CaseFile) {
  const db = database();
  if (!db) return;
  const { error } = await db
    .from("case_pool")
    .insert({ bucket, tone, title: file.title, case_file: file });
  if (error) console.warn("[pool]", error.message);
}

/** A random banked case the player has not seen. Null if the bank has nothing new. */
export async function drawCase(
  bucket: Bucket,
  tone: Tone,
  seen: string[],
): Promise<{ file: CaseFile; size: number } | null> {
  const db = database();
  if (!db) return null;
  const { data: rows } = await db
    .from("case_pool")
    .select("id,title")
    .eq("bucket", bucket)
    .eq("tone", tone)
    .limit(300);
  if (!rows?.length) return null;
  const fresh = rows.filter((r) => !seen.includes(r.title));
  if (!fresh.length) return null;
  const pick = fresh[Math.floor(Math.random() * fresh.length)];
  const { data } = await db.from("case_pool").select("case_file").eq("id", pick.id).maybeSingle();
  return data ? { file: sanitizeCase(data.case_file as CaseFile), size: rows.length } : null;
}
