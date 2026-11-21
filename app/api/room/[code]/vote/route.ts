import { body, handle } from "@/lib/http";
import { castVote } from "@/lib/rooms";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body(req);
    return castVote(code, String(b.playerId ?? ""), String(b.targetId ?? ""));
  });
}
