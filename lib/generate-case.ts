import { z } from "zod";
import { chatJSON } from "./ai";
import { FALLBACK_CASES } from "./fallback-cases";
import type { CaseFile, Tone } from "./types";

/* ------------------------------------------------------------------ */
/* Schema: the AI must return exactly this shape, then we check logic. */
/* ------------------------------------------------------------------ */

const str = z.string().min(1);
// Models sometimes return {time, event} objects where we asked for a string.
const loose = z.preprocess(
  (v) => (v && typeof v === "object" ? Object.values(v as object).join(" ") : v),
  str,
);

const SuspectZ = z.object({
  id: str,
  name: str,
  role: str,
  persona: str,
  speaking_style: str,
  public_alibi: str,
  innocent_secret: str,
  private_clues: z.array(loose).optional(),
});

const ClueZ = z.object({
  id: str,
  text: str,
  held_by: str,
  points_to: str,
  is_red_herring: z.boolean(),
});

const CaseZ = z.object({
  title: str,
  setting: str,
  crime: str,
  crime_verb: str,
  intro: str,
  suspects: z.array(SuspectZ).min(3).max(8),
  culprit_id: str,
  motive: str,
  method: str,
  timeline: z.array(loose).min(3),
  clues: z.array(ClueZ).default([]),
  alibi_hole: str,
  culprit_objective: str,
  ending_caught: str,
  ending_escaped: str,
  roast: str,
  hot_seat: z.object({ player_id: str, question: str }).optional(),
});

