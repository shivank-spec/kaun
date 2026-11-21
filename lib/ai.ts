import OpenAI from "openai";

// One helper for every AI call. Each Groq model has its own per-minute quota,
// so we rotate across three of them and move on instantly when one is rate
// limited or slow. OpenAI is a last resort. Every call has a hard timeout so
// the game never hangs.

const groq = () =>
  new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    maxRetries: 0,
  });

// Optional: Google Gemini through its OpenAI-compatible endpoint. Its free tier
// has far more headroom, so when a key is present it goes first.
const gemini = () =>
  new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    maxRetries: 0,
  });
const GEMINI_LITE = "gemini-2.5-flash-lite";
const GEMINI_FLASH = "gemini-2.5-flash";

export const openai = () =>
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });

const BIG = "openai/gpt-oss-120b"; // best writer: cases
const SMALL = "openai/gpt-oss-20b"; // fast: suspect replies
const ALT = "qwen/qwen3.8-27b"; // separate quota
const OPENAI_MODEL = "gpt-4o-mini";

interface JsonCall {
  system: string;
  user: string;
  kind?: "case" | "chat";
  temperature?: number;
  maxTokens?: number;
  groqTimeoutMs?: number;
  openaiTimeoutMs?: number;
}

async function callJSON(
  client: OpenAI,
  model: string,
  c: JsonCall,
  timeout: number,
  groqModel: boolean,
): Promise<unknown> {
  const res = await client.chat.completions.create(
    {
      model,
      // These models think before answering; keep that short so we stay fast.
      ...(groqModel ? ({ reasoning_effort: "low" } as object) : {}),
      // Gemini 2.5 Flash thinks by default, which is too slow for a party game.
      ...(model === GEMINI_FLASH ? ({ reasoning_effort: "none" } as object) : {}),
      temperature: c.temperature ?? 0.9,
      max_tokens: c.maxTokens ?? 1800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: c.system },
        { role: "user", content: c.user },
      ],
    },
    { timeout },
  );
  const text = res.choices[0]?.message?.content ?? "";
  return JSON.parse(text);
}

type Provider = { name: string; run: (c: JsonCall) => Promise<unknown> };

const viaGroq = (model: string): Provider => ({
  name: model,
  run: (c) => callJSON(groq(), model, c, c.groqTimeoutMs ?? 8000, true),
});
const viaGemini = (model: string, timeout: number): Provider => ({
  name: model,
  run: (c) => callJSON(gemini(), model, c, timeout, false),
});

/**
 * Every free quota we have, as separate buckets. Groq limits tokens per minute
 * per model; Gemini limits requests per minute per model. Spreading calls
 * across all of them multiplies how many people can play at once.
 */
function providers(kind: "case" | "chat"): Provider[] {
  const g = process.env.GROQ_API_KEY ? true : false;
  const m = process.env.GEMINI_API_KEY ? true : false;
  const list: (Provider | false)[] =
    kind === "case"
      ? [
          g && viaGroq(BIG),
          m && viaGemini(GEMINI_FLASH, 7000),
          g && viaGroq(ALT),
          m && viaGemini(GEMINI_LITE, 6000),
          g && viaGroq(SMALL),
        ]
      : [
          g && viaGroq(SMALL),
          m && viaGemini(GEMINI_LITE, 5000),
          g && viaGroq(ALT),
          m && viaGemini(GEMINI_FLASH, 5000),
          g && viaGroq(BIG),
        ];
  return list.filter(Boolean) as Provider[];
}

// Chat calls start from a different bucket each time so load is shared evenly.
let turn = 0;

/** Ask for JSON. Walks the buckets until one answers. Throws only if all fail. */
export async function chatJSON(c: JsonCall): Promise<unknown> {
  const kind = c.kind ?? "case";
  let list = providers(kind);
  if (kind === "chat" && list.length > 1) {
    const rotating = list.slice(0, -1); // keep the big model as the last resort
    const shift = turn++ % rotating.length;
    list = [...rotating.slice(shift), ...rotating.slice(0, shift), list[list.length - 1]];
  }
  for (const p of list) {
    try {
      return await p.run(c);
    } catch (e) {
      console.warn(`[ai] ${p.name} failed:`, (e as Error).message.slice(0, 140));
    }
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("all AI providers failed");
  return callJSON(openai(), OPENAI_MODEL, c, c.openaiTimeoutMs ?? 14000, false);
}

/** Health check: which providers answer right now. Never returns keys. */
export async function probe() {
  const c: JsonCall = { system: "Reply with JSON only.", user: 'Return {"ok":true}', maxTokens: 200, temperature: 0 };
  const test = async (fn: () => Promise<unknown>) => {
    const t = Date.now();
    try {
      await fn();
      return `ok ${Date.now() - t}ms`;
    } catch (e) {
      return `FAIL ${(e as Error).message.slice(0, 160)}`;
    }
  };
  const out: Record<string, string> = {};
  for (const m of [GEMINI_LITE, GEMINI_FLASH]) {
    out[m] = process.env.GEMINI_API_KEY
      ? await test(async () => {
          // Raw fetch so we can read Google's own error text.
          const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.GEMINI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: m,
              messages: [{ role: "user", content: c.user }],
              response_format: { type: "json_object" },
              max_tokens: 200,
            }),
            signal: AbortSignal.timeout(6000),
          });
          if (!r.ok) throw new Error(`${r.status} ${(await r.text()).replace(/\s+/g, " ").slice(0, 120)}`);
        })
      : "no key";
  }
  for (const m of [BIG, SMALL, ALT]) {
    out[m] = process.env.GROQ_API_KEY ? await test(() => callJSON(groq(), m, c, 8000, true)) : "no key";
  }
  return out;
}
