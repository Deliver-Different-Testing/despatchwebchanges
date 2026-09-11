/**
 * Panel definitions and per-box visibility persistence for the Nationwide page.
 *
 * Framework-free so the AngularJS controller and the React page share it.
 * Extracted from `initializeBoxes` (603), `getBoxVisibilityKey` (672),
 * `saveBoxVisibility` (676) and `loadBoxVisibility` (694).
 */

import {IBox, IColumn, ILayout} from '../../../../interfaces/layout.interfaces';
import {NationwideBoxes} from './nationwideBoxes';

/** Persisted shape: what the operator has hidden or collapsed, per box. */
export interface BoxVisibilityEntry {
    visible: boolean;
    collapsed: boolean;
}

/** Legacy builds persisted a bare boolean per box; still read for compatibility. */
export type PersistedBoxVisibility = Record<string, BoxVisibilityEntry | boolean>;

/**
 * The seven panels, all visible and expanded.
 *
 * Deliberately carries **no `templateUrl`** — that only means something to
 * AngularJS's `ng-include`, and it points at partials that Phase 3 deletes. The
 * AngularJS controller merges its own template paths in. (Job Search's
 * equivalent lib still carries dead `templateUrl` fields for exactly this
 * reason; not repeating it here.)
 *
 * Returns a fresh object per call so no two callers share mutable box state.
 */
export function createNationwideBoxes(): Record<string, IBox> {
    return {
        [NationwideBoxes.Map]: {
            name: NationwideBoxes.Map,
            title: 'Map',
            icon: 'pin_drop',
            showRefresh: true,
            visible: true,
            description: 'Geographic view of nationwide job locations and coverage areas',
        },
        [NationwideBoxes.NewJobs]: {
            name: NationwideBoxes.NewJobs,
            title: 'New Jobs',
            icon: 'new_releases',
            showRefresh: true,
            visible: true,
            description: 'Recently created jobs requiring assignment or review',
        },
        [NationwideBoxes.JobDetail]: {
            name: NationwideBoxes.JobDetail,
            title: 'Job Detail',
            icon: 'assignment',
            showRefresh: true,
            showDetailButtons: true,
            visible: true,
            description: 'Complete job information with management actions',
        },
        [NationwideBoxes.PodJobs]: {
            name: NationwideBoxes.PodJobs,
            title: 'Awaiting POD',
            icon: 'pending_actions',
            showRefresh: true,
            visible: true,
            description: 'Jobs pending proof of delivery documentation',
        },
        [NationwideBoxes.RepriceJobs]: {
            name: NationwideBoxes.RepriceJobs,
            title: 'Reprice',
            icon: 'price_change',
            showRefresh: true,
            visible: true,
            description: 'Jobs flagged for pricing adjustment or review',
        },
        [NationwideBoxes.Tasks]: {
            name: NationwideBoxes.Tasks,
            title: 'Tasks',
            icon: 'support',
            showRefresh: true,
            visible: true,
            description: 'Administrative tasks and follow-up items',
        },
        [NationwideBoxes.FlightAgents]: {
            name: NationwideBoxes.FlightAgents,
            title: 'Available',
            icon: 'docs_add_on',
            showRefresh: true,
            visible: true,
            description: 'List of available agents or flights ready for job assignment',
        },
    };
}

/**
 * The shipped three-column arrangement.
 *
 * Heights are V1's values verbatim and deliberately do not sum to 100% per
 * column (60+30, 60+30, 40+50+50) -- the shell normalises them, and changing
 * them here would silently re-proportion every operator's default layout.
 */
export function createDefaultNationwideLayout(): ILayout {
    const columns: IColumn[] = [
        {
            id: 'col1',
            width: '35%',
            boxes: [
                {name: NationwideBoxes.NewJobs, height: '60%'},
                {name: NationwideBoxes.FlightAgents, height: '30%'},
            ],
        },
        {
            id: 'col2',
            width: '35%',
            boxes: [
                {name: NationwideBoxes.JobDetail, height: '60%'},
                {name: NationwideBoxes.Map, height: '30%'},
            ],
        },
        {
            id: 'col3',
            width: '30%',
            boxes: [
                {name: NationwideBoxes.PodJobs, height: '40%'},
                {name: NationwideBoxes.Tasks, height: '50%'},
                {name: NationwideBoxes.RepriceJobs, height: '50%'},
            ],
        },
    ];

    return {name: 'Default', layout: {columns}};
}

/**
 * Storage key for a layout's box visibility.
 *
 * Visibility is scoped **per layout**, so hiding a panel in one saved layout
 * does not hide it in another.
 */
export function boxVisibilityKey(baseKey: string, layoutName: string): string {
    return `${baseKey}-${layoutName}`;
}

/** The persistable visibility snapshot for a set of boxes. */
export function toBoxVisibilityState(
    boxes: Record<string, IBox>,
): Record<string, BoxVisibilityEntry> {
    const state: Record<string, BoxVisibilityEntry> = {};

    for (const boxName of Object.keys(boxes)) {
        state[boxName] = {
            visible: boxes[boxName].visible ?? true,
            collapsed: boxes[boxName].collapsed ?? false,
        };
    }

    return state;
}

/**
 * Apply a saved visibility snapshot onto `boxes`, in place.
 *
 * `null`/`undefined` means this layout has no saved state, which resets every
 * panel to visible and expanded rather than leaving the previous layout's state
 * behind. Entries for boxes that no longer exist are ignored.
 */
export function applyBoxVisibility(
    boxes: Record<string, IBox>,
    saved: PersistedBoxVisibility | null | undefined,
): void {
    if (!saved) {
        for (const boxName of Object.keys(boxes)) {
            boxes[boxName].visible = true;
            boxes[boxName].collapsed = false;
        }
        return;
    }

    for (const boxName of Object.keys(saved)) {
        const box = boxes[boxName];
        if (!box) continue;

        const entry = saved[boxName];
        if (typeof entry === 'boolean') {
            box.visible = entry;
            box.collapsed = false;
        } else {
            box.visible = entry.visible ?? true;
            box.collapsed = entry.collapsed ?? false;
        }
    }
}
