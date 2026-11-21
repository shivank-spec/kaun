import { body, handle } from "@/lib/http";
import { GameError } from "@/lib/rooms";
import { accuse } from "@/lib/solo";

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    if (typeof b.caseId !== "string" || typeof b.suspectId !== "string") throw new GameError("Pick a suspect");
    const found = (Array.isArray(b.foundClueIds) ? b.foundClueIds : []) as string[];
    return accuse(b.caseId, b.suspectId, found, Number(b.secondsUsed) || 0);
  });
}
