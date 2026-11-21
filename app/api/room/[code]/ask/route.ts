import { body, handle } from "@/lib/http";
import { askSuspect } from "@/lib/rooms";

export const maxDuration = 30;

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body(req);
    return askSuspect(code, String(b.playerId ?? ""), String(b.targetId ?? ""), b.question);
  });
}
