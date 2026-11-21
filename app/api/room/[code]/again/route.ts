import { body, handle } from "@/lib/http";
import { playAgain } from "@/lib/rooms";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    return playAgain(code, String((await body(req)).playerId ?? ""));
  });
}
