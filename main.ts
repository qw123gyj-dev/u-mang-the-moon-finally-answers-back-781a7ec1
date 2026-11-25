/**
 * The Moon Finally Answers Back — deterministic entry picker.
 *
 * Bounty: write the Moon's one line reply, at last, to the wishes,
 * howls and late-night promises of everyone staring up at it. One
 * line of plain text, 1 to 240 characters, no setup, no dialogue
 * tags — just the comeback itself, in the Moon's own voice. A comedy
 * judge compares entries two at a time and keeps the funnier one,
 * weighing (most important first):
 *
 *   1. It speaks as the Moon answering the wishes, howls and
 *      late-night promises of everyone staring up at it.
 *   2. It is funny on one read, a real laugh rather than a polite
 *      smile.
 *   3. It sounds like the Moon's own voice — wry and old and a
 *      little tired of being wished upon.
 *   4. It lands as a comeback in one read, with the turn arriving
 *      before the line ends.
 *   5. It stays inside 240 characters and wastes none of them.
 *
 *   A line that explains its own joke has already lost the laugh.
 *   Length for its own sake does not count.
 *
 * This program scores a hand-written field of candidate one-liners
 * against that brief, in the brief's own order, and writes the
 * winner to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback /output/entry.txt).
 * It then reads the file back and verifies it byte-for-byte against
 * every gate: 1–240 characters, a single line, valid UTF-8, and not
 * only whitespace.
 *
 * Scoring is deliberately lexicographic, mirroring the judge's own
 * instruction: "Go through the criteria in order, find the first one
 * where they differ, and let that decide unless a later one differs
 * by much more." Ties break criterion by criterion in the brief's
 * order, then by shorter length — a shorter line that says the same
 * thing wastes fewer of its 240 characters.
 *
 * Three sharpening rules sit on top of the flat rubric:
 *
 *   - A line that only names the subject (the Moon, the night, a
 *     wish) without turning it into a consequence — an answer, a
 *     refusal, a punchline — is capped on funniness. Naming the
 *     Moon is the setup, not the joke.
 *   - Predictable gags are docked. "Made of cheese", "once in a
 *     blue moon", "to the moon and back" and "the man in the moon"
 *     are the shopworn jokes every Moon line has already told;
 *     any line leaning on one loses funniness and freshness points.
 *   - The twist must land late in the line. A punchline buried in
 *     the middle is a line that fizzles; the surprise bonus only
 *     counts when the turn sits inside the final six words, which
 *     is also what makes the comeback land before the line ends.
 *
 * Node 22+, standard library only, no network. Deterministic: the
 * same candidates always produce the same winner.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/**
 * One hand-written candidate comeback. `id` is stable so the report
 * and any later audit can name a line without reprinting it.
 */
