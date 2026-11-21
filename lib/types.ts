// Shared types for Alibi — the single source of truth for every laptop.
// Do not change these shapes without telling the whole team.

export type Tone = "desi" | "noir";
export type Difficulty = "easy" | "medium" | "hard";
export type Role = "innocent" | "culprit";

/* ---------- The full case (SERVER ONLY, never sent to a browser) ---------- */

export interface Suspect {
  id: string; // "s1".."s4" in solo, player id in multiplayer
  name: string;
  role: string; // e.g. "Pandal priest"
  persona: string; // 1 line personality
  speaking_style: string; // how they talk
  public_alibi: string; // what they claim
  innocent_secret: string; // embarrassing but innocent thing they hide
  private_clues?: string[]; // multiplayer only: the 2 clues on this player's card
}

export interface Clue {
  id: string; // "c1".."c5"
  text: string;
  held_by: string; // suspect id who knows / reveals it
  points_to: string; // suspect id it implicates
  is_red_herring: boolean;
}

export interface CaseFile {
  title: string;
  setting: string;
  crime: string; // 1-2 lines, what happened
  crime_verb: string; // finishes "Find who ...", e.g. "stole the last rosogolla"
  intro: string; // narrator opening, 2-3 lines
  suspects: Suspect[]; // exactly 4 in solo, one per player in multiplayer
  culprit_id: string;
  motive: string;
  method: string;
  timeline: string[]; // 4-6 short beats
  clues: Clue[]; // 3 true + 2 red herrings
  alibi_hole: string; // the flaw in the culprit's alibi
  culprit_objective: string; // lie the culprit must push
  ending_caught: string; // narrator reveal if culprit is caught
  ending_escaped: string; // narrator reveal if an innocent is framed
  roast: string; // one-line roast of the culprit
  /** The case in three plain facts, for the briefing card. */
  facts?: CaseFacts;
  hot_seat?: { player_id: string; question: string }; // multiplayer mid-round twist
}

export interface CaseFacts {
  what: string; // what was taken or done, e.g. "A 2-carat sapphire necklace"
  when: string; // e.g. "Between 9:40 and 9:55 pm"
  where: string; // e.g. "Display case 4, Camac Street showroom"
}

/* ---------- SOLO: what the browser receives ---------- */

export interface PublicSuspect {
  id: string;
  name: string;
  role: string;
  public_alibi: string;
  room: number; // 0-3: which room of the map they stand in
}

/** A glowing spot on the solo map. Inspecting it is free and may add a clue. */
export interface MapSpot {
  id: string; // a clue id, or "scene"
  room: number;
  label: string;
  text: string;
}

export type AskMode = "ask" | "press" | "confront";

export interface SoloCaseView {
  caseId: string;
  title: string;
  setting: string;
  crime: string;
  intro: string;
  goal: string; // one line: what the player has to work out
  facts?: CaseFacts;
  suspects: PublicSuspect[];
  totalClues: number; // 5 (3 true + 2 red herrings; the player must judge which matter)
  durationSec: number; // 150
  actions: number; // moves allowed: ask costs 1, press costs 2, confront costs 1
  difficulty: Difficulty;
  spots: MapSpot[];
}

export interface ChatMessage {
  from: "you" | "suspect";
  text: string;
}

export interface InterrogateResponse {
  reply: string;
  unlockedClue: { id: string; text: string } | null;
  /** Confronting the culprit with real evidence breaks their story. */
  contradiction?: boolean;
  /** This suspect explained themselves and is no longer suspicious. */
  cleared?: boolean;
}

export interface SoloVerdict {
  correct: boolean;
  culpritId: string;
  culpritName: string;
  story: string; // ending text
  roast: string;
  motive: string;
  score: number; // 0-1000
  cluesFound: number;
  contradictions: number;
  leaderboard?: LeaderboardView;
}

export interface LeaderboardView {
  top: { name: string; score: number; caseTitle: string }[];
  solvedToday: number;
  playedToday: number;
}

/* ---------- MULTIPLAYER: what the browser receives ---------- */

export type RoomStatus =
  | "lobby"
  | "generating"
  | "briefing" // secret cards shown
  | "discuss" // talk out loud, timer running
  | "vote"
  | "reveal";

