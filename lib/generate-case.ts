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
  facts: z.object({ what: str, when: str, where: str }).optional(),
});

/**
 * Models sometimes write an internal id ("s3", "p2") where a name belongs.
 * Swap every such id for the person's name so players never see one.
 */
export function sanitizeCase(c: CaseFile): CaseFile {
  const names = new Map(c.suspects.map((s) => [s.id.toLowerCase(), s.name.split(" ")[0]]));
  const fix = (t: string) =>
    t.replace(/\b([sp][1-8])\b/gi, (m) => names.get(m.toLowerCase()) ?? m);
  const out = structuredClone(c);
  for (const k of ["title", "crime", "intro", "motive", "method", "alibi_hole", "culprit_objective", "ending_caught", "ending_escaped", "roast"] as const) {
    out[k] = fix(out[k]);
  }
  out.timeline = out.timeline.map(fix);
  out.clues = out.clues.map((k) => ({ ...k, text: fix(k.text) }));
  out.suspects = out.suspects.map((s) => ({
    ...s,
    public_alibi: fix(s.public_alibi),
    innocent_secret: fix(s.innocent_secret),
    private_clues: s.private_clues?.map(fix),
  }));
  if (out.hot_seat) out.hot_seat = { ...out.hot_seat, question: fix(out.hot_seat.question) };
  return out;
}

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

// Places anyone anywhere understands at a glance.
const PLACES = [
  "a city museum on the night of a new exhibition",
  "a five-star hotel during a wedding",
  "a school on the night before exams",
  "a bank after closing time",
  "a jewellery shop during a private viewing",
  "a tech startup's office the night before a big launch",
  "an airport cargo area on the night shift",
  "a film set on the last day of shooting",
  "a football stadium on match day",
  "an art auction just before bidding opens",
  "a hospital pharmacy during the night shift",
  "a famous restaurant on the night a critic visits",
];

function resolveSetting(raw?: string): string {
  const s = (raw || "").trim().slice(0, 60);
  // The game no longer asks players where to set the case: pick a place for them.
  if (!s || /^(kolkata|calcutta|anywhere)$/i.test(s) || /hackathon/i.test(s)) {
    return PLACES[Math.floor(Math.random() * PLACES.length)];
  }
  return s;
}

const toneGuide = (tone: Tone) =>
  tone === "noir"
    ? "Narration style: a dry, world-weary noir detective. Sparse, precise, a little bitter."
    : "Narration style: a gripping true-crime documentary narrator. Tense, cinematic, serious.";

const COMMON_RULES = `
RULES
- REALISM: this must read like a real case file, not a joke. Choose a serious, high-stakes, non-violent crime: a jewel or art theft, a swapped forgery, a leaked exam paper or tender bid, stolen source code or client data, a wiped server, embezzlement, a sabotaged machine or race, a doctored document, blackmail, an inside job. Never a stolen snack or sweet. Nobody is hurt or killed.
- Give it just enough real-world texture: what is at stake, the room it happened in, and everyday evidence anyone understands (a camera recording, a door-card swipe, a phone call, a fingerprint, a receipt, a muddy footprint, a witness).
- Suspects are believable adults with real jobs and real motives (debt, a passed-over promotion, a rival's offer, a cover-up). Titles are 2-4 words and sound like a case file. Vary them: do not always use the word "Heist" (e.g. "The Missing Painting", "Lot 47", "Night Shift at Gate 3").
- "facts" states the case in three short plain lines a child could follow: "what" was taken or done (under 10 words), "when" (a time window), "where" (the exact spot).
- SIMPLE: one thing taken or done, one room, one moment. Do not name a city or real street. Use at most ONE clock time per sentence. Every alibi is under 12 words. Every clue is one sentence under 15 words. A newcomer must understand the whole case in 20 seconds.
- Decide the culprit, motive, method and timeline FIRST. Then write everything else to be consistent with them.
- "crime_verb" finishes the sentence "Find who ..." in under 8 words, e.g. "swapped the necklace for a fake".
- "alibi_hole" is the one concrete, checkable fact that breaks the culprit's public_alibi.
- "culprit_objective" is a specific false claim the culprit must convince others of, e.g. "Convince everyone the CCTV was already down at 9:40 pm."
- "innocent_secret" is a private, non-criminal thing the person would rather hide (a secret job interview, a hidden debt, meeting someone they should not, breaking a workplace rule). It explains why they looked suspicious.
- "intro" (2-3 sentences) sets the scene without naming the culprit.
- "ending_caught" and "ending_escaped" are 2-3 punchy sentences each, written like the last scene of a thriller: who did it, the clever way they did it, and the one slip that caught them (or the nerve that let them walk).
- VOICE: vivid, tense and fun to read aloud. Sharp details, a twist, a little swagger. Clear on first read.
- NO TECH JARGON: never say VPN, MAC address, checksum, exfiltrate, metadata, hash, firmware. Say "the door camera", "her phone records", "his fingerprint", "the receipt".
- "roast" is one dry, cutting line about the culprit, the kind a detective says while closing the file.
- LANGUAGE: write everything in plain English only. No Hindi, Bengali or Hinglish words anywhere (names of people and places are fine).
- Keep every string tight: under 30 words each. No markdown. Output ONLY the complete JSON object with every key present.`;

