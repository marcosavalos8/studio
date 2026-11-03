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

const TIME_RE = /\d{1,2}[:.]\d{2}/;
const NUMBER_RE = /\d+(\.\d+)?/;

// Not anchored to the whole string — a handwritten colon sometimes lands
// as its own separate OCR word, so a column's cell can end up with stray
// digits/punctuation stuck to the real value (e.g. "00/12:30" instead of
// "12:30"). Pulling the pattern out of whatever text landed in the cell
// recovers the real value in that case instead of rejecting the cell
// outright; a cell with no valid pattern anywhere in it still comes back
// null, same as before.
function normalizeTimeValue(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "");
  const match = cleaned.match(TIME_RE);
  if (!match) return null;
  return match[0].replace(".", ":");
}
function normalizeNumberValue(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "");
  const match = cleaned.match(NUMBER_RE);
  if (!match) return null;
  return match[0];
}

// Median word height across the photo, in pixels — the one scale reference
// every other distance in this parser is measured against (row spacing,
// how far below the header the data starts, how much a tilted row drifts).
// A fixed pixel count only works for the one photo it was tuned against;
// a phone photo's resolution and how far back it was taken from both vary
// a lot, so every other threshold here is a multiple of this instead.
function medianWordHeight(words: VisionWord[]): number {
  const heights = words.map((w) => w.y1 - w.y0).sort((a, b) => a - b);
  if (heights.length === 0) return 20; // arbitrary fallback, never hit in practice
  const mid = Math.floor(heights.length / 2);
  return heights.length % 2 === 0
    ? (heights[mid - 1] + heights[mid]) / 2
    : heights[mid];
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
  // The scale reference is the printed header text's own height, not a
  // median over every word — handwritten body text varies wildly in size
  // (sloppy vs. careful handwriting) independent of how zoomed-in the photo
  // is, so it's not a reliable ruler. The header's printed text and the
  // table's row spacing are both fixed by the same template and photo
  // zoom level, so their ratio holds even when their absolute pixel sizes
  // don't match a different photo.
  const lineHeight = medianWordHeight(startMatches);
  const headerBand = lineHeight * 5;
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

  // A column's own header word can land here unclaimed when it matches
  // none of HEADER_LABELS at all (seen in the wild: a real "Bins" header —
  // misprinted on the physical sheet itself, not just misread — came
  // through as "3r.s"). That missing column is always the rightmost one in
  // this template, so its real printed label (if the camera caught
  // anything at all) is whatever sits on the header row itself, to the
  // right of the last column that WAS recognized (Hours) — a *tight* band
  // matching the header text's own height, not the generous headerBand
  // used above to find the header row in the first place, which is loose
  // enough to also catch the first couple of data rows and would wrongly
  // treat their content as part of the missing label otherwise.
  const confirmedHeaderWords = Object.values(headerGroups).flat();
  const rawHeaderY =
    confirmedHeaderWords.reduce((a, w) => a + w.cy, 0) / confirmedHeaderWords.length;
  const rightmostConfirmedX1 = Math.max(...confirmedHeaderWords.map((w) => w.x1));
  const tightHeaderBand = lineHeight * 1.5;
  const claimedHeaderKeys = new Set(
    confirmedHeaderWords.map((w) => `${w.text}|${w.x0}|${w.y0}`),
  );
  const unclaimedHeaderWords = normalized.filter(
    (w) =>
      Math.abs(w.cy - rawHeaderY) <= tightHeaderBand &&
      w.x0 > rightmostConfirmedX1 &&
      !claimedHeaderKeys.has(`${w.text}|${w.x0}|${w.y0}`),
  );

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
  const order: ColumnKey[] = ["start", "lunchOut", "lunchIn", "end", "hours", "bins"];
  const rawEdges: Array<{ x0: number; x1: number } | null> = order.map((key) => {
    const g = headerGroups[key];
    if (g.length === 0) return null;
    return {
      x0: Math.min(...g.map((w) => w.x0)),
      x1: Math.max(...g.map((w) => w.x1)),
    };
  });

  // A column's header is sometimes read as garbage with no overlap with
  // any known label at all — seen in the wild: a real "Bins" header OCR'd
  // as "3r.s". Left as-is, that column's group stays empty, which used to
  // leave its neighbor's boundary unbounded (Infinity) and swallow the
  // missing column's own data into it (e.g. Hours reading "874" — the real
  // hours and the unrecognized Bins-equivalent column's digits
  // concatenated together). When there's exactly one gap and exactly one
  // leftover header-band word nobody claimed, that word IS the missing
  // label — use its real position outright rather than only estimating.
  const missingIndexes = rawEdges
    .map((e, i) => (e === null ? i : -1))
    .filter((i) => i >= 0);
  if (missingIndexes.length === 1 && unclaimedHeaderWords.length > 0) {
    rawEdges[missingIndexes[0]] = {
      x0: Math.min(...unclaimedHeaderWords.map((w) => w.x0)),
      x1: Math.max(...unclaimedHeaderWords.map((w) => w.x1)),
    };
  }

  // Every sheet in this template still has exactly 6 data columns in the
  // same left-to-right order, so any column still missing after the above
  // (no usable leftover word, or more than one gap) is reconstructed from
  // the spacing of whichever columns WERE found, rather than left to
  // corrupt its neighbor.
  const foundEdges = rawEdges.filter((e): e is { x0: number; x1: number } => e !== null);
  const avgGap = (() => {
    const gaps: number[] = [];
    for (let i = 1; i < rawEdges.length; i++) {
      const a = rawEdges[i - 1];
      const b = rawEdges[i];
      if (a && b) gaps.push(b.x0 - a.x1);
    }
    return gaps.length > 0 ? gaps.reduce((s, g) => s + g, 0) / gaps.length : lineHeight;
  })();
  const avgWidth =
    foundEdges.length > 0
      ? foundEdges.reduce((s, e) => s + (e.x1 - e.x0), 0) / foundEdges.length
      : lineHeight * 3;
  for (let i = 0; i < rawEdges.length; i++) {
    if (rawEdges[i] !== null) continue;
    const prev = rawEdges[i - 1];
    if (prev) {
      rawEdges[i] = { x0: prev.x1 + avgGap, x1: prev.x1 + avgGap + avgWidth };
      continue;
    }
    const next = rawEdges.slice(i + 1).find((e) => e !== null);
    rawEdges[i] = next
      ? { x0: next.x0 - avgGap - avgWidth, x1: next.x0 - avgGap }
      : { x0: 0, x1: avgWidth };
  }
  const edges = rawEdges as Array<{ x0: number; x1: number }>;

  const nameEdges =
    headerGroups.name.length > 0
      ? {
          x0: Math.min(...headerGroups.name.map((w) => w.x0)),
          x1: Math.max(...headerGroups.name.map((w) => w.x1)),
        }
      : { x0: 0, x1: edges[0].x0 - avgGap - avgWidth };
  const bounds: Array<{ key: ColumnKey; left: number; right: number }> = order.map(
    (key, i) => ({
      key,
      left: i === 0 ? (edges[i].x0 + nameEdges.x1) / 2 : (edges[i - 1].x1 + edges[i].x0) / 2,
      right: i === order.length - 1 ? Infinity : (edges[i].x1 + edges[i + 1].x0) / 2,
    }),
  );

  function columnForX(x: number): ColumnKey | null {
    const hit = bounds.find((b) => x >= b.left && x < b.right);
    return hit ? hit.key : null;
  }
  const binsLeft = bounds.find((b) => b.key === "bins")!.left;
  // A genuine single value's own bounding box can overshoot the boundary
  // by a few pixels of ordinary font width/padding — only an overshoot
  // close to a whole extra digit's width (roughly lineHeight, digits
  // being close to as wide as they are tall) means a second, real value
  // actually got merged in, as opposed to the column estimate just not
  // being pixel-perfect.
  const straddleMargin = lineHeight;

  // A worker's name is always letters (accents included) — real names
  // never collide with a time ("7:00") or a ditto mark, however Vision
  // misreads the ditto glyph (", !!, ||, /, …). The one ambiguous case is
  // a ditto misread as short letters, e.g. "il" — the length floor routes
  // those back through columnForX instead, where they correctly fail the
  // time/number check and inherit from the row above like any other ditto.
  function looksLikeName(text: string): boolean {
    return /^[a-zA-ZÀ-ÿ]{3,}$/.test(text);
  }

  // The sheet's own totals/legend line below the table ("Total Workers: 23
  // Rate: $ /bin Total Pay: $ Total Bins: ... Notes: ...") sits close
  // enough to the last real worker row that it can end up inside a row
  // cluster. Its words are individually letters, so looksLikeName() can't
  // tell it apart from a name on its own — this rejects a built name that
  // contains any of this template's own fixed labels.
  const FOOTER_WORDS = ["total", "rate", "notes", "workers", "pay"];
  function looksLikeFooterText(name: string): boolean {
    const words = name.toLowerCase().split(/\s+/);
    return words.some((w) => FOOTER_WORDS.includes(w));
  }

  // 3. Everything strictly below the header line (with a small margin) is
  // table data; anything above/at it is the sheet's preamble (grower,
  // date, crew leader, etc.) and gets ignored.
  const margin = lineHeight * 1.5;
  const dataWords = normalized
    .filter((w) => deskewedY(w) > headerCenterY + margin)
    .map((w) => ({ ...w, dy: deskewedY(w) }));

  if (dataWords.length === 0) {
    return { rows: [], headerFound: true };
  }

  // 4. Cluster into rows by deskewed y: sort, then start a new row whenever
  // the gap to the previous word exceeds this. Real rows are ~4 line-heights
  // apart center-to-center; a single row's own words (tilt included) spread
  // well under 2 — the threshold sits between the two so distinct rows never
  // merge and one row's own words never split in half.
  dataWords.sort((a, b) => a.dy - b.dy);
  const rowGapThreshold = lineHeight * 1.7;
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
      if (!col) continue;
      // A merged Hours+Bins word (Vision reading a real "8.5" hours + "5"
      // bins as one token "8.55") can land in EITHER column depending on
      // which side of the boundary its center falls on — dropped either
      // way instead of kept under a column it doesn't really belong to,
      // so ditto-inheritance fills that one cell from the row above
      // instead of a fabricated-looking but wrong number. Bins has no
      // column after it to catch an over-wide word reaching right, so
      // that direction is caught by its left edge (x0) reaching back into
      // Hours; Hours does have one, so that direction is caught the usual
      // way, by its own right edge (x1) reaching forward into Bins.
      if (col === "bins" && w.x0 < binsLeft - straddleMargin) continue;
      if (col === "hours" && w.x1 > binsLeft + straddleMargin) continue;
      byColumn[col].push(w);
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
    // worker — skip it instead of emitting a blank card. Also reject the
    // sheet's own totals/notes line below the table ("Total Workers",
    // "Rate", "Notes", ...) outright — those words are letters too, so
    // looksLikeName() happily accepts them, but they are never a worker's
    // name regardless of how row-clustering drew the line around them.
    if (row.name && row.name.trim() && !looksLikeFooterText(row.name)) {
      rawRows.push(row);
    }
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

  // 8. Resolve each row's Start/Lunch Out/Lunch In/End into real 24-hour
  // times. The sheet is handwritten in 12-hour time with no AM/PM marker
  // (e.g. "1:00" for 1 PM), so taken literally a 1-6 o'clock End reads as
  // 1-6 AM — earlier than the morning Start, not later, which is what
  // left clock-out blank downstream (an <input type="time"> won't render
  // a value a 24-hour reading makes impossible, and even if it did,
  // "before the shift started" fails the app's own hoursFromClock check).
  // Each column is a single shift that only moves forward through the
  // day, so a time is read as PM instead of AM whenever taking it as AM
  // would place it before (or at) the time right before it in the row.
  const rows: ParsedCrewSheetRow[] = validated.map((row, idx) => {
    const [start, lunchOut, lunchIn, end] = resolveTimeSequence([
      row.start,
      row.lunchOut,
      row.lunchIn,
      row.end,
    ]);
    return {
      rowIndex: idx + 1,
      name: (row.name ?? "").trim(),
      start,
      lunchOut,
      lunchIn,
      end,
      hours: row.hours,
      bins: row.bins,
    };
  });

  return { rows, headerFound: true };
}

