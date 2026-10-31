// Parses a Google Cloud Vision DOCUMENT_TEXT_DETECTION response for a
// "Daily Crew Sheet" photo into structured per-worker rows.
//
// The sheet is a grid: Employee Name | Start | Lunch Out | Lunch In | End |
// Hours | Bins, one row per worker. A handwritten ditto mark (", !!, ||,
// etc. — OCR reads it inconsistently) means "same value as the row above
// in this column". Rather than special-casing every glyph Vision might
// read a ditto mark as, any token that doesn't parse as a valid value for
// its column (a time like 7:00, or a plain number) is treated as a ditto
// and inherits the nearest resolved value above it in that column — this
// covers the real OCR garbage (", !!, il, /, }) without needing to name it.
//
// The photo is rarely perfectly level, so a plain y-coordinate doesn't
// cleanly separate rows — a tilted sheet makes a single printed row's
// words drift up to ~40px in y across the row's width. We estimate the
// sheet's tilt from the header row itself (its words should all sit on one
// line) and "deskew" every word's y before clustering rows by it.

export type VisionWord = {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  cx: number;
  cy: number;
};

export type ParsedCrewSheetRow = {
  rowIndex: number;
  name: string;
  start: string | null;
  lunchOut: string | null;
  lunchIn: string | null;
  end: string | null;
  hours: string | null;
  bins: string | null;
};

type RawVisionVertex = { x?: number; y?: number };
type RawVisionWord = {
  symbols?: Array<{ text?: string }>;
  boundingBox?: { vertices?: RawVisionVertex[] };
};
type RawVisionParagraph = { words?: RawVisionWord[] };
type RawVisionBlock = { paragraphs?: RawVisionParagraph[] };
type RawVisionPage = { blocks?: RawVisionBlock[] };
type RawVisionFullTextAnnotation = { pages?: RawVisionPage[] };

// Flattens Vision's pages/blocks/paragraphs/words tree into a plain list of
// words with their bounding-box extents, discarding Vision's own grouping
// (it groups by visual proximity, not by our table's columns).
export function extractWordsFromVisionResponse(
  fullTextAnnotation: RawVisionFullTextAnnotation | undefined | null,
): VisionWord[] {
  const words: VisionWord[] = [];
  const pages = fullTextAnnotation?.pages ?? [];
  for (const page of pages) {
    for (const block of page.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const word of paragraph.words ?? []) {
          const text = (word.symbols ?? []).map((s) => s.text ?? "").join("");
          const vertices = word.boundingBox?.vertices ?? [];
          if (!text || vertices.length === 0) continue;
          const xs = vertices.map((v) => v.x ?? 0);
          const ys = vertices.map((v) => v.y ?? 0);
          const x0 = Math.min(...xs);
          const x1 = Math.max(...xs);
          const y0 = Math.min(...ys);
          const y1 = Math.max(...ys);
          words.push({
            text,
            x0,
            x1,
            y0,
            y1,
            cx: (x0 + x1) / 2,
            cy: (y0 + y1) / 2,
          });
        }
      }
    }
  }
  return words;
}

const HEADER_LABELS: Record<string, keyof typeof COLUMN_ORDER_INDEX> = {
  name: "name",
  employee: "name",
  start: "start",
  out: "lunchOut",
  in: "lunchIn",
  end: "end",
  hours: "hours",
  bins: "bins",
};
const COLUMN_ORDER_INDEX = {
  name: 0,
  start: 1,
  lunchOut: 2,
  lunchIn: 3,
  end: 4,
  hours: 5,
  bins: 6,
} as const;

type ColumnKey = keyof typeof COLUMN_ORDER_INDEX;

const TIME_RE = /^\d{1,2}[:.]\d{2}$/;
const NUMBER_RE = /^\d+(\.\d+)?$/;

function normalizeTimeValue(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "");
  if (!TIME_RE.test(cleaned)) return null;
  return cleaned.replace(".", ":");
}
function normalizeNumberValue(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "");
  if (!NUMBER_RE.test(cleaned)) return null;
  return cleaned;
}