// Models repeat themselves: the same first names, the same guilty slot. So the
// server deals the names and picks the culprit, and the model writes around them.
const FIRST_NAMES = [
  "Ananya", "Arjun", "Meera", "Kabir", "Ishita", "Vikram", "Tara", "Nikhil", "Riya", "Dev",
  "Sanjana", "Aditya", "Pooja", "Rahul", "Nandini", "Karan", "Diya", "Siddharth", "Leela", "Farhan",
  "Zoya", "Imran", "Kavya", "Rohan", "Shreya", "Yash", "Mira", "Abhay", "Trisha", "Varun",
  "Aisha", "Neil", "Priyanka", "Gaurav", "Sana", "Manav", "Anjali", "Dhruv", "Lara", "Samar",
];
const LAST_NAMES = [
  "Sen", "Bose", "Mukherjee", "Roy", "Ghosh", "Dutta", "Chatterjee", "Banerjee", "Mitra", "Sarkar",
  "Kapoor", "Mehta", "Agarwal", "Khan", "D'Souza", "Iyer", "Sinha", "Jalan", "Fernandes", "Rao",
];
function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function dealNames(n: number): string[] {
  const firsts = shuffled(FIRST_NAMES).slice(0, n);
  const lasts = shuffled(LAST_NAMES).slice(0, n);
  return firsts.map((f, i) => `${f} ${lasts[i]}`);
}

