import { body, handle } from "@/lib/http";
import { GameError } from "@/lib/rooms";
import { interrogate } from "@/lib/solo";
import type { AskMode, ChatMessage } from "@/lib/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    if (typeof b.caseId !== "string" || typeof b.suspectId !== "string") {
      throw new GameError("Pick a suspect");
    }
    const mode: AskMode = b.mode === "press" || b.mode === "confront" ? b.mode : "ask";
    return interrogate({
      caseId: b.caseId,
      suspectId: b.suspectId,
      message: typeof b.message === "string" && b.message.trim() ? b.message : "What did you see?",
      history: (Array.isArray(b.history) ? b.history : []) as ChatMessage[],
      foundClueIds: (Array.isArray(b.foundClueIds) ? b.foundClueIds : []) as string[],
      mode,
      clueId: typeof b.clueId === "string" ? b.clueId : undefined,
    });
  });
}
