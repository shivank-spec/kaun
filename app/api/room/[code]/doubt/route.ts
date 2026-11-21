import { body, handle } from "@/lib/http";
import { setDoubt } from "@/lib/rooms";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body(req);
    return setDoubt(code, String(b.playerId ?? ""), b.targetId ? String(b.targetId) : null);
  });
}
