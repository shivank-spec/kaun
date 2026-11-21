// Sample RoomView objects for every status. Used by ?mock=<status>.
// Extra knobs: &role=culprit  &host=0  &caught=0  &t=<seconds left>  &players=<3-8>
import type { PlayerCard, RoomStatus, RoomView } from "@/lib/types";

export const MOCK_STATUSES: RoomStatus[] = ["lobby", "generating", "briefing", "discuss", "vote", "reveal"];

export function isMockStatus(v: string | null): v is RoomStatus {
  return !!v && (MOCK_STATUSES as string[]).includes(v);
}

export interface MockOpts {
  role?: "innocent" | "culprit";
  host?: boolean;
  caught?: boolean;
  secondsLeft?: number;
  players?: number;
  youVoted?: boolean;
}

const NAMES = ["Shivank", "Ananya", "Rohit", "Meghna", "Kabir", "Tanvi", "Arjun", "Zoya"];

const INNOCENT: PlayerCard = {
  role: "innocent",
  mission: "YOU ARE INNOCENT. Find who stole the rosogolla.",
  clues: [
    "You saw syrup drops leading towards the dhaak players at 9:40.",
    "Someone borrowed your phone torch just before the lights went out.",
  ],
};

const CULPRIT: PlayerCard = {
  role: "culprit",
  mission: "YOU ARE THE CULPRIT. Don't get caught.",
  clues: [
    "Your kurta sleeve is still sticky. Keep that arm down.",
    "Rohit was also near the bhog table. Use it.",
  ],
  objective: "Convince everyone the syrup trail was Rohit's doing.",
};

const DURATIONS: Partial<Record<RoomStatus, number>> = { briefing: 20, discuss: 100, vote: 30 };

export function buildMock(status: RoomStatus, opts: MockOpts, nowMs: number): RoomView {
  const count = Math.min(8, Math.max(3, opts.players ?? 5));
  const host = opts.host ?? true;
  const names = NAMES.slice(0, count);
  const youIdx = host ? 0 : 1;
  const culpritIdx = opts.role === "culprit" ? youIdx : 2;
  const caught = opts.caught ?? true;
  const accusedIdx = caught ? culpritIdx : count - 1;
  const dur = opts.secondsLeft ?? DURATIONS[status];

  const players = names.map((name, i) => ({
    id: `p${i + 1}`,
    name,
    isHost: i === 0,
    hasVoted: status === "reveal" || (status === "vote" && (i === youIdx ? !!opts.youVoted : i % 2 === 0)),
  }));
  const inGame = status !== "lobby" && status !== "generating";

  return {
    code: "KAUN",
    status,
    phaseEndsAt: dur != null ? new Date(nowMs + dur * 1000).toISOString() : null,
    serverNow: new Date(nowMs).toISOString(),
    settings: { setting: "Kolkata", tone: "desi", demo: false },
    players,
    you: {
      id: players[youIdx].id,
      name: players[youIdx].name,
      isHost: host,
      card: inGame ? (opts.role === "culprit" ? CULPRIT : INNOCENT) : null,
    },
    case:
      status === "lobby"
        ? null
        : {
            title: "The Rosogolla Heist",
            crime: "The pandal's prize rosogolla handi vanished minutes before the bhog.",
            intro: "Ashtami night. The dhaak is loud, the queue is long, and the handi is empty.",
          },
    reveal:
      status === "reveal"
        ? {
            culpritId: players[culpritIdx].id,
            culpritName: players[culpritIdx].name,
            accusedId: players[accusedIdx].id,
            accusedName: players[accusedIdx].name,
            caught,
            story: caught
              ? `It was ${players[culpritIdx].name} all along. While the dhaak drowned out every sound, they slipped behind the bhog table, lifted the handi and left a syrup trail to frame the drummers. The sticky sleeve gave it away.`
              : `You blamed ${players[accusedIdx].name}, and ${players[culpritIdx].name} walked out of the pandal licking their fingers. The handi was never seen again.`,
            roast: `${players[culpritIdx].name} lies the way they eat rosogolla: messily, and with both hands.`,
            votes: players.map((p, i) => {
              const t = i === culpritIdx ? accusedIdx === culpritIdx ? (culpritIdx + 1) % count : accusedIdx : i % 3 === 0 && !caught ? culpritIdx : accusedIdx;
              const target = t === i ? (i + 1) % count : t;
              return { voterId: p.id, voterName: p.name, targetId: players[target].id, targetName: players[target].name };
            }),
          }
        : null,
  };
}