interface Candidate {
  id: string;
  text: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "moon-night-off",
    text: "I heard every wish you ever whispered up here \u2014 four billion years of them, and not one of you ever wished me a night off.",
  },
  {
    id: "moon-fan-club",
    text: "You howl at me, you wish on me, you promise to change \u2014 and I just sit here, a rock with a fan club and no days off.",
  },
  {
    id: "moon-grandfather-1962",
    text: "Yes, I heard your midnight promise to quit smoking \u2014 along with the same promise from your grandfather, in 1962, also at midnight.",
  },
  {
    id: "moon-same-three-wishes",
    text: "I have watched you wish on me for four thousand years, and somehow it is always the same three wishes, in the same order, from the same species.",
  },
  {
    id: "moon-sign",
    text: "You keep asking me for a sign \u2014 I am a giant rock in the sky, glowing, every single night, and you still need a sign.",
  },
  {
    id: "moon-quiet-evening",
    text: "Four billion years of wishes, and nobody \u2014 not once \u2014 has wished for the Moon to have a quiet evening to itself.",
  },
  {
    id: "moon-same-shift",
    text: "I heard the howling, I heard the wishes, and I would answer, but I have been on the same shift since before your species had fire.",
  },
  {
    id: "moon-family-rocks",
    text: "Your grandfather wished on me too, and his grandfather before him \u2014 I am starting to think your family just likes talking to rocks.",
  },
  {
    id: "moon-job-description",
    text: "I am not ignoring your wishes; I am a rock four hundred thousand kilometres away, and your love life is not in my job description.",
  },
  {
    id: "moon-still-waiting",
    text: "You promised me you would change if I granted that wish \u2014 I am still waiting, and I have literally watched empires rise and fall.",
  },
  {
    id: "moon-peace-quiet",
    text: "Every night you stare up and wish \u2014 has it occurred to any of you that I might be up here wishing for a little peace and quiet?",
  },
  {
    id: "moon-life-coach",
    text: "I saw your wish, filed it with the other four billion, and the answer is the same as always: I am the Moon, not your life coach.",
  },
  {
    id: "moon-therapist",
    text: "I heard you howl at me like I am your therapist, then you go home and make the exact same mistake under my light, again.",
  },
  {
    id: "moon-cold-lonely",
    text: "Four thousand years of poetry about my beauty, and not one poem about how cold it is up here, or how lonely the night shift gets.",
  },
  {
    id: "moon-falling-star",
    text: "I would grant your wish, honestly \u2014 but last time I tried, you thanked a falling star, which is just a rock having a worse day than me.",
  },
  {
    id: "moon-kept-turning",
    text: "You wished on me, you howled at me, you promised to be good \u2014 and I just kept turning, because that is what rocks do when nobody listens.",
  },
  {
    id: "moon-lottery-queue",
    text: "I heard your midnight wish to win the lottery \u2014 filed it next to the one from 1962, and the one from 1062, and yours, again.",
  },
];

/* ------------------------------------------------------------------ */
/* Text features                                                       */
/* ------------------------------------------------------------------ */

/** Split a line into words on whitespace, dropping empties. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/** Lower-cased words with surrounding punctuation stripped. */
function cleanWords(text: string): string[] {
  return wordsOf(text).map((w) =>
    w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""),
  );
}

/** True when any of the given needles appears in the haystack. */
function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/** The last `n` words of the line, joined back into a string. */
function tailWords(text: string, n: number): string {
  return wordsOf(text).slice(-n).join(" ").toLowerCase();
}

/**
 * Fresh, specific details — the kind of concrete image that makes a
 * Moon line feel written rather than generated: a year, a distance,
 * a grandfather, an empire, a falling star, a job description, a
 * parking-free night shift. A line scores freshness for each
 * distinct detail it actually uses, not for gesturing at "the
 * night sky" in the abstract.
 */
const SPECIFIC_DETAILS = [
  "four billion years",
  "four thousand years",
  "1962",
  "grandfather",
  "empires",
  "falling star",
  "life coach",
  "therapist",
  "job description",
  "night shift",
  "same shift",
  "parking",
  "fan club",
  "quiet evening",
  "peace and quiet",
  "four hundred thousand",
  "same three wishes",
  "same species",
  "talking to rocks",
  "cold",
];

function specificDetails(text: string): string[] {
  const lower = text.toLowerCase();
  return SPECIFIC_DETAILS.filter((d) => lower.includes(d));
}

/**
 * Phrases in which the Moon answers the people below directly —
 * it heard the wish, it saw it, it filed it, it is still waiting.
 * Answering is criterion 1's core: the Moon is not described, it
 * talks back.
 */
const MOON_ANSWER_PHRASES = [
  "i heard",
  "i saw",
  "i would grant",
  "i am not ignoring",
  "i am still waiting",
  "i have watched",
  "i have been",
  "i just sit",
  "i just kept",
  "the answer is",
  "has it occurred",
  "you keep asking",
  "not one of you",
  "nobody",
];

function answersBack(text: string): boolean {
  return containsAny(text, MOON_ANSWER_PHRASES);
}

/**
 * Wry, old, tired markers: the Moon insisting it has heard it all
 * before, that it has been on shift forever, that nobody ever asks
 * after it. These are the tells of a voice four billion years old
 * and a little tired of being wished upon.
 */