/** Logic check: the puzzle must actually be solvable. Returns an error string or null. */
export function validateCase(c: CaseFile, mode: "solo" | "room"): string | null {
  const ids = new Set(c.suspects.map((s) => s.id));
  if (ids.size !== c.suspects.length) return "duplicate suspect ids";
  if (!ids.has(c.culprit_id)) return "culprit is not a suspect";

  if (mode === "solo") {
    if (c.suspects.length !== 4) return "solo needs exactly 4 suspects";
    const truth = c.clues.filter((k) => !k.is_red_herring);
    const herrings = c.clues.filter((k) => k.is_red_herring);
    if (truth.length < 3) return "need 3 true clues";
    if (herrings.length < 1) return "need a red herring";
    for (const k of c.clues) {
      if (!ids.has(k.held_by) || !ids.has(k.points_to)) return "clue references unknown suspect";
    }
    if (truth.some((k) => k.points_to !== c.culprit_id)) return "a true clue points at an innocent";
    if (truth.some((k) => k.held_by === c.culprit_id)) return "culprit holds a true clue";
    if (herrings.some((k) => k.points_to === c.culprit_id)) return "red herring points at culprit";
  } else {
    for (const s of c.suspects) {
      if (!s.private_clues || s.private_clues.length < 2) return `player ${s.name} lacks 2 clues`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Prompt building                                                     */
/* ------------------------------------------------------------------ */

const KOLKATA_SPOTS = [
  "KC Das sweet shop on Esplanade",
  "the Indian Coffee House on College Street",
  "a Durga Puja pandal in Kumartuli",
  "the Park Street tram at midnight",
  "a phuchka stall outside Victoria Memorial",
  "the members' stand at Eden Gardens",
  "New Market on a Sunday evening",
  "a houseboat adda on the Hooghly near Howrah Bridge",
  "a wedding at a North Kolkata rajbari",
  "Flurys tea room on Park Street",
];

function resolveSetting(raw?: string): string {
  const s = (raw || "Kolkata").trim().slice(0, 60);
  if (/^kolkata$/i.test(s) || /^calcutta$/i.test(s)) {
    return KOLKATA_SPOTS[Math.floor(Math.random() * KOLKATA_SPOTS.length)];
  }
  if (/hackathon/i.test(s)) {
    return "the Vibe Coders Hackathon floor at AIC Techno, Kolkata, run by Calcutta AI Club (laptops, extension cords, the Wi-Fi router, the samosa and McDonald's table, the judges' desk)";
  }
  return s;
}

const toneGuide = (tone: Tone) =>
  tone === "noir"
    ? "Narration style: dry, witty English noir detective voice."
    : "Narration style: over-the-top Indian TV crime-show drama in Hinglish (Roman script Hindi mixed with English), e.g. 'Kuch toh gadbad hai, Daya.' Suspects speak natural Hinglish.";

const COMMON_RULES = `
RULES
- The crime is petty and funny (stolen sweets, missing trophy, unplugged router). Never violent, never dark, nothing offensive.
- Decide the culprit, motive, method and timeline FIRST. Then write everything else to be consistent with them.
- "crime_verb" finishes the sentence "Find who ..." in under 8 words, e.g. "stole the last rosogolla".
- "alibi_hole" is the one concrete fact that breaks the culprit's public_alibi.
- "culprit_objective" is a specific false claim the culprit must convince others of, e.g. "Convince everyone the lights went out at 8:00 pm."
- "intro" (2-3 sentences) sets the scene without naming the culprit.
- "ending_caught" (3-4 sentences) narrates how the culprit did it and was caught. "ending_escaped" (3-4 sentences) narrates how the culprit fooled everyone. Both name the culprit and explain the method.
- "roast" is one savage but friendly line about the culprit.
- Keep every string short and punchy. No markdown. Output ONLY the JSON object.`;

function soloPrompt(setting: string, tone: Tone) {
  return {
    system: `You design airtight mini-mysteries for a 3-minute detective game. ${toneGuide(tone)}
Return ONE JSON object with exactly these keys:
{"title","setting","crime","crime_verb","intro",
 "suspects":[{"id":"s1","name","role","persona","speaking_style","public_alibi","innocent_secret"} x4 with ids s1,s2,s3,s4],
 "culprit_id","motive","method","timeline":[4-6 short beats with clock times],
 "clues":[{"id":"c1","text","held_by","points_to","is_red_herring"} x5 with ids c1..c5],
 "alibi_hole","culprit_objective","ending_caught","ending_escaped","roast"}
${COMMON_RULES}
- Exactly 4 suspects with everyday Indian (mostly Bengali/Kolkata) names and very different personalities.
- Exactly 5 clues: 3 TRUE (is_red_herring=false) and 2 RED HERRINGS (is_red_herring=true).
- Each TRUE clue: points_to = culprit_id, and held_by = a DIFFERENT innocent suspect (it is something that suspect saw or knows). The three together prove the culprit.
- Each RED HERRING: points_to an innocent suspect, held_by a different suspect, and is fully explained by the accused suspect's innocent_secret.
- innocent_secret is embarrassing but harmless. The culprit's innocent_secret field holds a cover story they use.
- Pick the culprit at random among s1..s4. Do not always pick the same position.`,
    user: `Setting: ${setting}. Random seed: ${Math.random().toString(36).slice(2, 8)}. Write the case.`,
  };
}

function roomPrompt(
  setting: string,
  tone: Tone,
  players: { id: string; name: string }[],
  culpritAmong?: string[],
) {
  const list = players.map((p) => `${p.id} = ${p.name}`).join(", ");
  const culpritRule = culpritAmong
    ? `The culprit MUST be one of these ids, chosen at random: ${culpritAmong.join(", ")}.`
    : "Pick the culprit at random from the players.";
  return {
    system: `You design airtight mini-mysteries for a party game where REAL FRIENDS are the suspects and argue out loud for 2 minutes. ${toneGuide(tone)}
Return ONE JSON object with exactly these keys:
{"title","setting","crime","crime_verb","intro",
 "suspects":[{"id","name","role","persona","speaking_style","public_alibi","innocent_secret","private_clues":[2 strings]} one per player, using the EXACT ids and names given],
 "culprit_id","motive","method","timeline":[4-6 short beats with clock times],
 "clues":[],
 "alibi_hole","culprit_objective","ending_caught","ending_escaped","roast",
 "hot_seat":{"player_id","question"}}
${COMMON_RULES}
- ${culpritRule}
- "hot_seat": pick one INNOCENT player and write one short, funny, slightly incriminating question addressed to them by name that they must answer out loud (e.g. "Priya, why was there powdered sugar on your kurta at 8:15?"). It must be explainable by their innocent_secret.
- "role" is what that player was doing at the scene. "public_alibi" is one line they can say out loud.
- private_clues for an INNOCENT player: exactly 2 short first-person observations ("I saw ...", "I heard ..."). Across all innocent players, at least half of these observations must genuinely implicate the culprit; the rest are red herrings that make ANOTHER innocent player look suspicious for a harmless reason.
- Make it a real puzzle: at most ONE clue in the whole case may name the culprit directly. Every other true clue must point at the culprit only through a detail (what they wore or carried, where they stood, a time that breaks their alibi) that players have to match up by talking. Red herrings may name people.
- private_clues for the CULPRIT: exactly 2 short facts they can use to deflect blame onto specific other players (true-sounding and awkward for those players).
- No clue may reveal the culprit outright with certainty by itself; players must combine clues.
- Be playful about the players by name, never mean, nothing about looks, religion, caste or gender.`,
    user: `Setting: ${setting}. Players: ${list}. Random seed: ${Math.random().toString(36).slice(2, 8)}. Write the case.`,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface GenerateOptions {
  setting?: string;
  tone?: Tone;
  players?: { id: string; name: string }[]; // present = multiplayer
  culpritAmong?: string[]; // multiplayer: ids allowed to be the culprit (humans, not bots)
}

function parse(
  raw: unknown,
  mode: "solo" | "room",
  players?: { id: string; name: string }[],
  culpritAmong?: string[],
) {
  const c = CaseZ.parse(raw) as CaseFile;
  if (players) {
    // Force exact ids and names so cards always map to real players.
    const byId = new Map(c.suspects.map((s) => [s.id, s]));
    if (players.some((p) => !byId.has(p.id))) throw new Error("missing player in case");
    c.suspects = players.map((p) => ({ ...byId.get(p.id)!, name: p.name }));
    if (culpritAmong && !culpritAmong.includes(c.culprit_id)) throw new Error("culprit is a bot");
    if (
      c.hot_seat &&
      (c.hot_seat.player_id === c.culprit_id ||
        !byId.has(c.hot_seat.player_id) ||
        (culpritAmong && !culpritAmong.includes(c.hot_seat.player_id))) // never put a bot in the hot seat
    ) {
      delete c.hot_seat;
    }
  }
  const problem = validateCase(c, mode);
  if (problem) throw new Error(`illogical case: ${problem}`);
  return c;
}

/** Hand-written case re-cast onto the real players, so multiplayer never stalls. */
function fallbackFor(players?: { id: string; name: string }[], culpritAmong?: string[]): CaseFile {
  const base = structuredClone(
    FALLBACK_CASES[Math.floor(Math.random() * FALLBACK_CASES.length)],
  ) as CaseFile;
  if (!players) return base;

  const allowed = players
    .map((p, i) => ({ p, i }))
    .filter((x) => !culpritAmong || culpritAmong.includes(x.p.id));
  const culpritIdx = allowed[Math.floor(Math.random() * allowed.length)].i;
  const oldCulprit = base.suspects.find((s) => s.id === base.culprit_id)!;
  const oldInnocents = base.suspects.filter((s) => s.id !== base.culprit_id);
  const culprit = players[culpritIdx];
  const swapName = (t: string) => t.split(oldCulprit.name).join(culprit.name);
  const truth = base.clues.filter((k) => !k.is_red_herring).map((k) => swapName(k.text));

  let i = 0;
  base.suspects = players.map((p, idx) => {
    if (idx === culpritIdx) {
      const scapegoats = players.filter((x) => x.id !== p.id);
      return {
        ...oldCulprit,
        id: p.id,
        name: p.name,
        private_clues: [
          `${scapegoats[0].name} was standing closest to the scene just before it happened.`,
          `${scapegoats[scapegoats.length - 1].name} went suspiciously quiet when it was discovered.`,
        ],
      };
    }
    const tpl = oldInnocents[i % oldInnocents.length];
    const other = players.filter((x) => x.id !== p.id && x.id !== culprit.id)[0];
    const clues = [
      `I noticed: ${truth[i % truth.length]}`,
      other
        ? `I also saw ${other.name} acting a bit odd, but it might be nothing.`
        : `I noticed: ${truth[(i + 1) % truth.length]}`,
    ];
    i++;
    return { ...tpl, id: p.id, name: p.name, private_clues: clues };
  });
  base.culprit_id = culprit.id;
  for (const k of ["crime", "intro", "motive", "method", "alibi_hole", "culprit_objective", "ending_caught", "ending_escaped", "roast"] as const) {
    base[k] = swapName(base[k]);
  }
  base.timeline = base.timeline.map(swapName);
  base.clues = [];
  return base;
}

/**
 * Build a case. Never throws: tries the AI (with one retry), then falls back
 * to a hand-written case so a live demo cannot stall.
 */
export async function generateCase(
  opts: GenerateOptions = {},
): Promise<{ file: CaseFile; source: "ai" | "fallback" }> {
  const tone: Tone = opts.tone === "noir" ? "noir" : "desi";
  const setting = resolveSetting(opts.setting);
  if (!opts.players) return attempt("solo", soloPrompt(setting, tone));

  // Real player ids are long UUIDs, which language models copy unreliably.
  // Give the model short ids (p1, p2, ...) and translate back afterwards.
  const short = opts.players.map((p, i) => ({ id: `p${i + 1}`, name: p.name, real: p.id }));
  const toShort = new Map(short.map((p) => [p.real, p.id]));
  const toReal = new Map(short.map((p) => [p.id, p.real]));
  const shortAmong = opts.culpritAmong?.map((id) => toShort.get(id)!).filter(Boolean);
  const players = short.map(({ id, name }) => ({ id, name }));

  const result = await attempt("room", roomPrompt(setting, tone, players, shortAmong), players, shortAmong);
  const f = result.file;
  const real = (id: string) => toReal.get(id) ?? id;
  f.suspects = f.suspects.map((s) => ({ ...s, id: real(s.id) }));
  f.culprit_id = real(f.culprit_id);
  if (f.hot_seat) f.hot_seat = { ...f.hot_seat, player_id: real(f.hot_seat.player_id) };
  return result;
}

async function attempt(
  mode: "solo" | "room",
  prompt: { system: string; user: string },
  players?: { id: string; name: string }[],
  culpritAmong?: string[],
): Promise<{ file: CaseFile; source: "ai" | "fallback" }> {
  for (let n = 0; n < 2; n++) {
    try {
      const raw = await chatJSON({ ...prompt, temperature: 0.95, maxTokens: 3500, groqTimeoutMs: 12000 });
      return { file: parse(raw, mode, players, culpritAmong), source: "ai" };
    } catch (e) {
      console.warn(`[case] attempt ${n + 1} failed:`, (e as Error).message);
    }
  }
  return { file: fallbackFor(players, culpritAmong), source: "fallback" };
}
