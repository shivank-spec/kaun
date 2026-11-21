import crypto from "crypto";
import { chatJSON } from "./ai";
import { generateCase, recastForPlayers } from "./generate-case";
import { drawCase } from "./pool";
import { botNamesFor, botsNeeded } from "./bots";
import { store, type PlayerRow, type RoomRow } from "./store";
import { narrate } from "./voice";
import type {
  CaseFile,
  PlayerCard,
  RoomReveal,
  RoomSettings,
  RoomStatus,
  RoomView,
  Tone,
} from "./types";

// The multiplayer state machine. The SERVER owns the clock: every phase has a
// phase_ends_at timestamp and phases advance here, never on a phone.

export class GameError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const SECONDS = {
  // Briefing is long enough to read the case and your own card properly.
  normal: { briefing: 45, discuss: 100, vote: 30 },
  demo: { briefing: 15, discuss: 45, vote: 20 },
};
// Harder rooms get less time to argue. Every level still fits in three minutes.
const DISCUSS_BY_LEVEL = { easy: 105, medium: 100, hard: 75 } as const;
function timings(settings: RoomSettings) {
  if (settings.demo) return SECONDS.demo;
  return { ...SECONDS.normal, discuss: DISCUSS_BY_LEVEL[settings.difficulty ?? "medium"] };
}
const MIN_HUMANS = 2; // with 2 humans an AI bot fills the third seat
// A room always has at least six suspects: see botsNeeded.
const MAX_PLAYERS = 8;
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();
const cleanName = (n: unknown) => String(n ?? "").replace(/\s+/g, " ").trim().slice(0, 16);
const newCode = () =>
  Array.from({ length: 4 }, () => CODE_LETTERS[crypto.randomInt(CODE_LETTERS.length)]).join("");

function cleanSettings(raw: Partial<RoomSettings> | undefined, base?: RoomSettings): RoomSettings {
  const tone: Tone = raw?.tone === "noir" || raw?.tone === "desi" ? raw.tone : (base?.tone ?? "desi");
  const setting =
    typeof raw?.setting === "string" && raw.setting.trim()
      ? raw.setting.trim().slice(0, 40)
      : (base?.setting ?? "Kolkata");
  const difficulty =
    raw?.difficulty === "easy" || raw?.difficulty === "hard" || raw?.difficulty === "medium"
      ? raw.difficulty
      : (base?.difficulty ?? "medium");
  return { tone, setting, demo: raw?.demo ?? base?.demo ?? false, difficulty, pausedMs: null, fx: null, lastPowers: base?.lastPowers, lastAi: base?.lastAi };
}

/* ---------------- create / join ---------------- */

const knownPower = (v: unknown): v is InnocentPower => INNOCENT_POWERS.includes(v as InnocentPower);

export async function createRoom(name: unknown, settings?: Partial<RoomSettings>, lastPower?: unknown) {
  const hostName = cleanName(name);
  if (!hostName) throw new GameError("Enter your name");
  const db = store();
  for (let i = 0; i < 6; i++) {
    const code = newCode();
    const ok = await db.createRoom({
      code,
      status: "lobby",
      settings: cleanSettings(settings),
      case_file: null,
      phase_ends_at: null,
      reveal: null,
    });
    if (!ok) continue;
    const playerId = crypto.randomUUID();
    await db.addPlayer({
      id: playerId,
      room_code: code,
      name: hostName,
      is_host: true,
      card: null,
      vote: null,
      joined_at: new Date().toISOString(),
    });
    if (knownPower(lastPower)) await db.updateRoomIf(code, "lobby", { settings: { ...cleanSettings(settings), lastPowers: { [playerId]: lastPower } } });
    return { code, playerId };
  }
  throw new GameError("Could not create a room, try again", 500);
}

export async function joinRoom(codeRaw: string, name: unknown, lastPower?: unknown) {
  const code = codeRaw.toUpperCase();
  const db = store();
  const room = await db.getRoom(code);
  if (!room) throw new GameError("No room with that code", 404);
  if (room.status !== "lobby") throw new GameError("That game has already started");
  const players = await db.listPlayers(code);
  if (players.length >= MAX_PLAYERS) throw new GameError("Room is full");
  let clean = cleanName(name);
  if (!clean) throw new GameError("Enter your name");
  // Names must be unique because players vote by name.
  const taken = new Set(players.map((p) => p.name.toLowerCase()));
  for (let n = 2; taken.has(clean.toLowerCase()); n++) clean = `${cleanName(name).slice(0, 14)} ${n}`;
  const playerId = crypto.randomUUID();
  await db.addPlayer({
    id: playerId,
    room_code: code,
    name: clean,
    is_host: false,
    card: null,
    vote: null,
    joined_at: new Date().toISOString(),
  });
  if (knownPower(lastPower)) {
    await db.updateRoomIf(code, "lobby", { settings: { ...room.settings, lastPowers: { ...room.settings.lastPowers, [playerId]: lastPower } } });
  }
  return { playerId };
}

