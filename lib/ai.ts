import OpenAI from "openai";

// Two providers behind one helper: Groq is the fast path (sub-2s),
// OpenAI is the safety net. Every call has a hard timeout so the game never hangs.

const groq = () =>
  new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    maxRetries: 0,
  });

export const openai = () =>
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });

const GROQ_MODEL = "llama-3.3-70b-versatile";
const OPENAI_MODEL = "gpt-4o-mini";

interface JsonCall {
  system: string;
  user: string;
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
): Promise<unknown> {
  const res = await client.chat.completions.create(
    {
      model,
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

/** Ask for JSON. Tries Groq first, then OpenAI. Throws only if both fail. */
export async function chatJSON(c: JsonCall): Promise<unknown> {
  if (process.env.GROQ_API_KEY) {
    try {
      return await callJSON(groq(), GROQ_MODEL, c, c.groqTimeoutMs ?? 8000);
    } catch (e) {
      console.warn("[ai] groq failed, falling back to openai:", (e as Error).message);
    }
  }
  return callJSON(openai(), OPENAI_MODEL, c, c.openaiTimeoutMs ?? 14000);
}
