import { probe } from "@/lib/ai";
import { handle } from "@/lib/http";
import { database, usingDatabase } from "@/lib/store";

export const maxDuration = 40;

// Quick pre-demo check: open /api/health to see what is working.
export async function GET() {
  return handle(async () => {
    const db = database();
    const bank = db ? await db.from("case_pool").select("id", { count: "exact", head: true }) : null;
    return { ai: await probe(), database: usingDatabase(), casesInBank: bank?.count ?? 0 };
  });
}