/* ---------------- start ---------------- */

const keepCase = (from: string, to: string) => (/^[A-Z]/.test(from) ? to[0].toUpperCase() + to.slice(1) : to);
const BE: Record<string, string> = { was: "were", is: "are", has: "have", does: "do", "wasn't": "weren't", "isn't": "aren't", "hasn't": "haven't", "doesn't": "don't" };

/** Rewrite he/she wording as they/their, so a story never mismatches a player's name. */
export function neutralText(text: string): string {
  return text
    .replace(/\b(he|she)\s+(was|is|has|does|wasn't|isn't|hasn't|doesn't)\b/gi, (m, _p, v: string) => `${keepCase(m, "they")} ${BE[v.toLowerCase()]}`)
    .replace(/\b(he|she)'s\b/gi, (m) => keepCase(m, "they're"))
    .replace(/\b(he|she)\b/gi, (m) => keepCase(m, "they"))
    .replace(/\b(himself|herself)\b/gi, (m) => keepCase(m, "themselves"))
    .replace(/\bhers\b/gi, (m) => keepCase(m, "theirs"))
    .replace(/\bhim\b/gi, (m) => keepCase(m, "them"))
    .replace(/\bhis\b/gi, (m) => keepCase(m, "their"))
    // "her" is "them" before a pause or a small joining word, otherwise "their".
    .replace(/\bher\b(?=\s*([.,;:!?)"”]|$|\s(?:and|or|but|to|at|in|on|with|for|from|when|as|that|about|of|by|after|before|if|while|so)\b))/gi, (m) => keepCase(m, "them"))
    .replace(/\bher\b/gi, (m) => keepCase(m, "their"));
}

function neutralCase<T>(value: T): T {
  if (typeof value === "string") return neutralText(value) as T;
  if (Array.isArray(value)) return value.map(neutralCase) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, /id$/i.test(k) || k === "held_by" || k === "points_to" ? v : neutralCase(v)])) as T;
  }
  return value;
}


const INNOCENT_POWERS = ["detector", "clear", "extra"] as const;
type InnocentPower = (typeof INNOCENT_POWERS)[number];

function buildCard(file: CaseFile, playerId: string, power: InnocentPower = "detector"): PlayerCard {
  const me = file.suspects.find((s) => s.id === playerId)!;
  const clues = (me.private_clues ?? []).slice(0, 2);
  if (playerId === file.culprit_id) {
    return {
      role: "culprit",
      mission: "YOU ARE THE CULPRIT. Lie. Blame someone else.",
      clues,
      objective: file.culprit_objective,
      job: me.role,
      story: me.public_alibi,
      powers: { plant: true, blackout: true },
    };
  }
  return {
    role: "innocent",
    mission: `YOU ARE INNOCENT. Find who ${file.crime_verb}.`,
    clues,
    job: me.role,
    story: me.public_alibi,
    powers: { [power]: true },
  };
}

