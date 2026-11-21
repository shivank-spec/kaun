import { handle } from "@/lib/http";
import { leaderboard } from "@/lib/scores";

export async function GET() {
  return handle(() => leaderboard());
}