// Least-squares slope (dy/dx) of the header row's words, used to deskew a
// photo that wasn't captured perfectly level.
function estimateSlope(points: VisionWord[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.cx, 0);
  const sumY = points.reduce((a, p) => a + p.cy, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.cx - meanX) * (p.cy - meanY);
    den += (p.cx - meanX) * (p.cx - meanX);
  }
  return den === 0 ? 0 : num / den;
}

export type CrewSheetParseResult = {
  rows: ParsedCrewSheetRow[];
  headerFound: boolean;
};

export function parseCrewSheet(words: VisionWord[]): CrewSheetParseResult {
  const normalized = words.map((w) => ({
    ...w,
    norm: w.text.toLowerCase().replace(/[^a-z]/g, ""),
  }));

  // 1. Find header words and bucket them into the 7 known label groups
  // (name/start/lunchOut/lunchIn/end/hours/bins — "Lunch"+"Out" and
  // "Lunch"+"In" both use the bare "out"/"in" word to disambiguate from
  // the shared "Lunch" word). "Hours"/"Bins" also appear again in the
  // sheet's totals line near the bottom, so every match is first collected
  // unfiltered...
  const allMatches: Array<VisionWord & { key: ColumnKey }> = [];
  for (const w of normalized) {
    const key = HEADER_LABELS[w.norm];
    if (key) allMatches.push({ ...w, key });
  }

  // ...then anchored to the real header row using "start", which is
  // distinctive enough to only ever appear once, at the top of the table —
  // unlike "hours"/"bins" it has no reason to repeat in a totals line.
  const startMatches = allMatches.filter((w) => w.key === "start");
  const headerFound = startMatches.length > 0;
  if (!headerFound) {
    return { rows: [], headerFound: false };
  }
  const anchorY = Math.min(...startMatches.map((w) => w.cy));
  const headerBand = 80;
  const headerGroups: Record<ColumnKey, VisionWord[]> = {
    name: [],
    start: [],
    lunchOut: [],
    lunchIn: [],
    end: [],
    hours: [],
    bins: [],
  };
  for (const w of allMatches) {
    if (Math.abs(w.cy - anchorY) <= headerBand) headerGroups[w.key].push(w);
  }

  const allHeaderWords = Object.values(headerGroups).flat();
  const slope = estimateSlope(allHeaderWords);
  const deskewedY = (w: VisionWord) => w.cy - slope * w.cx;

  const headerCenterY =
    allHeaderWords.reduce((a, w) => a + deskewedY(w), 0) / allHeaderWords.length;

  // 2. Column boundaries for the 6 non-name columns, placed at the gap
  // between each header label's own right edge and the next label's left
  // edge (not label-center-to-center — labels sit left-aligned within
  // columns much wider than the label text itself, which is especially
  // true for "Employee Name", so a center-based split put 3-word last
  // names partway into the Start column). The Name column isn't bounded by
  // x at all — see the content-based rule below.
  const groupEdges = (key: ColumnKey) => {
    const g = headerGroups[key];
    return {
      x0: Math.min(...g.map((w) => w.x0)),
      x1: Math.max(...g.map((w) => w.x1)),
    };
  };
  const order: ColumnKey[] = ["start", "lunchOut", "lunchIn", "end", "hours", "bins"];
  const edges = order.map(groupEdges);
  const bounds: Array<{ key: ColumnKey; left: number; right: number }> = order.map(
    (key, i) => ({
      key,
      left: i === 0 ? (edges[i].x0 + groupEdges("name").x1) / 2 : (edges[i - 1].x1 + edges[i].x0) / 2,
      right: i === order.length - 1 ? Infinity : (edges[i].x1 + edges[i + 1].x0) / 2,
    }),
  );

  function columnForX(x: number): ColumnKey | null {
    const hit = bounds.find((b) => x >= b.left && x < b.right);
    return hit ? hit.key : null;
  }

  // A worker's name is always letters (accents included) — real names
  // never collide with a time ("7:00") or a ditto mark, however Vision
  // misreads the ditto glyph (", !!, ||, /, …). The one ambiguous case is
  // a ditto misread as short letters, e.g. "il" — the length floor routes
  // those back through columnForX instead, where they correctly fail the
  // time/number check and inherit from the row above like any other ditto.
  function looksLikeName(text: string): boolean {
    return /^[a-zA-ZÀ-ÿ]{3,}$/.test(text);
  }

  // 3. Everything strictly below the header line (with a small margin) is
  // table data; anything above/at it is the sheet's preamble (grower,
  // date, crew leader, etc.) and gets ignored.
  const margin = 15;
  const dataWords = normalized
    .filter((w) => deskewedY(w) > headerCenterY + margin)
    .map((w) => ({ ...w, dy: deskewedY(w) }));

  if (dataWords.length === 0) {
    return { rows: [], headerFound: true };
  }

  // 4. Cluster into rows by deskewed y: sort, then start a new row whenever
  // the gap to the previous word exceeds half a typical row's height.
  dataWords.sort((a, b) => a.dy - b.dy);
  const rowGapThreshold = 35;
  const rowClusters: (typeof dataWords)[] = [];
  let current: typeof dataWords = [];
  let lastY: number | null = null;
  for (const w of dataWords) {
    if (lastY !== null && w.dy - lastY > rowGapThreshold) {
      rowClusters.push(current);
      current = [];
    }
    current.push(w);
    lastY = w.dy;
  }
  if (current.length > 0) rowClusters.push(current);

  // 5. Within each row cluster, assign words to columns by x, then build
  // the row's raw (unvalidated) column text.
  type RawRow = Record<ColumnKey, string | null>;
  const rawRows: RawRow[] = [];
  for (const cluster of rowClusters) {
    const byColumn: Record<ColumnKey, VisionWord[]> = {
      name: [],
      start: [],
      lunchOut: [],
      lunchIn: [],
      end: [],
      hours: [],
      bins: [],
    };
    for (const w of cluster) {
      const col = looksLikeName(w.text) ? "name" : columnForX(w.cx);
      if (col) byColumn[col].push(w);
    }
    const row: RawRow = {
      name: null,
      start: null,
      lunchOut: null,
      lunchIn: null,
      end: null,
      hours: null,
      bins: null,
    };
    for (const key of ["name", ...order] as ColumnKey[]) {
      const wordsInCol = byColumn[key].sort((a, b) => a.cx - b.cx);
      if (wordsInCol.length === 0) continue;
      row[key] = wordsInCol.map((w) => w.text).join(key === "name" ? " " : "");
    }
    // A row with no name at all is almost certainly a stray mark, not a
    // worker — skip it instead of emitting a blank card.
    if (row.name && row.name.trim()) rawRows.push(row);
  }

  // 6. Validate each timed/numeric column; anything that doesn't parse
  // becomes null here, to be filled by ditto-inheritance below.
  const timeCols: ColumnKey[] = ["start", "lunchOut", "lunchIn", "end"];
  const numberCols: ColumnKey[] = ["hours", "bins"];
  const validated = rawRows.map((row) => {
    const out: RawRow = { ...row };
    for (const key of timeCols) {
      out[key] = row[key] ? normalizeTimeValue(row[key]!) : null;
    }
    for (const key of numberCols) {
      out[key] = row[key] ? normalizeNumberValue(row[key]!) : null;
    }
    return out;
  });

  // 7. Ditto inheritance: a null cell inherits the nearest resolved value
  // above it in the same column.
  const inheritCols: ColumnKey[] = [...timeCols, ...numberCols];
  for (const key of inheritCols) {
    let lastValue: string | null = null;
    for (const row of validated) {
      if (row[key] === null) {
        row[key] = lastValue;
      } else {
        lastValue = row[key];
      }
    }
  }

  const rows: ParsedCrewSheetRow[] = validated.map((row, idx) => ({
    rowIndex: idx + 1,
    name: (row.name ?? "").trim(),
    start: row.start,
    lunchOut: row.lunchOut,
    lunchIn: row.lunchIn,
    end: row.end,
    hours: row.hours,
    bins: row.bins,
  }));

  return { rows, headerFound: true };
}