export async function startRoom(
  codeRaw: string,
  playerId: string,
  settings?: Partial<RoomSettings>,
) {
  const code = codeRaw.toUpperCase();
  const db = store();
  const room = await db.getRoom(code);
  if (!room) throw new GameError("No room with that code", 404);
  const players = await db.listPlayers(code);
  const me = players.find((p) => p.id === playerId);
  if (!me?.is_host) throw new GameError("Only the host can start", 403);
  const humans = players.filter((p) => !p.is_bot);
  if (humans.length < MIN_HUMANS) throw new GameError(`Need at least ${MIN_HUMANS} players`);

  const merged = cleanSettings(settings, room.settings);
  // Claim the transition so a double tap cannot start two cases.
  const claimed = await db.updateRoomIf(code, "lobby", {
    status: "generating",
    settings: merged,
    phase_ends_at: null,
    reveal: null,
  });
  if (!claimed) return { ok: true };

  try {
    // Fill empty seats with AI bots so two people can still play a full room.
    const taken = new Set(players.map((p) => p.name.toLowerCase().split(" ")[0]));
    const botNames = botNamesFor(code, [...taken]);
    const want = botsNeeded(humans.length);
    for (let i = 0; players.filter((p) => p.is_bot).length < want; i++) {
      const bot: PlayerRow = {
        id: crypto.randomUUID(),
        room_code: code,
        name: botNames[i % botNames.length],
        is_host: false,
        is_bot: true,
        card: null,
        vote: null,
        joined_at: new Date().toISOString(),
      };
      await db.addPlayer(bot);
      players.push(bot);
    }
    const cast = players.map((p) => ({ id: p.id, name: p.name }));
    // In a small room any of the suspects can be guilty, including an AI one.
    // Otherwise two friends would always know it is the other one.
    // A real player is the culprit most of the time (6 in 10), and always in the
    // round after an AI was. With four or more friends it is always a real player.
    const botIds = players.filter((p) => p.is_bot).map((p) => p.id);
    const aiGuilty = humans.length < 4 && botIds.length > 0 && !room.settings.lastAi && Math.random() < 0.4;
    const humanIds = aiGuilty ? botIds : humans.map((p) => p.id);
    const made = await generateCase({
      setting: merged.setting,
      tone: merged.tone,
      players: cast,
      culpritAmong: humanIds,
      budgetMs: 7000, // a room full of people should not wait: after 7 s use a banked case
    });
    let file = made.file;
    if (made.source === "fallback") {
      // The AI was busy. A case from the bank, re-cast onto these players, is
      // fresher than one of the four built-in ones.
      const banked = await drawCase(/hackathon/i.test(merged.setting) ? "hackathon" : "kolkata", merged.tone, []).catch(() => null);
      if (banked) file = recastForPlayers(banked.file, cast, humanIds);
    }
    // The story may have been written for someone else, so nobody is a he or a she.
    file = neutralCase(file);
    // Deal the innocent powers round the table, so friends hold different ones each round.
    // Nobody gets the power they held last time, and the table is as mixed as possible.
    const last = room.settings.lastPowers ?? {};
    const dealt: Record<string, InnocentPower> = {};
    const count: Record<string, number> = {};
    for (const p of players) {
      const options = INNOCENT_POWERS.filter((k) => k !== last[p.id]).sort(() => Math.random() - 0.5);
      const pick = options.sort((a, b) => (count[a] ?? 0) - (count[b] ?? 0))[0];
      dealt[p.id] = pick;
      count[pick] = (count[pick] ?? 0) + 1;
    }
    const lastPowers = Object.fromEntries(humans.map((p) => [p.id, p.id === file.culprit_id ? (last[p.id] ?? "") : dealt[p.id]]));
    await Promise.all(
      players.map((p) => db.updatePlayer(p.id, { card: buildCard(file, p.id, dealt[p.id]), vote: null, doubt: null })),
    );
    const t = timings(merged);
    await db.updateRoomIf(code, "generating", {
      status: "briefing",
      settings: { ...merged, lastPowers, lastAi: botIds.includes(file.culprit_id) },
      case_file: file,
      phase_ends_at: inSeconds(t.briefing),
    });
  } catch (e) {
    await db.updateRoomIf(code, "generating", { status: "lobby" });
    throw e;
  }
  return { ok: true };
}

/* ---------------- vote / reveal ---------------- */

/** The narrator's script for an ending. Both are known from the start of the round. */
const narrationOf = (file: CaseFile, caught: boolean) =>
  `${caught ? file.ending_caught : escapedEnding(file)} ${file.roast}`;

/**
 * The AI sometimes writes an "escaped" ending that still has the culprit
 * arrested. If it does, say the plain truth instead.
 */
export function escapedEnding(file: CaseFile): string {
  const name = file.suspects.find((s) => s.id === file.culprit_id)?.name.split(" ")[0] ?? "The culprit";
  const text = (file.ending_escaped ?? "").trim();
  const wrong = text.length < 20 || /\b(arrest|caught|confess|handcuff|jail|none|null|n\/a)/i.test(text);
  return wrong ? `${name} did it, and walked away free. Nobody in the room worked it out in time.` : text;
}

