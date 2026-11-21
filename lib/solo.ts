import { chatJSON } from "./ai";
import type {
  AskMode,
  Difficulty,
  CaseFile,
  ChatMessage,
  InterrogateResponse,
  MapSpot,
  SoloCaseView,
  SoloVerdict,
  Tone,
} from "./types";
import { seal, unseal } from "./seal";

/** Easy gives you room to explore; Hard gives you four moves and two minutes. */
export const LEVELS: Record<Difficulty, { actions: number; seconds: number; bonus: number }> = {
  easy: { actions: 8, seconds: 170, bonus: 0.8 },
  medium: { actions: 6, seconds: 150, bonus: 1 },
  hard: { actions: 4, seconds: 120, bonus: 1.4 },
};
export const asDifficulty = (v: unknown): Difficulty =>
  v === "easy" || v === "hard" ? v : "medium";
export const ACTION_COST: Record<AskMode, number> = { ask: 1, press: 2, confront: 1 };

interface Sealed {
  file: CaseFile;
  tone: Tone;
  difficulty?: Difficulty;
}

/**
 * The glowing spots on the map. Witnesses hold the three true clues; the two
 * red herrings are physical evidence lying around the scene, so a player who
 * only searches the room and never talks to anyone ends up accusing the wrong
 * person.
 */
function spotsOf(file: CaseFile): MapSpot[] {
  const herrings = file.clues.filter((k) => k.is_red_herring).slice(0, 2);
  return [
    { id: "scene", room: 3, label: "The scene", text: file.timeline[0] ?? file.crime },
    ...herrings.map((k, i) => ({
      id: k.id,
      room: [1, 0][i] ?? 2,
      label: "Evidence",
      text: k.text,
    })),
  ];
}

export function toSoloView(file: CaseFile, tone: Tone, difficulty: Difficulty = "medium"): SoloCaseView {
  const level = LEVELS[difficulty];
  return {
    caseId: seal({ file, tone, difficulty } satisfies Sealed),
    title: file.title,
    setting: file.setting,
    crime: file.crime,
    intro: file.intro,
    facts: file.facts,
    suspects: file.suspects.map((s, i) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      public_alibi: s.public_alibi,
      room: i % 4,
    })),
    totalClues: file.clues.length,
    durationSec: level.seconds,
    actions: level.actions,
    difficulty,
    spots: spotsOf(file),
  };
}

export const openCase = (caseId: string) => unseal<Sealed>(caseId);

export interface AskInput {
  caseId: string;
  suspectId: string;
  message: string;
  history: ChatMessage[];
  foundClueIds: string[];
  mode: AskMode;
  clueId?: string; // confront only: the evidence being shown
}

