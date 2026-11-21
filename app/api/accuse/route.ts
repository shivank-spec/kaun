import { body, handle } from "@/lib/http";
import { GameError } from "@/lib/rooms";
import { leaderboard, saveScore } from "@/lib/scores";
import { accuse, openCase } from "@/lib/solo";

// Scores are computed here on the server from the sealed case, so a player
// cannot post a made-up score to the leaderboard.
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    if (typeof b.caseId !== "string" || typeof b.suspectId !== "string") throw new GameError("Pick a suspect");
    const found = (Array.isArray(b.foundClueIds) ? b.foundClueIds : []) as string[];
    const confronted = (Array.isArray(b.confrontedClueIds) ? b.confrontedClueIds : []) as string[];
    const verdict = accuse(b.caseId, b.suspectId, found, Number(b.secondsUsed) || 0, confronted);
    const name = String(b.name ?? "").replace(/\s+/g, " ").trim().slice(0, 16) || "Anonymous";
    await saveScore({
      name,
      score: verdict.score,
      correct: verdict.correct,
      case_title: openCase(b.caseId).file.title,
    });
    return { ...verdict, leaderboard: await leaderboard() };
  });
}