function buildReveal(file: CaseFile, players: PlayerRow[], fx?: RoomSettings["fx"]): RoomReveal {
  const nameOf = (id: string | null) => players.find((p) => p.id === id)?.name ?? "nobody";
  const tricks: string[] = [];
  for (const p of fx?.planted ?? []) tricks.push(`${nameOf(p.byId)} planted fake evidence against ${nameOf(p.targetId)}`);
  if (fx?.blackoutBy) tricks.push(`${nameOf(fx.blackoutBy)} cut the lights`);
  for (const id of fx?.detectors ?? []) tricks.push(`${nameOf(id)} used a lie detector`);
  for (const note of fx?.notes ?? []) tricks.push(note);
  const tally = new Map<string, number>();
  for (const p of players) if (p.vote) tally.set(p.vote, (tally.get(p.vote) ?? 0) + 1);
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  // A tie means the group could not agree, so nobody is caught.
  const accusedId = ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null;
  const caught = accusedId === file.culprit_id;
  const framed = accusedId && !caught ? `${nameOf(accusedId)} was innocent. ` : "";
  const noVerdict = !accusedId ? "The group could not agree, so nobody was arrested. " : "";
  return {
    tricks,
    culpritId: file.culprit_id,
    culpritName: nameOf(file.culprit_id),
    accusedId,
    accusedName: accusedId ? nameOf(accusedId) : null,
    caught,
    story: caught ? file.ending_caught : `${framed}${noVerdict}${escapedEnding(file)}`,
    narration: narrationOf(file, caught),
    roast: file.roast,
    why: file.motive,
    how: file.method,
    votes: players
      .filter((p) => p.vote)
      .map((p) => ({
        voterId: p.id,
        voterName: p.name,
        targetId: p.vote!,
        targetName: nameOf(p.vote),
      })),
  };
}

export async function castVote(codeRaw: string, playerId: string, targetId: string) {
  const code = codeRaw.toUpperCase();
  const db = store();
  const room = await db.getRoom(code);
  if (!room) throw new GameError("No room with that code", 404);
  // Allow an early vote in the last seconds of discussion too.
  if (room.status !== "vote" && room.status !== "discuss") throw new GameError("Voting is closed");
  const players = await db.listPlayers(code);
  const me = players.find((p) => p.id === playerId);
  if (!me) throw new GameError("You are not in this room", 403);
  if (me.vote) throw new GameError("You have already voted", 409);
  if (!players.some((p) => p.id === targetId)) throw new GameError("Unknown player");
  if (targetId === playerId) throw new GameError("You cannot vote for yourself");
  await db.updatePlayer(playerId, { vote: targetId });
  return { ok: true };
}

const POKE_SECONDS = 60;

/**
 * Ask a suspect a question during the discussion.
 * An AI suspect answers in character straight away. A human suspect gets the
 * question on their own phone and has to answer out loud.
 */
export async function askSuspect(codeRaw: string, playerId: string, targetId: string, rawQuestion: unknown) {
  const code = codeRaw.toUpperCase();
  const db = store();
  const room = await db.getRoom(code);
  if (!room) throw new GameError("No room with that code", 404);
  if (room.status !== "discuss" || !room.case_file) throw new GameError("Questions are closed");
  const players = await db.listPlayers(code);
  const me = players.find((p) => p.id === playerId);
  const target = players.find((p) => p.id === targetId);
  if (!me || !target || target.id === me.id) throw new GameError("Pick someone to question");
  const question = String(rawQuestion ?? "").replace(/\s+/g, " ").trim().slice(0, 140) || "Where were you?";

  if (!target.is_bot) {
    await db.updatePlayer(target.id, { poke: { fromName: me.name, question, at: new Date().toISOString() } });
    return { delivered: true };
  }

  const file = room.case_file;
  const who = file.suspects.find((x) => x.id === target.id);
  if (!who) return { reply: "I have nothing to add." };
  const saw = (who.private_clues ?? []).join(" / ");
  const guilty = who.id === file.culprit_id;
  const brief = guilty
    ? `You are GUILTY: you ${file.crime_verb}. Nobody knows yet and you must not get caught.
CASE: ${file.title}. ${file.crime}
Your cover story (stick to it): ${who.public_alibi}
The weak spot in your story: ${file.alibi_hole}
Your goal: ${file.culprit_objective}
Personality: ${who.persona}. You speak like this: ${who.speaking_style}.
Answer in 1-2 short, vivid sentences, in character, plain English, no jargon. Lie smoothly and point the finger at someone else. If the question touches the weak spot, get flustered: dodge, contradict yourself slightly, or change the subject. NEVER confess.`
    : `You are INNOCENT, but nervous.
CASE: ${file.title}. ${file.crime}
Your story: ${who.public_alibi}
Something private you would rather hide (not a crime): ${who.innocent_secret}
What you noticed that night: ${saw || "nothing unusual"}
Personality: ${who.persona}. You speak like this: ${who.speaking_style}.
Answer the question in 1-2 short, vivid sentences, in character, plain English, no jargon. If asked what you saw or who you suspect, share what you noticed. Never name the culprit as a fact; you only know what you saw.`;
  try {
    const raw = (await chatJSON({
      kind: "chat",
      temperature: 0.95,
      maxTokens: 400,
      groqTimeoutMs: 6000,
      system: `You are ${who.name}, ${who.role}, a suspect being questioned in a tense crime drama. ${brief}
Return ONLY JSON: {"reply": string}`,
      user: `${me.name} asks you: ${question}`,
    })) as { reply?: unknown };
    const reply = typeof raw.reply === "string" && raw.reply.trim() ? raw.reply.trim() : "";
    if (reply) return { reply };
  } catch {
    // fall through to a line built from the case facts
  }
  if (guilty) return { reply: `${who.public_alibi}. Why are you asking me? Ask the others where they were.` };
  return { reply: saw ? `${who.public_alibi}. But I will tell you this: ${(who.private_clues ?? [])[0]}` : `${who.public_alibi}. That is all I know.` };
}

