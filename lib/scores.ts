import { database } from "./store";

export interface ScoreRow {
  name: string;
  score: number;
  correct: boolean;
  case_title: string;
  created_at: string;
}

export interface Leaderboard {
  top: { name: string; score: number; caseTitle: string }[];
  solvedToday: number;
  playedToday: number;
}

const since = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString();

export async function saveScore(row: Omit<ScoreRow, "created_at">) {
  const db = database();
  if (!db) return;
  const { error } = await db.from("scores").insert(row);
  if (error) console.warn("[scores]", error.message);
}

export async function leaderboard(): Promise<Leaderboard> {
  const db = database();
  if (!db) return { top: [], solvedToday: 0, playedToday: 0 };
  const [top, played, solved] = await Promise.all([
    db
      .from("scores")
      .select("name,score,case_title")
      .gte("created_at", since())
      .eq("correct", true)
      .order("score", { ascending: false })
      .limit(10),
    db.from("scores").select("id", { count: "exact", head: true }).gte("created_at", since()),
    db
      .from("scores")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since())
      .eq("correct", true),
  ]);
  return {
    top: (top.data ?? []).map((r) => ({ name: r.name, score: r.score, caseTitle: r.case_title })),
    playedToday: played.count ?? 0,
    solvedToday: solved.count ?? 0,
  };
}
