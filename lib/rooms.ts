import crypto from "crypto";
import { generateCase } from "./generate-case";
import { store, type PlayerRow, type RoomRow } from "./store";
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
  normal: { briefing: 20, discuss: 100, vote: 30 },
  demo: { briefing: 10, discuss: 45, vote: 20 },
};
const MIN_PLAYERS = 3;
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
  return { tone, setting, demo: raw?.demo ?? base?.demo ?? false };
}

/* ---------------- create / join ---------------- */

export async function createRoom(name: unknown, settings?: Partial<RoomSettings>) {
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
    return { code, playerId };
  }
  throw new GameError("Could not create a room, try again", 500);
}

export async function joinRoom(codeRaw: string, name: unknown) {
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
  return { playerId };
}

/* ---------------- start ---------------- */

function buildCard(file: CaseFile, playerId: string): PlayerCard {
  const me = file.suspects.find((s) => s.id === playerId)!;
  const clues = (me.private_clues ?? []).slice(0, 2);
  if (playerId === file.culprit_id) {
    return {
      role: "culprit",
      mission: "YOU ARE THE CULPRIT. Lie. Blame someone else.",
      clues,
      objective: file.culprit_objective,
    };
  }
  return { role: "innocent", mission: `YOU ARE INNOCENT. Find who ${file.crime_verb}.`, clues };
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
  if (players.length < MIN_PLAYERS) throw new GameError(`Need at least ${MIN_PLAYERS} players`);

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
    const { file } = await generateCase({
      setting: merged.setting,
      tone: merged.tone,
      players: players.map((p) => ({ id: p.id, name: p.name })),
    });
    await Promise.all(
      players.map((p) => db.updatePlayer(p.id, { card: buildCard(file, p.id), vote: null })),
    );
    const t = merged.demo ? SECONDS.demo : SECONDS.normal;
    await db.updateRoomIf(code, "generating", {
      status: "briefing",
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

function buildReveal(file: CaseFile, players: PlayerRow[]): RoomReveal {
  const nameOf = (id: string | null) => players.find((p) => p.id === id)?.name ?? "nobody";
  const tally = new Map<string, number>();
  for (const p of players) if (p.vote) tally.set(p.vote, (tally.get(p.vote) ?? 0) + 1);
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  // A tie means the group could not agree, so nobody is caught.
  const accusedId = ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null;
  const caught = accusedId === file.culprit_id;
  const framed = accusedId && !caught ? `${nameOf(accusedId)} was innocent. ` : "";
  const noVerdict = !accusedId ? "The group could not agree, so nobody was arrested. " : "";
  return {
    culpritId: file.culprit_id,
    culpritName: nameOf(file.culprit_id),
    accusedId,
    accusedName: accusedId ? nameOf(accusedId) : null,
    caught,
    story: caught ? file.ending_caught : `${framed}${noVerdict}${file.ending_escaped}`,
    roast: file.roast,
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
  const t = room.settings.demo ? SECONDS.demo : SECONDS.normal;
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
      patch: { status: "reveal", phase_ends_at: null, reveal: buildReveal(room.case_file, players) },
    };
  }
  if (!next) return room;
  await db.updateRoomIf(room.code, next.expected, next.patch);
  return (await db.getRoom(room.code)) ?? room;
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
  return {
    code: room.code,
    status: room.status,
    phaseEndsAt: room.phase_ends_at,
    serverNow: new Date().toISOString(),
    settings: room.settings,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.is_host,
      hasVoted: Boolean(p.vote),
    })),
    you: me ? { id: me.id, name: me.name, isHost: me.is_host, card: showCard ? me.card : null } : null,
    case: f && showCard ? { title: f.title, crime: f.crime, intro: f.intro } : null,
    reveal: room.status === "reveal" ? room.reveal : null,
  };
}
