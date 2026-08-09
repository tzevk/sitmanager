/**
 * Derives Actual Lecture Sequence and lecture status (normal/cancelled/replacement/pending)
 * for a batch's lecture rows.
 *
 * Actual Sequence numbers every row (not just conducted ones) in build order: conducted rows
 * first (ordered by date/time), then not-yet-conducted rows ordered by `order_seq` — the
 * batch's own, freely-reorderable build/arrangement position (distinct from the fixed
 * `standard_seq` reference back to the Standard Lecture Plan template) — so it's populated
 * as soon as topics are dragged in and reordered, not only once a date gets filled in.
 *
 * "Conducted" = date is non-blank. Cancelled = skipped over by a later-order-sequence
 * row that already has a date. Replacement = a later-order-sequence row that got
 * conducted ahead of an earlier, not-yet-conducted one. Pending = not yet conducted and
 * not skipped (nothing later has been conducted yet).
 */

export type LectureStatus = 'normal' | 'cancelled' | 'replacement' | 'pending';

export interface LectureStatusInput {
  id: number;
  order_seq: number | null;
  date: string | null;
  starttime?: string | null;
}

export interface LectureStatusResult {
  id: number;
  actual_seq: number | null;
  lecture_status: LectureStatus;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function computeLectureStatuses(rows: LectureStatusInput[]): LectureStatusResult[] {
  const withSeq = rows.map((r) => ({
    id: r.id,
    seq: r.order_seq == null ? Infinity : r.order_seq,
    date: normalizeDate(r.date),
    starttime: r.starttime ?? null,
  }));

  const conducted = withSeq
    .filter((r) => r.date !== null)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date! < b.date! ? -1 : 1;
      if (a.starttime !== b.starttime) return (a.starttime || '') < (b.starttime || '') ? -1 : 1;
      if (a.seq !== b.seq) return a.seq - b.seq;
      return a.id - b.id;
    });

  const pending = withSeq
    .filter((r) => r.date === null)
    .sort((a, b) => (a.seq !== b.seq ? a.seq - b.seq : a.id - b.id));

  const actualSeqById = new Map<number, number>();
  [...conducted, ...pending].forEach((r, i) => actualSeqById.set(r.id, i + 1));

  return withSeq.map((r) => {
    if (r.date !== null) {
      const isReplacement = withSeq.some(
        (r2) => r2.id !== r.id && r2.seq < r.seq && (r2.date === null || r2.date! > r.date!)
      );
      return {
        id: r.id,
        actual_seq: actualSeqById.get(r.id) ?? null,
        lecture_status: isReplacement ? 'replacement' : 'normal',
      };
    }

    const isCancelled = conducted.some((r2) => r2.seq > r.seq);
    return {
      id: r.id,
      actual_seq: actualSeqById.get(r.id) ?? null,
      lecture_status: isCancelled ? 'cancelled' : 'pending',
    };
  });
}
