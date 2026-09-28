import {ILayout} from '../../../../interfaces/layout.interfaces';
import {getLayouts, saveLayouts} from '../../../services/dispatchLayoutApi';
import {
    BoxVisibilityRecord,
    LayoutSnapshot,
    LayoutStorageKeys,
    readLocalSnapshot,
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
 * Convert the whole-page snapshot into per-layout rows for the server. The Default
 * layout is read-only and regenerated from code, so it is never sent: a `Default`
 * row on the server would only be a stale copy waiting to overwrite the shipped
 * arrangement.
 */
export function snapshotToRows(snapshot: LayoutSnapshot, defaultLayout: ILayout): DispatchLayoutDto[] {
    return snapshot.layouts.filter(l => l.name !== defaultLayout.name).map(l => ({
        name: l.name,
        layoutJson: JSON.stringify({
            layout: l.layout,
            boxVisibility: snapshot.boxVisibility[l.name] ?? {},
        } satisfies PerLayoutPayload),
        isActive: snapshot.lastActiveLayout === l.name,
    }));
}

/**
 * Rebuild a whole-page snapshot from server rows. The code-generated Default is
 * pinned to slot 0 and any `Default` row a previous version wrote is discarded;
 * the active row (if any) becomes the last-active layout.
 */
export function rowsToSnapshot(rows: DispatchLayoutDto[], defaultLayout: ILayout): LayoutSnapshot {
    const layouts: ILayout[] = [defaultLayout];
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
        if (row.name === defaultLayout.name) continue;
        layouts.push({name: row.name, layout: payload.layout});
        if (payload.boxVisibility) boxVisibility[row.name] = payload.boxVisibility;
        if (row.isActive) lastActiveLayout = row.name;
    }

    return {layouts, lastActiveLayout, boxVisibility};
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
    const userRows = rows.filter(r => r.name !== defaultLayout.name);
    if (userRows.length > 0) {
        writeLocalSnapshot(keys, rowsToSnapshot(userRows, defaultLayout));
        return true;
    }

    const localRows = readLocalRows(keys, defaultLayout);
    if (localRows.length > 0) {
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
