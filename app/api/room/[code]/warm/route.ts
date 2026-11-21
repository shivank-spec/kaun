import { body, handle } from "@/lib/http";
import { warmNarration } from "@/lib/rooms";

export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    return warmNarration(code, String((await body(req)).playerId ?? ""));
  });
}