const BLACKOUT_SECONDS = 10;
const PLANT_LINES = [
  (n: string, where: string) => `An anonymous tip: ${n} was seen slipping out of ${where} just before it was discovered.`,
  (n: string) => `A note pushed under the door: "Ask ${n} where they really were. They are not telling you everything."`,
  (n: string) => `Found in the bin: a torn page with ${n}'s handwriting, listing the exact time it happened.`,
  (n: string) => `A cleaner swears ${n} asked them to "forget" what they saw that night.`,
];

/**
 * Secret powers. The culprit can plant fake evidence or cut the lights; each
 * innocent gets one lie detector. Every check happens here on the server, so a
 * phone cannot grant itself a power or learn who used one.
 */
export async function playPower(
  codeRaw: string,
  playerId: string,
  power: string,
  opts: { targetId?: string; evidenceId?: string },
) {
  const code = codeRaw.toUpperCase();
  const db = store();
  const room = await db.getRoom(code);
  if (!room) throw new GameError("No room with that code", 404);
  if (room.status !== "discuss" || !room.case_file) throw new GameError("Powers only work during the discussion");
  const players = await db.listPlayers(code);
  const me = players.find((p) => p.id === playerId);
  if (!me?.card) throw new GameError("You are not in this round", 403);
  const fx = room.settings.fx ?? { planted: [], detectors: [] };
  const powers = me.card.powers ?? {};
  const spend = (key: "plant" | "blackout" | "detector" | "clear" | "extra") =>
    db.updatePlayer(me.id, { card: { ...me.card!, powers: { ...powers, [key]: false } } });
  const saveFx = (next: NonNullable<RoomSettings["fx"]>) =>
    db.updateRoomIf(code, "discuss", { settings: { ...room.settings, fx: next } });

  if (power === "plant") {
    if (me.card.role !== "culprit" || !powers.plant) throw new GameError("You cannot do that");
    const target = players.find((p) => p.id === opts.targetId && p.id !== me.id);
    if (!target) throw new GameError("Pick someone to frame");
    const where = room.case_file.facts?.where ?? "the room";
    const line = PLANT_LINES[crypto.randomInt(PLANT_LINES.length)](target.name.split(" ")[0], where.replace(/\.$/, ""));
    await saveFx({ ...fx, planted: [...fx.planted, { id: crypto.randomUUID(), text: line, byId: me.id, targetId: target.id, at: new Date().toISOString() }] });
    await spend("plant");
    return { ok: true };
  }

  if (power === "blackout") {
    if (me.card.role !== "culprit" || !powers.blackout) throw new GameError("You cannot do that");
    await saveFx({ ...fx, blackoutUntil: inSeconds(BLACKOUT_SECONDS), blackoutBy: me.id });
    await spend("blackout");
    return { ok: true };
  }

  if (power === "detector") {
    if (me.card.role !== "innocent" || !powers.detector) throw new GameError("You have already used it");
    const fake = fx.planted.some((p) => p.id === opts.evidenceId);
    await saveFx({ ...fx, detectors: [...fx.detectors, me.id] });
    await spend("detector");
    return { ok: true, real: !fake };
  }

  if (power === "clear") {
    if (me.card.role !== "innocent" || !powers.clear) throw new GameError("You have already used it");
    // Name one suspect who certainly did not do it.
    const safe = players.filter((p) => p.id !== me.id && p.id !== room.case_file!.culprit_id);
    if (!safe.length) throw new GameError("Nobody to check");
    const pick = safe[crypto.randomInt(safe.length)];
    await saveFx({ ...fx, notes: [...(fx.notes ?? []), `${me.name} ran a background check`] });
    await spend("clear");
    return { ok: true, clearedName: pick.name };
  }

  if (power === "extra") {
    if (me.card.role !== "innocent" || !powers.extra) throw new GameError("You have already used it");
    await saveFx({ ...fx, notes: [...(fx.notes ?? []), `${me.name} took extra questions`] });
    await spend("extra");
    return { ok: true, extra: 3 };
  }

  throw new GameError("Unknown power");
}

