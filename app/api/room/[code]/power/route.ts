import { body, handle } from "@/lib/http";
import { playPower } from "@/lib/rooms";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await ctx.params;
    const b = await body(req);
    return playPower(code, String(b.playerId ?? ""), String(b.power ?? ""), {
      targetId: b.targetId ? String(b.targetId) : undefined,
      evidenceId: b.evidenceId ? String(b.evidenceId) : undefined,
    });
  });
}