function soloPrompt(setting: string, tone: Tone, culprit: string, names: string[]) {
  return {
    system: `You are a crime writer designing airtight, realistic case files for a 3-minute detective game. ${toneGuide(tone)}
Return ONE JSON object with exactly these keys:
{"title","setting","crime","crime_verb","intro","facts":{"what","when","where"},
 "suspects":[{"id":"s1","name","role","persona","speaking_style","public_alibi","innocent_secret"} x4 with ids s1,s2,s3,s4],
 "culprit_id","motive","method","timeline":[4-6 short beats with clock times],
 "clues":[{"id":"c1","text","held_by","points_to","is_red_herring"} x5 with ids c1..c5],
 "alibi_hole","culprit_objective","ending_caught","ending_escaped","roast"}
${COMMON_RULES}
- Exactly 4 suspects with simple, obvious jobs (guard, manager, cleaner, chef, curator, intern) and distinct ways of speaking.
- Exactly 5 clues: 3 TRUE (is_red_herring=false) and 2 RED HERRINGS (is_red_herring=true).
- Each TRUE clue: points_to = culprit_id, and held_by = a DIFFERENT innocent suspect (it is something that suspect saw or knows). The three together prove the culprit.
- Each RED HERRING: points_to an innocent suspect, held_by a different suspect, and is fully explained by the accused suspect's innocent_secret.
- The culprit's innocent_secret field holds the cover story they use.
- The suspects MUST be named exactly: ${names.map((n, i) => `s${i + 1} = ${n}`).join(", ")}.
- The culprit MUST be ${culprit}. Do not choose anyone else.`,
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
    ? `The culprit MUST be ${culpritAmong[Math.floor(Math.random() * culpritAmong.length)]}. Do not choose anyone else.`
    : "Pick the culprit at random from the players.";
  return {
    system: `You are a crime writer designing airtight, realistic case files for a party game where REAL FRIENDS are the suspects and argue out loud for 2 minutes. ${toneGuide(tone)}
Return ONE JSON object with exactly these keys:
{"title","setting","crime","crime_verb","intro","facts":{"what","when","where"},
 "suspects":[{"id","name","role","persona","speaking_style","public_alibi","innocent_secret","private_clues":[2 strings]} one per player, using the EXACT ids and names given],
 "culprit_id","motive","method","timeline":[4-6 short beats with clock times],
 "clues":[],
 "alibi_hole","culprit_objective","ending_caught","ending_escaped","roast",
 "hot_seat":{"player_id","question"}}
${COMMON_RULES}
- ${culpritRule}
- "hot_seat": pick one INNOCENT player and write one short, pointed, incriminating question addressed to them by name that they must answer out loud (e.g. "Priya, why does the access log show your card at the vault door at 9:42?"). It must be explainable by their innocent_secret.
- "role" is what that player was doing at the scene. "public_alibi" is one line they can say out loud.
- private_clues for an INNOCENT player: exactly 2 short first-person observations ("I saw ...", "I heard ..."). Across all innocent players, at least half of these observations must genuinely implicate the culprit; the rest are red herrings that make ANOTHER innocent player look suspicious for a harmless reason.
- Make it a real puzzle: at most ONE clue in the whole case may name the culprit directly. Every other true clue must point at the culprit only through a detail (what they wore or carried, where they stood, a time that breaks their alibi) that players have to match up by talking. Red herrings may name people.
- private_clues for the CULPRIT: exactly 2 short facts they can use to deflect blame onto specific other players (true-sounding and awkward for those players).
- No clue may reveal the culprit outright with certainty by itself; players must combine clues.
- The players are real people: give them fictional jobs in the story, keep it respectful, nothing about looks, religion, caste or gender.`,
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
  const c = sanitizeCase(CaseZ.parse(raw) as CaseFile);
  if (players) {
    // Force exact ids and names so cards always map to real players.
    const byId = new Map(c.suspects.map((s) => [s.id, s]));
    if (players.some((p) => !byId.has(p.id))) throw new Error("missing player in case");
    c.suspects = players.map((p) => ({ ...byId.get(p.id)!, name: p.name }));
    if (culpritAmong && !culpritAmong.includes(c.culprit_id)) throw new Error("culprit is a bot");
    // The culprit's two "cover" clues must point at other people, never at themselves.
    const culprit = c.suspects.find((x) => x.id === c.culprit_id)!;
    const others = c.suspects.filter((x) => x.id !== culprit.id);
    culprit.private_clues = (culprit.private_clues ?? []).map((clue, i) =>
      clue.toLowerCase().includes(culprit.name.toLowerCase())
        ? `${others[i % others.length].name} was hovering near the scene right before it happened.`
        : clue,
    );
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
  const base = FALLBACK_CASES[Math.floor(Math.random() * FALLBACK_CASES.length)];
  return players ? recastForPlayers(base, players, culpritAmong) : structuredClone(base);
}

/**
 * Take any finished four-suspect case and re-cast it onto the real players in
 * a room: one of them becomes the culprit and the clues are dealt out as cards.
 */
export function recastForPlayers(
  source: CaseFile,
  players: { id: string; name: string }[],
  culpritAmong?: string[],
): CaseFile {
  const base = structuredClone(source) as CaseFile;

  const allowed = players
    .map((p, i) => ({ p, i }))
    .filter((x) => !culpritAmong || culpritAmong.includes(x.p.id));
  const culpritIdx = allowed[Math.floor(Math.random() * allowed.length)].i;
  const oldCulprit = base.suspects.find((s) => s.id === base.culprit_id)!;
  const oldInnocents = base.suspects.filter((s) => s.id !== base.culprit_id);
  const culprit = players[culpritIdx];
  // The hand-written text uses both "Soumya Dutta" and "Soumya": swap both.
  const oldFirst = oldCulprit.name.split(" ")[0];
  const swapName = (t: string) =>
    t.split(oldCulprit.name).join(culprit.name).replace(new RegExp(`\\b${oldFirst}\\b`, "g"), culprit.name);
  const truth = base.clues.filter((k) => !k.is_red_herring).map((k) => swapName(k.text));

  let i = 0;
  base.suspects = players.map((p, idx) => {
    if (idx === culpritIdx) {
      const humans = players.filter((x) => x.id !== p.id && (!culpritAmong || culpritAmong.includes(x.id)));
      const scapegoats = humans.length ? humans : players.filter((x) => x.id !== p.id);
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
    // More players than written characters: the extras get their own job and story.
    const extras = [
      { role: "Night-shift security guard", public_alibi: "was at the front desk signing in a courier the whole time" },
      { role: "Intern", public_alibi: "was in the pantry on a long phone call with home" },
      { role: "Visiting auditor", public_alibi: "was in the meeting room going through last month's paperwork" },
      { role: "Driver", public_alibi: "was waiting in the car park with the engine running" },
    ];
    const tpl =
      i < oldInnocents.length
        ? oldInnocents[i]
        : { ...oldInnocents[i % oldInnocents.length], ...extras[(i - oldInnocents.length) % extras.length] };
    // Only point suspicion at real people, never at a bot.
    const other = players.filter(
      (x) => x.id !== p.id && x.id !== culprit.id && (!culpritAmong || culpritAmong.includes(x.id)),
    )[0];
    // Spread the three real clues across the innocents, and give each a
    // different second observation so no two cards read the same.
    const hunches = [
      (n: string) => `${n} left the room for a few minutes right around then.`,
      (n: string) => `${n} was very keen to change the subject afterwards.`,
      (n: string) => `${n} kept checking their phone once it was discovered.`,
      (n: string) => `${n} knew about it before anyone had announced it.`,
    ];
    const clues = [
      truth[i % truth.length],
      i < truth.length - 1 || !other
        ? truth[(i + 1) % truth.length]
        : hunches[i % hunches.length](other.name),
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
  if (!opts.players) {
    const culprit = `s${1 + Math.floor(Math.random() * 4)}`;
    const result = await attempt("solo", soloPrompt(setting, tone, culprit, dealNames(4)));
    // Shuffle the line-up so the guilty one is not always in the same seat.
    result.file.suspects = shuffled(result.file.suspects);
    return result;
  }

  // Real player ids are long UUIDs, which language models copy unreliably.
  // Give the model short ids (p1, p2, ...) and translate back afterwards.
  const short = opts.players.map((p, i) => ({ id: `p${i + 1}`, name: p.name, real: p.id }));
  const toShort = new Map(short.map((p) => [p.real, p.id]));
  const toReal = new Map(short.map((p) => [p.id, p.real]));
  const shortAmong = opts.culpritAmong?.map((id) => toShort.get(id)!).filter(Boolean);
  const players = short.map(({ id, name }) => ({ id, name }));

  const everyone = shortAmong ?? players.map((p) => p.id);
  const result = await attempt("room", roomPrompt(setting, tone, players, everyone), players, shortAmong);
  const f = result.file;
  const real = (id: string) => toReal.get(id) ?? id;
  f.suspects = f.suspects.map((s) => ({ ...s, id: real(s.id) }));
  f.culprit_id = real(f.culprit_id);
  if (f.hot_seat) f.hot_seat = { ...f.hot_seat, player_id: real(f.hot_seat.player_id) };
  return result;
}

const CASE_BUDGET_MS = 12000; // a party cannot stare at a spinner for longer

async function attempt(
  mode: "solo" | "room",
  prompt: { system: string; user: string },
  players?: { id: string; name: string }[],
  culpritAmong?: string[],
): Promise<{ file: CaseFile; source: "ai" | "fallback" }> {
  const started = Date.now();
  for (let n = 0; n < 2; n++) {
    const left = CASE_BUDGET_MS - (Date.now() - started);
    if (left < 2500) break;
    try {
      const raw = await Promise.race([
        chatJSON({ ...prompt, temperature: 0.95, maxTokens: 4000, groqTimeoutMs: Math.min(9000, left) }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("case budget exceeded")), left)),
      ]);
      return { file: parse(raw, mode, players, culpritAmong), source: "ai" };
    } catch (e) {
      console.warn(`[case] attempt ${n + 1} failed:`, (e as Error).message);
    }
  }
  return { file: fallbackFor(players, culpritAmong), source: "fallback" };
}
