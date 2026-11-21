import { generateCase } from "@/lib/generate-case";
import { body, handle } from "@/lib/http";
import { toSoloView } from "@/lib/solo";
import type { Tone } from "@/lib/types";

export const maxDuration = 40;

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const tone: Tone = b.tone === "noir" ? "noir" : "desi";
    const { file } = await generateCase({
      setting: typeof b.setting === "string" ? b.setting : undefined,
      tone,
    });
    return toSoloView(file, tone);
  });
}