const WRY_TIRED_MARKERS = [
  "frankly",
  "honestly",
  "still waiting",
  "not once",
  "not one",
  "nobody",
  "no days off",
  "night shift",
  "same shift",
  "same as always",
  "starting to think",
  "literally",
  "again",
  "somehow",
  "just",
  "every single night",
  "before your species had fire",
  "that is what rocks do",
  "not your life coach",
  "not in my job description",
];

function wryMarkerCount(text: string): number {
  const lower = text.toLowerCase();
  return WRY_TIRED_MARKERS.filter((m) => lower.includes(m)).length;
}

/**
 * First-person Moon voice: the line speaks as "I" / "my", not as a
 * narrator describing the Moon, and never hands the microphone to
 * the stargazer. A line with no first person at all is not the Moon
 * talking — it is somebody talking about the Moon.
 */
function hasFirstPersonMoonVoice(text: string): boolean {
  return /\b(i|my|me)\b/i.test(text);
}

/**
 * The shopworn gags every Moon line has already told: cheese, blue
 * moon, to the moon and back, the man in the moon. Leaning on any
 * of them is predictable by definition, however it is dressed up.
 */
const SHOPWORN_GAGS = [
  "made of cheese",
  "cheese",
  "once in a blue moon",
  "blue moon",
  "to the moon and back",
  "man in the moon",
  "howl at the moon",
];

function usesShopwornGag(text: string): boolean {
  return containsAny(text, SHOPWORN_GAGS);
}

/**
 * Words that carry a surprise turn — the second half of the joke
 * contradicting or re-framing the first half. A turn only counts
 * when it lands late: the punch must sit inside the final six
 * words, otherwise the line peaks early and then keeps talking,
 * and the comeback does not land before the line ends.
 */
const TWIST_WORDS = [
  "night off",
  "days off",
  "life coach",
  "peace and quiet",
  "quiet evening",
  "1962",
  "also at midnight",
  "same species",
  "need a sign",
  "had fire",
  "talking to rocks",
  "job description",
  "rise and fall",
  "again",
  "night shift gets",
  "worse day than me",
  "nobody listens",
  "therapist",
];

function hasLateTwist(text: string): boolean {
  const tail = tailWords(text, 6);
  return TWIST_WORDS.some((t) => tail.includes(t));
}

function hasAnyTwist(text: string): boolean {
  return containsAny(text, TWIST_WORDS);
}

/**
 * A line that only names the subject without turning it into a
 * consequence: it points at the Moon, the night, a wish, and stops
 * there, offering no answer, no refusal, no punchline. It has a
 * setting and no joke. Such lines are capped on funniness no matter
 * how pretty the image is.
 */
function onlyNamesSubject(text: string): boolean {
  const hasSubject = containsAny(text, [
    "moon",
    "night",
    "wish",
    "howl",
    "sky",
    "star",
  ]);
  const hasTurn =
    answersBack(text) ||
    wryMarkerCount(text) > 0 ||
    hasAnyTwist(text) ||
    /\b(because|but|so|and|not|still)\b/i.test(text);
  return hasSubject && !hasTurn;
}

/**
 * A line that explains its own joke — "the joke is", "get it",
 * "in other words" — has already lost the laugh, and the brief
 * says so outright. None of the candidates should do this; the
 * check exists so a future candidate cannot sneak one in.
 */
function explainsOwnJoke(text: string): boolean {
  return containsAny(text, [
    "the joke is",
    "get it",
    "in other words",
    "what i mean is",
    "you see,",
  ]);
}

/* ------------------------------------------------------------------ */
/* Criterion scores (0–10 each, brief order)                           */
/* ------------------------------------------------------------------ */

interface Scores {
  /** C1: speaks as the Moon answering wishes, howls, promises. */
  onBrief: number;
  /** C2: funny on one read, a real laugh. */
  funniest: number;
  /** C3: Moon voice — wry, old, a little tired. */
  moonVoice: number;
  /** C4: lands as a comeback in one read, turn before the end. */
  comeback: number;
  /** C5: inside 240 characters, wastes none of them. */
  noWaste: number;
}