/** The host can freeze the clock at any time, and start it again. */
export async function togglePause(codeRaw: string, playerId: string) {
  const code = codeRaw.toUpperCase();
  const db = store();
  const room = await db.getRoom(code);
  if (!room) throw new GameError("No room with that code", 404);
  const players = await db.listPlayers(code);
  if (!players.find((p) => p.id === playerId)?.is_host) throw new GameError("Only the host can pause", 403);
  if (room.status !== "briefing" && room.status !== "discuss" && room.status !== "vote") return { ok: true, paused: false };

  if (room.settings.pausedMs != null) {
    // Resume: the phase gets back exactly the time it had left.
    await db.updateRoomIf(code, room.status, {
      settings: { ...room.settings, pausedMs: null },
      phase_ends_at: new Date(Date.now() + room.settings.pausedMs).toISOString(),
    });
    return { ok: true, paused: false };
  }
  const left = room.phase_ends_at ? Math.max(1000, Date.parse(room.phase_ends_at) - Date.now()) : 1000;
  await db.updateRoomIf(code, room.status, {
    settings: { ...room.settings, pausedMs: left },
    phase_ends_at: null,
  });
  return { ok: true, paused: true };
}

/** The host can cut a phase short once everyone is ready. */
export async function skipPhase(codeRaw: string, playerId: string) {
  const code = codeRaw.toUpperCase();
  const db = store();
  const room = await db.getRoom(code);
  if (!room) throw new GameError("No room with that code", 404);
  const players = await db.listPlayers(code);
  if (!players.find((p) => p.id === playerId)?.is_host) throw new GameError("Only the host can do that", 403);
  if (room.status === "briefing" || room.status === "discuss") {
    await db.updateRoomIf(code, room.status, {
      phase_ends_at: new Date().toISOString(),
      settings: { ...room.settings, pausedMs: null },
    });
  }
  return { ok: true };
}

/** Mark (or clear) who you doubt. Feeds the live suspicion meters. */
export async function setDoubt(codeRaw: string, playerId: string, targetId: string | null) {
  const code = codeRaw.toUpperCase();
  const db = store();
  const room = await db.getRoom(code);
  if (!room) throw new GameError("No room with that code", 404);
  if (room.status !== "discuss" && room.status !== "vote") return { ok: true };
  const players = await db.listPlayers(code);
  if (!players.some((p) => p.id === playerId)) throw new GameError("You are not in this room", 403);
  const target = targetId && targetId !== playerId && players.some((p) => p.id === targetId) ? targetId : null;
  await db.updatePlayer(playerId, { doubt: target });
  return { ok: true };
}

/**
 * Record the narrator reading both possible endings while the room is still
 * arguing, so the reveal plays the instant the votes are in. Returns nothing
 * about the case, so calling it cannot leak who did it.
 */
export async function warmNarration(codeRaw: string, playerId: string) {
  const code = codeRaw.toUpperCase();
  const db = store();
  const room = await db.getRoom(code);
  if (!room?.case_file || (room.status !== "discuss" && room.status !== "vote")) return { ok: true };
  const players = await db.listPlayers(code);
  if (!players.some((p) => p.id === playerId)) throw new GameError("You are not in this room", 403);
  const noir = room.settings.tone === "noir";
  // One at a time: the voice model rejects parallel requests. Retry once if busy.
  let ready = 0;
  for (const caught of [true, false]) {
    const text = narrationOf(room.case_file, caught);
    let out = await narrate(text, noir);
    if (!out) {
      await new Promise((r) => setTimeout(r, 4000));
      out = await narrate(text, noir);
    }
    if (out) ready++;
  }
  return { ok: true, ready };
}

export async function playAgain(codeRaw: string, playerId: string) {
  const code = codeRaw.toUpperCase();
  const db = store();
  const players = await db.listPlayers(code);
  if (!players.find((p) => p.id === playerId)?.is_host) throw new GameError("Only the host can restart", 403);
  await db.resetPlayers(code);
  await db.updateRoomIf(code, "reveal", {
    status: "lobby",
    case_file: null,
    phase_ends_at: null,
    reveal: null,
  });
  return { ok: true };
}

