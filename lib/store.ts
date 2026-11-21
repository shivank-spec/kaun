import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CaseFile, PlayerCard, RoomReveal, RoomSettings, RoomStatus } from "./types";

// Server-only storage for multiplayer rooms.
// Uses Supabase Postgres when configured; otherwise an in-memory map so the
// game still runs in local dev (and on a single warm server) without a database.

export interface RoomRow {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  case_file: CaseFile | null;
  phase_ends_at: string | null;
  reveal: RoomReveal | null;
}

export interface PlayerRow {
  id: string;
  room_code: string;
  name: string;
  is_host: boolean;
  is_bot?: boolean;
  card: PlayerCard | null;
  vote: string | null;
  doubt?: string | null;
  poke?: { fromName: string; question: string; at: string } | null;
  joined_at: string;
}

export interface Store {
  getRoom(code: string): Promise<RoomRow | null>;
  createRoom(row: RoomRow): Promise<boolean>; // false if the code is taken
  /** Update only if the room is still in `expected` status. Returns true if it changed. */
  updateRoomIf(code: string, expected: RoomStatus, patch: Partial<RoomRow>): Promise<boolean>;
  listPlayers(code: string): Promise<PlayerRow[]>;
  addPlayer(row: PlayerRow): Promise<void>;
  updatePlayer(id: string, patch: Partial<PlayerRow>): Promise<void>;
  /** Clear cards and votes, and remove AI bots, ready for a new round. */
  resetPlayers(code: string): Promise<void>;
}

/* ---------------- in-memory ---------------- */

type Mem = { rooms: Map<string, RoomRow>; players: Map<string, PlayerRow> };
const g = globalThis as unknown as { __kaun?: Mem };
const mem = (g.__kaun ??= { rooms: new Map(), players: new Map() });

const memoryStore: Store = {
  async getRoom(code) {
    return mem.rooms.get(code) ?? null;
  },
  async createRoom(row) {
    if (mem.rooms.has(row.code)) return false;
    mem.rooms.set(row.code, row);
    return true;
  },
  async updateRoomIf(code, expected, patch) {
    const r = mem.rooms.get(code);
    if (!r || r.status !== expected) return false;
    mem.rooms.set(code, { ...r, ...patch });
    return true;
  },
  async listPlayers(code) {
    return [...mem.players.values()]
      .filter((p) => p.room_code === code)
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  },
  async addPlayer(row) {
    mem.players.set(row.id, row);
  },
  async updatePlayer(id, patch) {
    const p = mem.players.get(id);
    if (p) mem.players.set(id, { ...p, ...patch });
  },
  async resetPlayers(code) {
    for (const p of [...mem.players.values()]) {
      if (p.room_code !== code) continue;
      if (p.is_bot) mem.players.delete(p.id);
      else mem.players.set(p.id, { ...p, card: null, vote: null, doubt: null, poke: null });
    }
  },
};

/* ---------------- Supabase ---------------- */

function supabaseStore(db: SupabaseClient): Store {
  const must = <T>(r: { data: T; error: { message: string } | null }) => {
    if (r.error) throw new Error(`db: ${r.error.message}`);
    return r.data;
  };
  return {
    async getRoom(code) {
      return must(await db.from("rooms").select("*").eq("code", code).maybeSingle()) as RoomRow | null;
    },
    async createRoom(row) {
      const { error } = await db.from("rooms").insert(row);
      if (error?.code === "23505") return false;
      if (error) throw new Error(`db: ${error.message}`);
      return true;
    },
    async updateRoomIf(code, expected, patch) {
      const rows = must(
        await db.from("rooms").update(patch).eq("code", code).eq("status", expected).select("code"),
      ) as unknown[];
      return rows.length > 0;
    },
    async listPlayers(code) {
      return must(
        await db.from("players").select("*").eq("room_code", code).order("joined_at"),
      ) as PlayerRow[];
    },
    async addPlayer(row) {
      must(await db.from("players").insert(row));
    },
    async updatePlayer(id, patch) {
      must(await db.from("players").update(patch).eq("id", id));
    },
    async resetPlayers(code) {
      must(await db.from("players").delete().eq("room_code", code).eq("is_bot", true));
      must(await db.from("players").update({ card: null, vote: null, doubt: null, poke: null }).eq("room_code", code));
    },
  };
}

/** Raw client for small extras such as the leaderboard. Null when no database is configured. */
export function database(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

let cached: Store | null = null;

export function store(): Store {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached =
    url && key
      ? supabaseStore(createClient(url, key, { auth: { persistSession: false } }))
      : memoryStore;
  return cached;
}

export const usingDatabase = () =>
  Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
