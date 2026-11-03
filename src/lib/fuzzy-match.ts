// Lightweight name matching for the Daily Crew Sheet scanner — no external
// dependency, just Levenshtein distance normalized against the longer
// name's length, after stripping accents/case/extra whitespace so OCR
// noise like "Jose" vs "José" or extra spacing doesn't count against a
// match.

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr.push(
        Math.min(
          prev[j] + 1, // deletion
          curr[j - 1] + 1, // insertion
          prev[j - 1] + cost, // substitution
        ),
      );
    }
    prev = curr;
  }
  return prev[n];
}

function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : 1 - distance / maxLen;
}

// 1 = identical (after normalization), 0 = completely different.
export function nameSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const distance = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  const wholeStringScore = 1 - distance / maxLen;

  // Whole-string edit distance alone penalizes a scanned name that's
  // missing a word the system's full name has (e.g. the sheet only
  // captured "Pedro Cardona" for an employee registered as "Pedro
  // Cardona Gregorio") as heavily as a genuinely different name of
  // similar length — in the wild this let an unrelated "Genaro Cardona"
  // outscore the correct longer match, since "Genaro"/"Pedro" happened
  // to edit-distance closer than the missing "Gregorio" cost. Scoring
  // each word of the shorter name against its best match in the longer
  // one, then averaging, rewards the scanned name being a clean subset
  // of the full one instead of punishing it for the word neither side
  // typed. The two scores are combined by taking the higher one, so a
  // close single-token match (e.g. a minor spelling variant) that the
  // per-word average alone might undervalue is still caught.
  const tokensA = na.split(" ");
  const tokensB = nb.split(" ");
  const [shorter, longer] =
    tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  const tokenScore =
    shorter.reduce(
      (sum, word) => sum + Math.max(...longer.map((cand) => wordSimilarity(word, cand))),
      0,
    ) / shorter.length;

  return Math.max(wholeStringScore, tokenScore);
}

export type NameMatch = {
  candidateId: string;
  candidateName: string;
  score: number;
};

// Best match for `scannedName` among `candidates`, or null if candidates is
// empty. Also returns the full ranked list so callers can show a couple of
// alternatives for a yellow (fuzzy) match.
export function bestNameMatch(
  scannedName: string,
  candidates: Array<{ id: string; name: string }>,
): { best: NameMatch | null; ranked: NameMatch[] } {
  const ranked = candidates
    .map((c) => ({
      candidateId: c.id,
      candidateName: c.name,
      score: nameSimilarity(scannedName, c.name),
    }))
    .sort((a, b) => b.score - a.score);
  return { best: ranked[0] ?? null, ranked };
}

// Thresholds used by the crew-sheet scanner to color-code a row:
// >= EXACT -> green (auto-matched), >= FUZZY -> yellow (suggested, needs
// confirmation), below that -> red (no confident match, pick manually).
export const MATCH_THRESHOLD_EXACT = 0.92;
export const MATCH_THRESHOLD_FUZZY = 0.6;