/* ---------------- the clock ---------------- */

/** Move the room forward if its phase has run out. Safe to call from every poll. */
async function advance(room: RoomRow, players: PlayerRow[]): Promise<RoomRow> {
  const db = store();
  if (room.settings.pausedMs != null) return room; // the host has frozen the clock
  const t = timings(room.settings);
  const expired = room.phase_ends_at ? Date.now() >= Date.parse(room.phase_ends_at) : false;
  let next: { expected: RoomStatus; patch: Partial<RoomRow> } | null = null;

  if (room.status === "briefing" && expired) {
    next = { expected: "briefing", patch: { status: "discuss", phase_ends_at: inSeconds(t.discuss) } };
  } else if (room.status === "discuss" && expired) {
    next = { expected: "discuss", patch: { status: "vote", phase_ends_at: inSeconds(t.vote) } };
  } else if (
    room.status === "vote" &&
    room.case_file &&
    (expired || players.every((p) => p.vote))
  ) {
    next = {
      expected: "vote",
      patch: { status: "reveal", phase_ends_at: null, reveal: buildReveal(room.case_file, players, room.settings.fx) },
    };
  }
  if (!next) {
    if (room.status === "discuss" && (await botTricks(room, players, t.discuss))) {
      return (await db.getRoom(room.code)) ?? room;
    }
    return room;
  }
  const moved = await db.updateRoomIf(room.code, next.expected, next.patch);
  if (moved && next.patch.status === "vote" && room.case_file) {
    // Bots vote the moment voting opens: right about half the time.
    const culprit = room.case_file.culprit_id;
    await Promise.all(
      players
        .filter((p) => p.is_bot && !p.vote)
        .map((bot) => {
          const others = players.filter((p) => p.id !== bot.id);
          const framed = room.settings.fx?.planted.find((x) => x.byId === bot.id)?.targetId;
          const random = others[crypto.randomInt(others.length)].id;
          const guess = bot.id === culprit ? (framed ?? random) : Math.random() < 0.5 ? culprit : random;
          return db.updatePlayer(bot.id, { vote: guess });
        }),
    );
  }
  return (await db.getRoom(room.code)) ?? room;
}

/**
 * A guilty AI suspect fights back: it plants fake evidence against a real
 * player early on, then cuts the lights later. Both choices are fixed by the
 * room code, so two polls landing together write the same thing.
 */
async function botTricks(room: RoomRow, players: PlayerRow[], discussSec: number): Promise<boolean> {
  const file = room.case_file;
  if (!file || !room.phase_ends_at) return false;
  const bot = players.find((p) => p.id === file.culprit_id && p.is_bot);
  const humans = players.filter((p) => !p.is_bot).sort((a, b) => a.id.localeCompare(b.id));
  if (!bot || !humans.length) return false;
  const done = 1 - (Date.parse(room.phase_ends_at) - Date.now()) / (discussSec * 1000);
  const fx = room.settings.fx ?? { planted: [], detectors: [] };
  const seed = room.code.charCodeAt(0) + room.code.charCodeAt(room.code.length - 1);
  const save = (next: NonNullable<RoomSettings["fx"]>) =>
    store().updateRoomIf(room.code, "discuss", { settings: { ...room.settings, fx: next } });
  const plantId = `bot-${bot.id}`;
  if (done >= 0.3 && !fx.planted.some((p) => p.id === plantId)) {
    const target = humans[seed % humans.length];
    const where = (file.facts?.where ?? "the room").replace(/\.$/, "");
    const text = PLANT_LINES[seed % PLANT_LINES.length](target.name.split(" ")[0], where);
    await save({ ...fx, planted: [...fx.planted, { id: plantId, text, byId: bot.id, targetId: target.id, at: new Date().toISOString() }] });
    return true;
  }
  if (done >= 0.6 && !fx.blackoutBy) {
    await save({ ...fx, blackoutUntil: inSeconds(BLACKOUT_SECONDS), blackoutBy: bot.id });
    return true;
  }
  return false;
}

/** A question fired at this player stays on their screen for a few seconds. */
function pokeOf(p: PlayerRow) {
  if (!p.poke) return null;
  const end = Date.parse(p.poke.at) + POKE_SECONDS * 1000;
  if (Date.now() >= end) return null;
  return { fromName: p.poke.fromName, question: p.poke.question, endsAt: new Date(end).toISOString() };
}

const HOT_SEAT_SECONDS = 15;

