/** Names for the AI suspects. Shared by the lobby and the server so both show the same people. */
const POOL = [
  "Asha", "Vikram", "Meera", "Kabir", "Zoya", "Leo", "Nina", "Omar", "Iris", "Felix",
  "Maya", "Hugo", "Lena", "Theo", "Sara", "Noah", "Ivy", "Dev", "Rhea", "Max",
];

/** How many AI suspects a room needs: six seats minimum, and never an empty one. */
export const botsNeeded = (humans: number) => Math.max(0, 6 - humans);

/** A different line-up for every room code, skipping any name a real player already uses. */
export function botNamesFor(code: string, takenFirstNames: string[] = []): string[] {
  let seed = 0;
  for (const ch of code.toUpperCase()) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const taken = new Set(takenFirstNames.map((n) => n.toLowerCase()));
  const names = [...POOL];
  // A small seeded shuffle.
  for (let i = names.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const k = seed % (i + 1);
    [names[i], names[k]] = [names[k], names[i]];
  }
  return names.filter((n) => !taken.has(n.toLowerCase()));
}
