import type { RequirementKind } from "@/lib/admin/status-board-config";

type ShadeColumn = { reqKey: string; kind: RequirementKind };

/**
 * Shade step for a column, based on its position *within its own kind*. Returns
 * an alternating 0/1 so each kind reads as a light/dark family down the matrix,
 * and the pattern recomputes automatically as columns are pinned/unpinned
 * (because it depends only on the columns currently passed in). Widen the
 * modulo here if more than two steps are ever wanted.
 */
export function shadeStepForColumns(
  columns: readonly ShadeColumn[],
  reqKey: string,
): number {
  const target = columns.find((c) => c.reqKey === reqKey);
  if (!target) return 0;
  let indexWithinKind = 0;
  for (const col of columns) {
    if (col.reqKey === reqKey) break;
    if (col.kind === target.kind) indexWithinKind += 1;
  }
  return indexWithinKind % 2;
}
