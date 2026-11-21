import { chatJSON } from "./ai";
import type {
  CaseFile,
  ChatMessage,
  InterrogateResponse,
  SoloCaseView,
  SoloVerdict,
  Tone,
} from "./types";
import { seal, unseal } from "./seal";

export const SOLO_SECONDS = 150;

interface Sealed {
  file: CaseFile;
  tone: Tone;
}

export function toSoloView(file: CaseFile, tone: Tone): SoloCaseView {
  return {
    caseId: seal({ file, tone } satisfies Sealed),
    title: file.title,
    setting: file.setting,
    crime: file.crime,
    intro: file.intro,
    suspects: file.suspects.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      public_alibi: s.public_alibi,
    })),
    totalClues: file.clues.length,
    durationSec: SOLO_SECONDS,
  };
}

export const openCase = (caseId: string) => unseal<Sealed>(caseId);

/** One suspect answers one question, in character. May give up a clue they hold. */
export async function interrogate(
  caseId: string,
  suspectId: string,
  message: string,
  history: ChatMessage[],
  foundClueIds: string[],
): Promise<InterrogateResponse> {
  const { file, tone } = openCase(caseId);
  const me = file.suspects.find((s) => s.id === suspectId);
  if (!me) throw new Error("unknown suspect");
  const isCulprit = me.id === file.culprit_id;
  const nameOf = (id: string) => file.suspects.find((s) => s.id === id)?.name ?? id;

  const held = file.clues.filter((k) => k.held_by === me.id && !foundClueIds.includes(k.id));
  const heldList = held.length
    ? held.map((k) => `- [${k.id}] ${k.text} (this is about ${nameOf(k.points_to)})`).join("\n")
    : "- (nothing left to reveal)";
  const aboutMe = file.clues
    .filter((k) => k.points_to === me.id)
    .map((k) => `- ${k.text}`)
    .join("\n");

  const system = `You are playing ONE suspect in a comedy detective game. Stay in character at all times.
CASE: ${file.title}. ${file.crime} Setting: ${file.setting}.
OTHER PEOPLE PRESENT: ${file.suspects.filter((s) => s.id !== me.id).map((s) => `${s.name} (${s.role})`).join(", ")}.

YOU ARE: ${me.name}, ${me.role}. Personality: ${me.persona}. You speak like this: ${me.speaking_style}.
Your stated alibi: ${me.public_alibi}
${
  isCulprit
    ? `SECRET: YOU DID IT. Motive: ${file.motive} How: ${file.method}
You must LIE and never confess. Push this false claim whenever you can: "${file.culprit_objective}"
Your cover story if pressed: ${me.innocent_secret}
The weak point in your alibi: ${file.alibi_hole}. If the detective asks about exactly that, get flustered, contradict yourself slightly and change the subject, but still deny it.`
    : `You are INNOCENT of the crime. But you are hiding something embarrassing: ${me.innocent_secret}
Dodge questions about it at first; if pressed twice, admit it sheepishly (it proves you are innocent).`
}
Things others may say about you:
${aboutMe || "- (nothing)"}

THINGS YOU WITNESSED and can reveal:
${heldList}
Reveal ONE of these, in your own words, only when the detective's question is reasonably related to it (asking what you saw, about that person, about that time or place). Do not dump everything at once. If you reveal one, put its id in "reveal_clue_id".

RULES: Reply in 1-3 short sentences. ${tone === "noir" ? "English." : "Natural Hinglish (Roman script)."} Be funny and specific. Never break character, never mention being an AI, never narrate. Never state who the culprit is as a fact.
Return ONLY JSON: {"reply": string, "reveal_clue_id": string | null}`;

  const convo = history
    .slice(-8)
    .map((m) => `${m.from === "you" ? "DETECTIVE" : me.name.toUpperCase()}: ${m.text}`)
    .join("\n");

  let raw: { reply?: unknown; reveal_clue_id?: unknown };
  try {
    raw = (await chatJSON({
      system,
      user: `${convo ? convo + "\n" : ""}DETECTIVE: ${message.slice(0, 300)}`,
      kind: "chat",
      temperature: 0.9,
      maxTokens: 500,
      groqTimeoutMs: 6000,
    })) as { reply?: unknown; reveal_clue_id?: unknown };
  } catch {
    // The AI is rate limited or down. Answer from the case facts instead, so the
    // game stays playable and every clue can still be found.
    const turns = history.filter((m) => m.from === "you").length;
    if (held.length) {
      const k = held[0];
      return {
        reply: `Theek hai, theek hai. I will tell you what I know: ${k.text}`,
        unlockedClue: { id: k.id, text: k.text },
      };
    }
    const lines = isCulprit
      ? [
          `I already told you. ${me.public_alibi}`,
          `Listen carefully: ${file.culprit_objective.replace(/^convince everyone (that )?/i, "")}. That is what really happened.`,
          `Why are you only asking me? ${file.suspects.find((x) => x.id !== me.id)!.name} was acting far stranger.`,
        ]
      : [
          `${me.public_alibi} That is all, I swear.`,
          `Fine. The truth is embarrassing: ${me.innocent_secret} But I had nothing to do with the crime.`,
          `I have told you everything. Go and ask the others.`,
        ];
    return { reply: lines[turns % lines.length], unlockedClue: null };
  }

  const reply = typeof raw.reply === "string" && raw.reply.trim() ? raw.reply.trim() : "...";
  const clue = held.find((k) => k.id === raw.reveal_clue_id) ?? null;
  return { reply, unlockedClue: clue ? { id: clue.id, text: clue.text } : null };
}

export function accuse(
  caseId: string,
  suspectId: string,
  foundClueIds: string[],
  secondsUsed: number,
): SoloVerdict {
  const { file } = openCase(caseId);
  const culprit = file.suspects.find((s) => s.id === file.culprit_id)!;
  const correct = suspectId === file.culprit_id;
  const trueFound = file.clues.filter(
    (k) => !k.is_red_herring && foundClueIds.includes(k.id),
  ).length;
  const left = Math.max(0, SOLO_SECONDS - Math.max(0, secondsUsed));
  const score = correct ? 500 + trueFound * 80 + Math.round((left / SOLO_SECONDS) * 260) : trueFound * 40;
  return {
    correct,
    culpritId: culprit.id,
    culpritName: culprit.name,
    story: correct ? file.ending_caught : file.ending_escaped,
    roast: file.roast,
    motive: file.motive,
    score,
    cluesFound: trueFound,
  };
}
