import { body, handle } from "@/lib/http";
import { GameError } from "@/lib/rooms";
import { interrogate } from "@/lib/solo";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    if (typeof b.caseId !== "string" || typeof b.suspectId !== "string" || typeof b.message !== "string" || !b.message.trim()) {
      throw new GameError("Ask the suspect a question");
    }
    const history = (Array.isArray(b.history) ? b.history : []) as ChatMessage[];
    const found = (Array.isArray(b.foundClueIds) ? b.foundClueIds : []) as string[];
    try {
      return await interrogate(b.caseId, b.suspectId, b.message, history, found);
    } catch (e) {
      console.warn("[interrogate]", (e as Error).message);
      // Stay in the game even if the AI hiccups.
      return { reply: "...sorry, what? Ask me that again.", unlockedClue: null };
    }
  });
}
