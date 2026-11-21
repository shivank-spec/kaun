import assert from "node:assert/strict";
import { test } from "node:test";
import { FALLBACK_CASES } from "../lib/fallback-cases";
import { validateCase } from "../lib/generate-case";
import { seal, unseal } from "../lib/seal";
import { accuse, toSoloView } from "../lib/solo";

test("every hand-written case is a solvable puzzle", () => {
  for (const c of FALLBACK_CASES) assert.equal(validateCase(c, "solo"), null, c.title);
});

test("a case whose true clue points at an innocent is rejected", () => {
  const broken = structuredClone(FALLBACK_CASES[0]);
  const innocent = broken.suspects.find((s) => s.id !== broken.culprit_id)!;
  broken.clues.find((k) => !k.is_red_herring)!.points_to = innocent.id;
  assert.match(validateCase(broken, "solo") ?? "", /innocent/);
});

test("a case where the culprit holds a true clue is rejected", () => {
  const broken = structuredClone(FALLBACK_CASES[0]);
  broken.clues.find((k) => !k.is_red_herring)!.held_by = broken.culprit_id;
  assert.match(validateCase(broken, "solo") ?? "", /culprit holds/);
});

test("sealed cases round-trip and cannot be read or tampered with", () => {
  const token = seal({ secret: "culprit is s3" });
  assert.ok(!token.includes("culprit"));
  assert.deepEqual(unseal(token), { secret: "culprit is s3" });
  const tampered = token.slice(0, -4) + (token.endsWith("AAAA") ? "BBBB" : "AAAA");
  assert.throws(() => unseal(tampered));
});

test("the browser's view of a solo case never contains the answer", () => {
  const file = FALLBACK_CASES[0];
  const view = JSON.stringify({ ...toSoloView(file, "desi"), caseId: "" });
  assert.ok(!view.includes(file.motive));
  assert.ok(!view.includes(file.alibi_hole));
  assert.ok(!view.includes("culprit_id"));
});

test("map spots hand out only the red herrings, never a true clue", () => {
  const file = FALLBACK_CASES[0];
  const view = toSoloView(file, "desi");
  const trueIds = file.clues.filter((k) => !k.is_red_herring).map((k) => k.id);
  assert.ok(view.spots.every((s) => !trueIds.includes(s.id)));
  assert.equal(view.actions, 6);
});

test("scoring rewards the right accusation, clues and speed", () => {
  const file = FALLBACK_CASES[0];
  const { caseId } = toSoloView(file, "desi");
  const trueClues = file.clues.filter((k) => !k.is_red_herring).map((k) => k.id);
  const wrong = file.suspects.find((s) => s.id !== file.culprit_id)!.id;
  const fast = accuse(caseId, file.culprit_id, trueClues, 30);
  const slow = accuse(caseId, file.culprit_id, trueClues, 140);
  const miss = accuse(caseId, wrong, trueClues, 30);
  assert.ok(fast.correct && fast.score > slow.score);
  assert.ok(!miss.correct && miss.score < slow.score);
  assert.equal(fast.cluesFound, 3);
  const cracked = accuse(caseId, file.culprit_id, trueClues, 30, trueClues);
  assert.equal(cracked.contradictions, 2);
  assert.ok(cracked.score > fast.score);
});

test("room stories never call a player he or she", async () => {
  const { neutralText } = await import("../lib/rooms");
  assert.equal(
    neutralText("Vikram was caught and confessed, noting her stress. The paper was found in her bag. She was tired; he's done. Ask her."),
    "Vikram was caught and confessed, noting their stress. The paper was found in their bag. They were tired; they're done. Ask them.",
  );
});

test("an escaped culprit is never described as arrested", async () => {
  const { escapedEnding } = await import("../lib/rooms");
  const file = { ...FALLBACK_CASES[0], ending_escaped: "None – Asha was arrested on the spot." };
  assert.doesNotMatch(escapedEnding(file), /arrest|None/);
  assert.match(escapedEnding(file), /walked away free/);
  const fine = { ...FALLBACK_CASES[0], ending_escaped: "They slipped out through the side door and were never seen again." };
  assert.equal(escapedEnding(fine), fine.ending_escaped);
});