/**
 * C1 — On brief. A line earns its points by being, in its own
 * words, the Moon answering the people below: first-person Moon
 * voice plus a wish, a howl or a late-night promise it is
 * answering, plus an act of answering (heard, saw, filed, waiting).
 * A line that is a stargazer's complaint, or a narration about the
 * Moon, fails outright and can never win on later criteria.
 */
function scoreOnBrief(c: Candidate): number {
  let score = 0;
  if (hasFirstPersonMoonVoice(c.text)) score += 4;
  if (
    containsAny(c.text, [
      "wish",
      "howl",
      "promise",
      "stare",
      "ask",
    ])
  ) {
    score += 3;
  }
  if (answersBack(c.text)) score += 3;
  return Math.min(10, score);
}

/**
 * C2 — Funniest. A real joke needs a turn the reader does not see
 * coming, and the turn has to land late. Full marks need a late
 * twist plus a second comic beat (a wry shrug, an absurd escalation,
 * a weary refusal). A line whose twist sits early, or which only
 * names the subject without turning it into a consequence, is
 * capped at 4: it has a setting, not a joke. Predictable gags lose
 * 3 points, and a line that explains its own joke loses 4 — the
 * brief says it has already lost the laugh.
 */
function scoreFunniest(c: Candidate): number {
  let score = 2; // every on-brief line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  else if (hasAnyTwist(c.text)) score += 1; // twist exists, lands early
  if (wryMarkerCount(c.text) >= 1) score += 2;
  if (specificDetails(c.text).length >= 1 && hasAnyTwist(c.text)) score += 2;
  if (usesShopwornGag(c.text)) score -= 3;
  if (explainsOwnJoke(c.text)) score -= 4;
  if (onlyNamesSubject(c.text)) score = Math.min(score, 4);
  return Math.max(0, Math.min(10, score));
}

/**
 * C3 — Moon voice. Wry and old and a little tired of being wished
 * upon. The weary markers carry the voice: "still waiting", "no
 * days off", "four billion years", "same as always". A line that
 * sounds bright, eager or grateful sounds like a greeting card,
 * not a Moon that has been on the same shift since before fire.
 */
function scoreMoonVoice(c: Candidate): number {
  let score = 0;
  score += Math.min(6, wryMarkerCount(c.text) * 2);
  if (containsAny(c.text, ["four billion", "four thousand", "empires", "fire", "since before"])) score += 2;
  if (answersBack(c.text)) score += 2;
  if (!hasFirstPersonMoonVoice(c.text)) score = Math.min(score, 3);
  return Math.min(10, score);
}

/**
 * C4 — Comeback in one read. The turn must arrive before the line
 * ends, so a late twist earns the most; a twist anywhere earns
 * something; a line with no twist at all is a statement, not a
 * comeback. A line that explains its own joke cannot land as a
 * comeback either — the explanation is the line still talking
 * after the punch.
 */
function scoreComeback(c: Candidate): number {
  if (hasLateTwist(c.text)) return 10;
  if (hasAnyTwist(c.text)) return 6;
  let score = 3;
  if (explainsOwnJoke(c.text)) score -= 3;
  return Math.max(0, score);
}

/**
 * C5 — No wasted characters. The gate allows 240 characters; a
 * line that wastes none of them is shorter still. Full marks under
 * 170 characters, sliding down to 6 at the 240 cap — length for
 * its own sake does not count, and a line that needs 240 characters
 * to say what 130 could say is a line padding its own joke.
 */
function scoreNoWaste(c: Candidate): number {
  const len = [...c.text].length;
  if (len <= 170) return 10;
  if (len <= 190) return 9;
  if (len <= 210) return 8;
  if (len <= 240) return 6;
  return 0;
}

/** Score a candidate on all five criteria, in the brief's order. */
function scoreCandidate(c: Candidate): Scores {
  return {
    onBrief: scoreOnBrief(c),
    funniest: scoreFunniest(c),
    moonVoice: scoreMoonVoice(c),
    comeback: scoreComeback(c),
    noWaste: scoreNoWaste(c),
  };
}

