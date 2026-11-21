import { generateCase } from "@/lib/generate-case";
import { body, handle } from "@/lib/http";
import { bankCase, bucketOf, drawCase } from "@/lib/pool";
import { toSoloView } from "@/lib/solo";
import type { Tone } from "@/lib/types";

export const maxDuration = 40;

const BANK_READY = 8; // below this, always write live so the bank grows
const SERVE_FROM_BANK = 0.8;

export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const tone: Tone = b.tone === "noir" ? "noir" : "desi";
    const setting = typeof b.setting === "string" ? b.setting : undefined;
    const seen = (Array.isArray(b.seen) ? b.seen : []).slice(-60).map(String);
    const bucket = bucketOf(setting);

    // 1. Usually serve an unseen case from the bank (zero AI tokens).
    if (bucket) {
      const banked = await drawCase(bucket, tone, seen);
      if (banked && banked.size >= BANK_READY && Math.random() < SERVE_FROM_BANK) {
        return toSoloView(banked.file, tone);
      }
      // 2. Otherwise write a new one live and bank it.
      const made = await generateCase({ setting, tone });
      if (made.source === "ai") {
        await bankCase(bucket, tone, made.file);
        return toSoloView(made.file, tone);
      }
      // 3. AI unavailable: any unseen banked case beats repeating a hand-written one.
      return toSoloView(banked?.file ?? made.file, tone);
    }

    const { file } = await generateCase({ setting, tone });
    return toSoloView(file, tone);
  });
}