/** The hot seat question is live for 15 s starting at the halfway point of discussion. */
function hotSeatNow(room: RoomRow, players: PlayerRow[]) {
  const hs = room.case_file?.hot_seat;
  if (room.status !== "discuss" || !hs || !room.phase_ends_at) return null;
  const total = timings(room.settings).discuss * 1000;
  const start = Date.parse(room.phase_ends_at) - total / 2;
  const end = start + HOT_SEAT_SECONDS * 1000;
  const target = players.find((p) => p.id === hs.player_id && !p.is_bot);
  if (!target || Date.now() < start || Date.now() >= end) return null;
  return {
    playerId: target.id,
    playerName: target.name,
    question: hs.question,
    endsAt: new Date(end).toISOString(),
  };
}

/** What one player is allowed to see. Secrets never leave the server early. */
export async function getRoomView(codeRaw: string, playerId: string | null): Promise<RoomView> {
  const code = codeRaw.toUpperCase();
  const db = store();
  let room = await db.getRoom(code);
  if (!room) throw new GameError("No room with that code", 404);
  const players = await db.listPlayers(code);
  room = await advance(room, players);

  const me = players.find((p) => p.id === playerId) ?? null;
  const showCard = room.status !== "lobby" && room.status !== "generating";
  const f = room.case_file;
  const humans = players.filter((p) => !p.is_bot);
  // What the bots saw is released one piece at a time while people talk.
  const evidence = showCard
    ? players
        .filter((p) => p.is_bot)
        .flatMap((p) => (p.card?.clues ?? []).map((text) => ({ from: p.name, text })))
    : [];
  let dropped = 0;
  const pausedMs = room.settings.pausedMs ?? null;
  if (room.status === "discuss" && (room.phase_ends_at || pausedMs != null)) {
    const total = timings(room.settings).discuss * 1000;
    const leftMs = pausedMs != null ? pausedMs : Date.parse(room.phase_ends_at!) - Date.now();
    const elapsed = total - leftMs;
    // First piece almost at once, the last with about a fifth of the time left.
    dropped = Math.min(evidence.length, 1 + Math.floor((elapsed / (total * 0.8)) * (evidence.length - 1)));
  } else if (room.status === "vote" || room.status === "reveal") {
    dropped = evidence.length;
  }
  // Planted evidence looks exactly like the real thing, and lands when it was planted.
  const fxNow = room.settings.fx ?? null;
  const planted = room.status === "lobby" || room.status === "generating" ? [] : (fxNow?.planted ?? []);
  const feed = [
    ...evidence.slice(0, dropped).map((e, i) => ({ id: `e${i}`, ...e })),
    ...planted.map((p) => ({ id: p.id, from: "an anonymous tip", text: p.text })),
  ];
  const doubtOf = (id: string) => {
    const voters = humans.filter((p) => p.id !== id);
    if (!voters.length) return 0;
    return Math.round((voters.filter((p) => p.doubt === id).length / voters.length) * 100);
  };
  return {
    code: room.code,
    status: room.status,
    phaseEndsAt: room.phase_ends_at,
    serverNow: new Date().toISOString(),
    paused: pausedMs != null,
    pausedSecondsLeft: pausedMs != null ? Math.ceil(pausedMs / 1000) : undefined,
    phaseTotalSec:
      room.status === "briefing" || room.status === "discuss" || room.status === "vote"
        ? timings(room.settings)[room.status]
        : undefined,
    // Never send the secret-power log: it says who planted what.
    settings: { ...room.settings, fx: undefined },
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.is_host,
      hasVoted: Boolean(p.vote),
      doubt: doubtOf(p.id),
      ...(p.is_bot ? { isBot: true } : {}),
      ...(showCard && f
        ? (() => {
            const part = f.suspects.find((x) => x.id === p.id);
            return part ? { caseRole: part.role, alibi: part.public_alibi } : {};
          })()
        : {}),
    })),
    you: me
      ? {
          id: me.id,
          name: me.name,
          isHost: me.is_host,
          card: showCard ? me.card : null,
          doubting: me.doubt ?? null,
          poke: pokeOf(me),
          votedFor: me.vote ?? null,
        }
      : null,
    case: f && showCard ? { title: f.title, crime: f.crime, intro: f.intro, setting: f.setting, facts: f.facts } : null,
    reveal: room.status === "reveal" ? room.reveal : null,
    hotSeat: hotSeatNow(room, players),
    botClues: feed,
    evidenceTotal: evidence.length + planted.length,
    blackoutUntil:
      room.status === "discuss" && fxNow?.blackoutUntil && Date.parse(fxNow.blackoutUntil) > Date.now()
        ? fxNow.blackoutUntil
        : null,
  };
}