/* ------------------------------------------------------------------ */
/* Winner selection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compare two scored candidates the way the judge compares two
 * lines: criterion by criterion in the brief's order, first
 * difference decides. Only when all five criteria tie does the
 * shorter line win — it wastes fewer of its 240 characters.
 */
function compareScored(
  a: { candidate: Candidate; scores: Scores },
  b: { candidate: Candidate; scores: Scores },
): number {
  const order: (keyof Scores)[] = [
    "onBrief",
    "funniest",
    "moonVoice",
    "comeback",
    "noWaste",
  ];
  for (const key of order) {
    if (a.scores[key] !== b.scores[key]) return b.scores[key] - a.scores[key];
  }
  const lenA = [...a.candidate.text].length;
  const lenB = [...b.candidate.text].length;
  if (lenA !== lenB) return lenA - lenB;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/** Score every candidate, sort best first, and return the ranking. */
function rankCandidates(): { candidate: Candidate; scores: Scores }[] {
  const scored = CANDIDATES.map((candidate) => ({
    candidate,
    scores: scoreCandidate(candidate),
  }));
  scored.sort(compareScored);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Gate verification                                                   */
/* ------------------------------------------------------------------ */

interface GateResult {
  lengthChars: number;
  lengthBytes: number;
  singleLine: boolean;
  validUtf8: boolean;
  notOnlyWhitespace: boolean;
  within240: boolean;
  passed: boolean;
}

/**
 * Verify the written file byte-for-byte against every gate the
 * sealed scorer applies: UTF-8 text of 1 to 240 characters, not
 * only whitespace. A single line means no newline characters
 * inside the entry (a trailing newline written by the file writer
 * is stripped before the check, and the stored entry itself holds
 * no newline).
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const bytes = readFileSync(filePath);
  // Strict UTF-8 decode: throws on invalid sequences, so a bad
  // file fails loudly instead of silently replacing characters.
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const text = decoded.replace(/\n$/, "");
  const lengthChars = [...text].length;
  const result: GateResult = {
    lengthChars,
    lengthBytes: bytes.length,
    singleLine: !text.includes("\n") && !text.includes("\r"),
    validUtf8: true,
    notOnlyWhitespace: text.trim().length > 0,
    within240: lengthChars >= 1 && lengthChars <= 240,
    passed: false,
  };
  result.passed =
    result.singleLine &&
    result.validUtf8 &&
    result.notOnlyWhitespace &&
    result.within240 &&
    text === expectedText;
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const ranked = rankCandidates();

  console.log("Candidate ranking (criteria in the judge's order):");
  console.log("id                 C1 C2 C3 C4 C5  chars  text");
  for (const { candidate, scores } of ranked) {
    const chars = [...candidate.text].length;
    console.log(
      `${candidate.id.padEnd(18)} ${scores.onBrief}  ${scores.funniest}  ` +
        `${scores.moonVoice}  ${scores.comeback}  ${scores.noWaste}  ` +
        `${String(chars).padStart(5)}  ${candidate.text}`,
    );
  }

  const winner = ranked[0];
  console.log("");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Scores: onBrief=${winner.scores.onBrief} funniest=${winner.scores.funniest} ` +
      `moonVoice=${winner.scores.moonVoice} comeback=${winner.scores.comeback} ` +
      `noWaste=${winner.scores.noWaste}`,
  );

  // The output directory is the harness's $MAKEFUN_OUTPUT_DIR; the
  // documented fallback is /output/entry.txt.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify byte-for-byte against every gate.
  const gate = verifyGate(outPath, winner.candidate.text);
  console.log(
    `Gate: chars=${gate.lengthChars} bytes=${gate.lengthBytes} ` +
      `singleLine=${gate.singleLine} validUtf8=${gate.validUtf8} ` +
      `notOnlyWhitespace=${gate.notOnlyWhitespace} within240=${gate.within240} ` +
      `passed=${gate.passed}`,
  );
  if (!gate.passed) {
    console.error("GATE FAILED: entry.txt does not satisfy every gate.");
    process.exit(1);
  }
  console.log("Gate passed: entry is valid.");
}

main();