export interface RoomSettings {
  /** True when an AI suspect was the culprit last round, so a real player is next. */
  lastAi?: boolean;
  /** The innocent power each player held last time, so they get a different one. */
  lastPowers?: Record<string, string>;
  setting: string; // "Kolkata" | "This hackathon room" | custom 3 words
  tone: Tone;
  demo: boolean; // ?demo=true speedrun
  difficulty?: Difficulty;
  /** Set while the host has paused the round: milliseconds left in the frozen phase. */
  pausedMs?: number | null;
  /** Secret-power effects this round. Server-side only: never sent to a browser as-is. */
  fx?: {
    planted: { id: string; text: string; byId: string; targetId: string; at: string }[];
    blackoutUntil?: string | null;
    blackoutBy?: string | null;
    detectors: string[]; // players who used their lie detector
    destroyed?: number | null; // which piece of evidence vanished in the blackout
    double?: string[]; // players whose vote counts twice
    notes?: string[]; // other powers used, as ready-made lines for the end screen
  } | null;
}

export interface PlayerCard {
  role: Role;
  /** Set on the accomplice: the culprit's name. They win if the culprit escapes. */
  accompliceOf?: string;
  /** Set on the culprit when a friend is secretly helping them. */
  partner?: string;
  mission: string; // ONE line, e.g. "YOU ARE INNOCENT. Find who stole the rosogolla."
  clues: string[]; // exactly 2
  objective?: string; // culprit only
  /** Secret powers still unused this round. Culprit: plant + blackout. Innocent: detector. */
  powers?: { plant?: boolean; blackout?: boolean; detector?: boolean; clear?: boolean; extra?: boolean };
  job?: string; // who you are in this case, e.g. "Head of security"
  story?: string; // where you say you were: your answer when anyone asks
}

export interface RoomReveal {
  /** The secret powers that were used, told at the end. */
  tricks?: string[];
  culpritId: string;
  culpritName: string;
  accusedId: string | null; // who the group voted out
  accusedName: string | null;
  caught: boolean;
  story: string;
  /** Exactly what the narrator reads. Its audio is prepared during the discussion. */
  narration: string;
  roast: string;
  /** A real player who secretly helped the culprit, if there was one. */
  accompliceId?: string | null;
  /** Why the culprit did it, and how. Always shown at the end. */
  why?: string;
  how?: string;
  votes: { voterId: string; voterName: string; targetId: string; targetName: string }[];
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  phaseEndsAt: string | null; // ISO UTC. Countdown = phaseEndsAt - serverNow
  phaseTotalSec?: number; // full length of the current phase, for progress bars
  /** True while the host has paused. `pausedSecondsLeft` is the frozen clock. */
  paused?: boolean;
  pausedSecondsLeft?: number;
  serverNow: string; // ISO UTC, use to correct clock drift
  settings: RoomSettings;
  players: {
    id: string;
    name: string;
    isHost: boolean;
    hasVoted: boolean;
    isBot?: boolean;
    /** From briefing onwards: this player's part in the story, e.g. "Consultant". Public. */
    caseRole?: string;
    /** From briefing onwards: where they claim they were, e.g. "At the snack bar". Public. */
    alibi?: string;
    /** 0-100: share of the other players who currently doubt this player. */
    doubt?: number;
  }[];
  you: {
    id: string;
    name: string;
    isHost: boolean;
    card: PlayerCard | null;
    doubting?: string | null; // who you currently doubt
    /** A question another player just fired at you. Answer it out loud. */
    poke?: { fromName: string; question: string; endsAt: string } | null;
    votedFor?: string | null;
  } | null;
  case: { title: string; crime: string; intro: string; setting?: string; facts?: CaseFacts } | null; // null in lobby
  reveal: RoomReveal | null; // only in "reveal"
  /** Mid-discussion twist. Non-null for ~15 s: freeze the screen and show it to everyone. */
  hotSeat?: { playerId: string; playerName: string; question: string; endsAt: string } | null;
  /**
   * Evidence from the AI bots. Bots cannot talk, so what they saw is dropped
   * into the room one piece at a time during the discussion.
   */
  botClues?: { id?: string; from: string; text: string }[];
  /** How many pieces of bot evidence exist in total this round. */
  evidenceTotal?: number;
  /** Someone cut the lights: every phone goes dark until this time. */
  blackoutUntil?: string | null;
}