// Takes a row's Start/Lunch Out/Lunch In/End as literal 12-hour "H:MM"
// readings (hour 1-12, no AM/PM) and returns them as proper zero-padded
// 24-hour "HH:MM" strings, each resolved to fall after the one before it.
function resolveTimeSequence(
  times: Array<string | null>,
): Array<string | null> {
  let prevMinutes: number | null = null;
  return times.map((t) => {
    if (!t) return t;
    const [hStr, mStr] = t.split(":");
    const literalHour = parseInt(hStr, 10);
    const minute = parseInt(mStr, 10);
    if (Number.isNaN(literalHour) || Number.isNaN(minute)) return t;

    // 12-hour hour -> 24-hour AM candidate (12 o'clock means midnight/00).
    const amHour = literalHour % 12;
    const pmHour = amHour + 12;
    const amMinutes = amHour * 60 + minute;
    const pmMinutes = pmHour * 60 + minute;

    let hour24: number;
    if (prevMinutes === null) {
      // The first time in the row (Start) anchors the rest — always
      // morning on this sheet, used as read.
      hour24 = amHour;
      prevMinutes = amMinutes;
    } else if (amMinutes > prevMinutes) {
      hour24 = amHour;
      prevMinutes = amMinutes;
    } else {
      hour24 = pmHour;
      prevMinutes = pmMinutes;
    }
    return `${String(hour24).padStart(2, "0")}:${mStr.padStart(2, "0")}`;
  });
}
