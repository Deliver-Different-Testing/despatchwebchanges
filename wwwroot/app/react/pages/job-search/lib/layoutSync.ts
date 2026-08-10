import {ILayout} from '../../../../interfaces/layout.interfaces';
import {getLayouts, saveLayouts} from '../../../services/dispatchLayoutApi';
import {
    BoxVisibilityRecord,
    LayoutSnapshot,
    LayoutStorageKeys,
    readLocalSnapshot,
    setDefaultCustomised,
    writeLocalSnapshot,
} from './layoutPersistence';
import {DispatchLayoutDto} from "../../../interfaces/dispatchLayout";

const PUSH_DEBOUNCE_MS = 750;

const pushTimers: Record<string, ReturnType<typeof setTimeout>> = {};

/** Per-layout payload stored in each row's LayoutJson. */
interface PerLayoutPayload {
    layout: ILayout['layout'];
    boxVisibility: Record<string, BoxVisibilityRecord>;
}

/**
 * Convert the whole-page snapshot into per-layout rows for the server. The
 * Default layout is included so an adjusted default follows the user between
 * devices; an untouched one is filtered out later by `shouldSeedServer`.
 */
export function snapshotToRows(snapshot: LayoutSnapshot, _defaultLayout: ILayout): DispatchLayoutDto[] {
    return snapshot.layouts.map(l => ({
        name: l.name,
        layoutJson: JSON.stringify({
            layout: l.layout,
            boxVisibility: snapshot.boxVisibility[l.name] ?? {},
        } satisfies PerLayoutPayload),
        isActive: snapshot.lastActiveLayout === l.name,
    }));
}

/**
 * Rebuild a whole-page snapshot from server rows. The Default layout is pinned
 * to slot 0 — taken from the rows if the user has adjusted theirs, otherwise
 * regenerated from code; the active row (if any) becomes the last-active layout.
 */
export function rowsToSnapshot(rows: DispatchLayoutDto[], defaultLayout: ILayout): LayoutSnapshot {
    const layouts: ILayout[] = [];
    const boxVisibility: Record<string, Record<string, BoxVisibilityRecord>> = {};
    let lastActiveLayout = defaultLayout.name;

    for (const row of rows) {
        let payload: PerLayoutPayload;
        try {
            payload = JSON.parse(row.layoutJson) as PerLayoutPayload;
        } catch (error) {
            console.error(`Skipping layout "${row.name}" with invalid JSON:`, error);
            continue;
        }
        layouts.push({name: row.name, layout: payload.layout});
        if (payload.boxVisibility) boxVisibility[row.name] = payload.boxVisibility;
        if (row.isActive) lastActiveLayout = row.name;
    }

    const storedDefault = layouts.find(l => l.name === defaultLayout.name);
    const ordered = [
        storedDefault ?? defaultLayout,
        ...layouts.filter(l => l.name !== defaultLayout.name),
    ];

    return {layouts: ordered, lastActiveLayout, boxVisibility};
}

function parsePayload(row: DispatchLayoutDto): PerLayoutPayload | null {
    try {
        return JSON.parse(row.layoutJson) as PerLayoutPayload;
    } catch {
        return null;
    }
}

/** True when the user has moved or resized something on their Default layout. */
function defaultRowDiverges(row: DispatchLayoutDto, defaultLayout: ILayout): boolean {
    const payload = parsePayload(row);
    if (!payload) return false;
    return JSON.stringify(payload.layout) !== JSON.stringify(defaultLayout.layout);
}

/**
 * Whether the local state is worth pushing to an empty server. A Default that
 * still matches the shipped arrangement and hides nothing carries no user
 * intent, so seeding it would pin every new user to today's default forever.
 */
function shouldSeedServer(rows: DispatchLayoutDto[], defaultLayout: ILayout): boolean {
    if (rows.length === 0) return false;
    if (rows.some(r => r.name !== defaultLayout.name)) return true;
    return rows.some(r => {
        if (defaultRowDiverges(r, defaultLayout)) return true;
        const payload = parsePayload(r);
        return Object.keys(payload?.boxVisibility ?? {}).length > 0;
    });
}

/** The locally-stored layouts serialized as the rows we would send to the server. */
export function readLocalRows(keys: LayoutStorageKeys, defaultLayout: ILayout): DispatchLayoutDto[] {
    return snapshotToRows(readLocalSnapshot(keys, defaultLayout), defaultLayout);
}

/**
 * Pull this page's layouts from the server into localStorage so the existing
 * synchronous load paths see them. If the server has none yet, seed it from
 * whatever is currently in localStorage so the user's existing layouts follow
 * them to other devices.
 *
 * Returns true if remote layouts were found and applied locally.
 */
export async function loadRemoteIntoLocal(
    keys: LayoutStorageKeys,
    page: string,
    defaultLayout: ILayout,
): Promise<boolean> {
    const rows = await getLayouts(page);
    if (rows.length > 0) {
        writeLocalSnapshot(keys, rowsToSnapshot(rows, defaultLayout));
        const defaultRow = rows.find(r => r.name === defaultLayout.name);
        setDefaultCustomised(keys, !!defaultRow && defaultRowDiverges(defaultRow, defaultLayout));
        return true;
    }

    const localRows = readLocalRows(keys, defaultLayout);
    if (shouldSeedServer(localRows, defaultLayout)) {
        await saveLayouts(page, localRows);
    }
    return false;
}

/**
 * Debounced push of the supplied layout rows to the server. Failures are
 * swallowed (logged) so the page stays usable offline. Debounced per page.
 */
export function queueRemotePush(page: string, rows: DispatchLayoutDto[]): void {
    if (pushTimers[page]) clearTimeout(pushTimers[page]);
    pushTimers[page] = setTimeout(() => {
        void saveLayouts(page, rows).catch(error =>
            console.error('Failed to sync dispatch layouts to server:', error),
        );
    }, PUSH_DEBOUNCE_MS);
}
