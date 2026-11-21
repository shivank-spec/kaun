import { body, handle } from "@/lib/http";
import { skipPhase } from "@/lib/rooms";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    return skipPhase(code, String((await body(req)).playerId ?? ""));
  });
}
