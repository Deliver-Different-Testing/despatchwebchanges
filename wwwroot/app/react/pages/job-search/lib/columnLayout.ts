import {ILayout} from '../../../../interfaces/layout.interfaces';

type LayoutPayload = ILayout['layout'];

/** Smallest and largest number of columns a custom layout may have. */
export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 6;

/** Parse a "33.33%" width string into a number, falling back when unparseable. */
export function parsePercent(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

function formatPercent(value: number): string {
    return `${value.toFixed(2)}%`;
}

/**
 * Restate every width/height at a fixed 2dp so payloads that only differ in how
 * a size was spelled ("60%" vs "60.00%") compare equal. `react-resizable-panels`
 * re-emits the sizes it computed from the stored ones, so without this a plain
 * JSON comparison sees a change on every mount.
 */
function normalisePayload(payload: LayoutPayload): LayoutPayload {
    return {
        ...payload,
        columns: payload.columns.map(col => ({
            ...col,
            width: formatPercent(parsePercent(col.width, 0)),
            boxes: col.boxes.map(box => ({...box, height: formatPercent(parsePercent(box.height, 0))})),
        })),
    };
}

/** Structural equality that ignores size formatting. */
export function layoutPayloadEquals(a: LayoutPayload, b: LayoutPayload): boolean {
    return JSON.stringify(normalisePayload(a)) === JSON.stringify(normalisePayload(b));
}

/** Pick the lowest unused `col{n}` id so removes don't leave colliding gaps. */
function nextColumnId(payload: LayoutPayload): string {
    const used = new Set(payload.columns.map(c => c.id));
    for (let n = 1; ; n += 1) {
        const id = `col${n}`;
        if (!used.has(id)) return id;
    }
}

/**
 * Append an empty column. The new column takes an equal `100/(N+1)%` share and
 * the existing columns are scaled by `N/(N+1)` so widths still sum to ~100 while
 * preserving their relative proportions. No-op at MAX_COLUMNS.
 */
export function addColumnToPayload(payload: LayoutPayload): LayoutPayload {
    const count = payload.columns.length;
    if (count >= MAX_COLUMNS) return payload;

    const newShare = 100 / (count + 1);
    const scale = count / (count + 1);

    return {
        ...payload,
        columns: [
            ...payload.columns.map(col => ({
                ...col,
                width: formatPercent(parsePercent(col.width, 100 / count) * scale),
            })),
            {id: nextColumnId(payload), width: formatPercent(newShare), boxes: []},
        ],
    };
}

/**
 * Remove the rightmost column. Its boxes are appended to the previous column so
 * no panel is orphaned, and its width is redistributed proportionally across the
 * remaining columns. No-op at MIN_COLUMNS.
 */
export function removeLastColumnFromPayload(payload: LayoutPayload): LayoutPayload {
    const count = payload.columns.length;
    if (count <= MIN_COLUMNS) return payload;

    const removed = payload.columns[count - 1];
    const removedWidth = parsePercent(removed.width, 0);
    const remaining = payload.columns.slice(0, count - 1);
    const remainingTotal = 100 - removedWidth;
    // Scale so the surviving columns reclaim the removed width and sum to ~100.
    const scale = remainingTotal > 0 ? 100 / remainingTotal : 1;

    return {
        ...payload,
        columns: remaining.map((col, i) => {
            const isLastSurvivor = i === remaining.length - 1;
            return {
                ...col,
                width: formatPercent(parsePercent(col.width, 100 / count) * scale),
                boxes: isLastSurvivor ? [...col.boxes, ...removed.boxes] : col.boxes,
            };
        }),
    };
}
