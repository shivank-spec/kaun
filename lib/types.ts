// Shared types for Kaun? — the single source of truth for every laptop.
// Do not change these shapes without telling the whole team.

export type Tone = "desi" | "noir";
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
}

/* ---------- SOLO: what the browser receives ---------- */

export interface PublicSuspect {
  id: string;
  name: string;
  role: string;
  public_alibi: string;
}

export interface SoloCaseView {
  caseId: string;
  title: string;
  setting: string;
  crime: string;
  intro: string;
  suspects: PublicSuspect[];
  totalClues: number; // 5 (3 true + 2 red herrings; the player must judge which matter)
  durationSec: number; // 150
}

export interface ChatMessage {
  from: "you" | "suspect";
  text: string;
}

export interface InterrogateResponse {
  reply: string;
  unlockedClue: { id: string; text: string } | null;
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
  setting: string; // "Kolkata" | "This hackathon room" | custom 3 words
  tone: Tone;
  demo: boolean; // ?demo=true speedrun
}

export interface PlayerCard {
  role: Role;
  mission: string; // ONE line, e.g. "YOU ARE INNOCENT. Find who stole the rosogolla."
  clues: string[]; // exactly 2
  objective?: string; // culprit only
}

export interface RoomReveal {
  culpritId: string;
  culpritName: string;
  accusedId: string | null; // who the group voted out
  accusedName: string | null;
  caught: boolean;
  story: string;
  roast: string;
  votes: { voterId: string; voterName: string; targetId: string; targetName: string }[];
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  phaseEndsAt: string | null; // ISO UTC. Countdown = phaseEndsAt - serverNow
  serverNow: string; // ISO UTC, use to correct clock drift
  settings: RoomSettings;
  players: { id: string; name: string; isHost: boolean; hasVoted: boolean }[];
  you: { id: string; name: string; isHost: boolean; card: PlayerCard | null } | null;
  case: { title: string; crime: string; intro: string } | null; // null in lobby
  reveal: RoomReveal | null; // only in "reveal"
}
