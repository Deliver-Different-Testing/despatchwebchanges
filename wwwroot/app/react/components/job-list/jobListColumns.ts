/**
 * Job List column model.
 *
 * The catalogue of columns the job list can show, plus the pure functions that
 * turn a user's saved preferences (order, hidden set) into the column list a
 * table actually renders. Kept out of JobListTable so the column editor and the
 * table agree on one definition.
 */

export interface ColumnDef {
    key: string;
    label: string;
    sortable: boolean;
    width: number;
    align?: 'left' | 'center' | 'right';
    hideForUs?: boolean;
    showOnlyJobSearch?: boolean;
    /**
     * Structural columns the user may not hide or move. `priority` is the
     * unlabelled indicator gutter — hiding it would strip the urgency/flight
     * markers with no obvious way to get them back.
     */
    locked?: boolean;
}

export const ALL_COLUMNS: ColumnDef[] = [
    {key: 'priority', label: '', sortable: true, width: 64, align: 'center', locked: true},
    {key: 'date', label: 'Date', sortable: true, width: 80},
    {key: 'time', label: 'Time', sortable: true, width: 80},
    {key: 'speed', label: 'Speed', sortable: true, width: 80},
    {key: 'isArchived', label: 'Archived', sortable: true, width: 80, showOnlyJobSearch: true},
    {key: 'vehicle', label: 'Vehicle', sortable: true, width: 100},
    {key: 'jobNo', label: 'Job No', sortable: true, width: 130},
    {key: 'client', label: 'Client', sortable: true, width: 85, hideForUs: true},
    {key: 'refA', label: 'Ref A', sortable: true, width: 110, showOnlyJobSearch: true},
    {key: 'pickup', label: 'Pickup', sortable: true, width: 120},
    {key: 'delivery', label: 'Delivery', sortable: true, width: 380},
    {key: 'courier', label: 'Courier', sortable: true, width: 150},
    // `priority` and `remaining` are derived client-side, so they have no branch in the
    // POD search's server-side sort — on Job Search they order the loaded pages only.
    {key: 'remaining', label: 'Remaining', sortable: true, width: 110, align: 'right'},
    {key: 'status', label: 'Status', sortable: true, width: 100},
];

/** Shipped widths, derived from the catalogue so the two can't drift apart. */
export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(
    ALL_COLUMNS.map(col => [col.key, col.width]),
);

/** The columns this tenant/page can show at all, before user preferences. */
export function availableColumns(isUsCustomer?: boolean, isJobSearchPage?: boolean): ColumnDef[] {
    return ALL_COLUMNS.filter(col => {
        if (col.hideForUs && isUsCustomer) return false;
        return !(col.showOnlyJobSearch && !isJobSearchPage);
    });
}

/**
 * Apply the user's saved order and hidden set to the available columns.
 * Unknown keys in `order` are ignored and available columns missing from it are
 * slotted in after the last saved column that precedes them in the catalogue, so
 * a column added in code lands next to its intended neighbours rather than at the
 * far right for users who already have preferences saved. Locked columns are
 * always kept, and always lead.
 */
export function orderColumns(
    available: ColumnDef[],
    order: string[] = [],
    hidden: string[] = [],
): ColumnDef[] {
    const hiddenSet = new Set(hidden);
    const byKey = new Map(available.map(col => [col.key, col]));

    const ordered: ColumnDef[] = [];
    const seen = new Set<string>();
    for (const key of order) {
        const col = byKey.get(key);
        if (!col || seen.has(key)) continue;
        ordered.push(col);
        seen.add(key);
    }
    const catalogueIndex = new Map(available.map((col, index) => [col.key, index]));
    for (const col of available) {
        if (seen.has(col.key)) continue;
        let at = ordered.length;
        while (at > 0 && catalogueIndex.get(ordered[at - 1].key)! > catalogueIndex.get(col.key)!) at--;
        ordered.splice(at, 0, col);
        seen.add(col.key);
    }

    const locked = ordered.filter(col => col.locked);
    const rest = ordered.filter(col => !col.locked && !hiddenSet.has(col.key));
    return [...locked, ...rest];
}