/** One suspect answers one move (ask, press or confront), in character. */
export async function interrogate(input: AskInput): Promise<InterrogateResponse> {
  const { caseId, suspectId, history, foundClueIds, mode } = input;
  const { file, tone } = openCase(caseId);
  const me = file.suspects.find((s) => s.id === suspectId);
  if (!me) throw new Error("unknown suspect");
  const isCulprit = me.id === file.culprit_id;
  const nameOf = (id: string) => file.suspects.find((s) => s.id === id)?.name ?? id;
  const first = me.name.split(" ")[0];

  const held = file.clues.filter(
    (k) => k.held_by === me.id && !k.is_red_herring && !foundClueIds.includes(k.id),
  );
  const evidence = mode === "confront" ? file.clues.find((k) => k.id === input.clueId) : undefined;

  // What this move does to the game is decided here, by the rules, not by the model.
  let contradiction = false;
  let cleared = false;
  let forcedClue = held[0] && mode === "press" ? held[0] : null;
  let moveBrief: string;
  let message = input.message.slice(0, 300);

  if (mode === "confront" && evidence) {
    message = `Explain this evidence: "${evidence.text}"`;
    if (evidence.points_to === me.id && isCulprit) {
      contradiction = true;
      moveBrief = `The detective CONFRONTS you with real evidence against you: "${evidence.text}". This is damning. Stammer, give a weak excuse that clashes with your alibi, and try to change the subject. Do not confess.`;
    } else if (evidence.points_to === me.id) {
      cleared = true;
      moveBrief = `The detective CONFRONTS you with evidence that makes you look guilty: "${evidence.text}". Crack and admit your private secret, which explains it completely and proves you are innocent.`;
    } else {
      moveBrief = `The detective shows you evidence that is about ${nameOf(evidence.points_to)}, not you: "${evidence.text}". ${
        isCulprit
          ? "Jump on it eagerly and blame them."
          : "Say honestly that it is not about you, and what you make of it."
      }`;
    }
  } else if (mode === "press") {
    if (isCulprit) {
      moveBrief = `The detective is PRESSING you hard. Get visibly flustered and let one small detail slip that does not fit your alibi (${file.alibi_hole}). Still deny everything.`;
    } else {
      cleared = true;
      moveBrief = `The detective is PRESSING you hard. Crack: admit your private secret, and tell them exactly what you witnessed${
        forcedClue ? `: "${forcedClue.text}"` : ""
      }.`;
    }
  } else {
    moveBrief = held.length
      ? `Answer the question. If it is reasonably about what you saw, the other people, or the time of the crime, share ONE of the things you witnessed in your own words and put its id in "reveal_clue_id".`
      : `Answer the question. You have nothing new to reveal.`;
  }

  const heldList = held.length
    ? held.map((k) => `- [${k.id}] ${k.text} (this is about ${nameOf(k.points_to)})`).join("\n")
    : "- (nothing left to reveal)";

  const system = `You are playing ONE suspect being questioned by a detective in a realistic crime drama. Stay in character at all times.
CASE: ${file.title}. ${file.crime} Setting: ${file.setting}.
OTHER PEOPLE PRESENT: ${file.suspects.filter((s) => s.id !== me.id).map((s) => `${s.name} (${s.role})`).join(", ")}.

YOU ARE: ${me.name}, ${me.role}. Personality: ${me.persona}. You speak like this: ${me.speaking_style}.
Your stated alibi: ${me.public_alibi}
${
  isCulprit
    ? `SECRET: YOU DID IT. Motive: ${file.motive} How: ${file.method}
You LIE and never confess. Push this false claim whenever you can: "${file.culprit_objective}"
Your cover story: ${me.innocent_secret}`
    : `You are INNOCENT. You are hiding something private but not criminal: ${me.innocent_secret}`
}

THINGS YOU WITNESSED:
${heldList}

THIS MOVE: ${moveBrief}

RULES: Refer to people by name only, never by a code like s3 or c2. No dates or timestamps unless they are part of the story. Reply in 1-3 short sentences. Speak plain English only: no Hindi or Hinglish words. Sound like a real person under pressure: guarded, specific, with believable detail. No jokes. Never break character, never mention being an AI, never narrate. Never state who the culprit is as a plain fact.
Return ONLY JSON: {"reply": string, "reveal_clue_id": string | null}`;

  const convo = history
    .slice(-6)
    .map((m) => `${m.from === "you" ? "DETECTIVE" : first.toUpperCase()}: ${m.text}`)
    .join("\n");

  let reply = "";
  let modelClue: string | null = null;
  try {
    const raw = (await chatJSON({
      system,
      user: `${convo ? convo + "\n" : ""}DETECTIVE: ${message}`,
      kind: "chat",
      temperature: 0.9,
      maxTokens: 500,
      groqTimeoutMs: 6000,
    })) as { reply?: unknown; reveal_clue_id?: unknown };
    const names = new Map(file.suspects.map((x) => [x.id.toLowerCase(), x.name.split(" ")[0]]));
    reply = (typeof raw.reply === "string" ? raw.reply : "")
      .replace(/\b([sp][1-8])\b/gi, (m) => names.get(m.toLowerCase()) ?? m)
      .replace(/\s*\b20\d{2}-\d{2}-\d{2}\b\.?/g, "")
      .trim();
    modelClue = typeof raw.reveal_clue_id === "string" ? raw.reveal_clue_id : null;
  } catch {
    // The AI is rate limited or down. Answer from the case facts so the game
    // stays playable and every clue can still be found.
    if (mode === "ask" && held.length) forcedClue = held[0];
  }

  if (!reply) {
    const turns = history.filter((m) => m.from === "you").length;
    if (contradiction) {
      reply = `That... that proves nothing! I was... look, ${me.public_alibi.replace(/\.$/, "")}. Mostly. Can we talk about someone else?`;
    } else if (cleared && mode === "confront") {
      reply = `All right. Off the record: ${me.innocent_secret} That is why I was not where I said. I had nothing to do with this.`;
    } else if (forcedClue) {
      reply = `Fine, fine. I will tell you what I know: ${forcedClue.text}`;
    } else if (isCulprit) {
      const lines = [
        `I already told you. ${me.public_alibi}`,
        `Listen carefully: ${file.culprit_objective.replace(/^convince everyone (that )?/i, "").replace(/\.$/, "")}. That is what really happened.`,
        `Why are you only asking me? ${file.suspects.find((x) => x.id !== me.id)!.name} was acting far stranger.`,
      ];
      reply = lines[turns % lines.length];
    } else {
      const lines = [
        `${me.public_alibi} That is all, I swear.`,
        `All right. Off the record: ${me.innocent_secret} That is the whole truth.`,
        `I have told you everything. Go and ask the others.`,
      ];
      reply = lines[turns % lines.length];
    }
  }

  const clue = forcedClue ?? held.find((k) => k.id === modelClue) ?? null;
  return {
    reply,
    unlockedClue: clue ? { id: clue.id, text: clue.text } : null,
    ...(contradiction ? { contradiction: true } : {}),
    ...(cleared ? { cleared: true } : {}),
  };
}

export function accuse(
  caseId: string,
  suspectId: string,
  foundClueIds: string[],
  secondsUsed: number,
  confrontedClueIds: string[] = [],
): SoloVerdict {
  const { file, difficulty } = openCase(caseId);
  const level = LEVELS[difficulty ?? "medium"];
  const culprit = file.suspects.find((s) => s.id === file.culprit_id)!;
  const correct = suspectId === file.culprit_id;
  const isTrue = (id: string) => file.clues.some((k) => k.id === id && !k.is_red_herring);
  const trueFound = [...new Set(foundClueIds)].filter(isTrue).length;
  const contradictions = Math.min(2, [...new Set(confrontedClueIds)].filter(isTrue).length);
  const left = Math.max(0, level.seconds - Math.max(0, secondsUsed));
  const score = correct
    ? Math.round((400 + trueFound * 60 + contradictions * 90 + (left / level.seconds) * 200) * level.bonus)
    : trueFound * 30;
  return {
    correct,
    culpritId: culprit.id,
    culpritName: culprit.name,
    story: correct ? file.ending_caught : file.ending_escaped,
    roast: file.roast,
    motive: file.motive,
    score,
    cluesFound: trueFound,
    contradictions,
  };
}
