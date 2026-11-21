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
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
// Off until a model is proven fast on the live site (see /api/health).
const GEMINI_ON = false;

export const openai = () =>
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });

const BIG = "openai/gpt-oss-120b"; // best writer: cases
const SMALL = "openai/gpt-oss-20b"; // fast: suspect replies
const ALT = "qwen/qwen3.8-27b"; // separate quota
const OPENAI_MODEL = "gpt-4o-mini";

/** "case" prefers the strongest model; "chat" spreads load over the lighter ones. */
const ORDER = {
  case: [BIG, ALT, SMALL],
  chat: [SMALL, ALT, BIG],
} as const;

interface JsonCall {
  system: string;
  user: string;
  kind?: keyof typeof ORDER;
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

// Rotate the starting model for chat so load is shared evenly across quotas.
let turn = 0;

/** Ask for JSON. Tries each Groq model in turn, then OpenAI. Throws only if all fail. */
export async function chatJSON(c: JsonCall): Promise<unknown> {
  const kind = c.kind ?? "case";
  let models: string[] = [...ORDER[kind]];
  if (kind === "chat") {
    const shift = turn++ % 2; // alternate between the two light models
    models = [models[shift], models[1 - shift], models[2]];
  }
  if (process.env.GEMINI_API_KEY && GEMINI_ON) {
    try {
      return await callJSON(gemini(), GEMINI_MODEL, c, 5000, false);
    } catch (e) {
      console.warn("[ai] gemini failed:", (e as Error).message.slice(0, 140));
    }
  }
  if (process.env.GROQ_API_KEY) {
    for (const model of models) {
      try {
        return await callJSON(groq(), model, c, c.groqTimeoutMs ?? 8000, true);
      } catch (e) {
        console.warn(`[ai] ${model} failed:`, (e as Error).message.slice(0, 140));
      }
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
  for (const m of ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.0-flash"]) {
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
