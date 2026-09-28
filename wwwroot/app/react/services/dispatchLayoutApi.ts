/**
 * Dispatch Layout API
 *
 * Persists each user's saved layouts (one row per layout, per page) to the
 * database so layouts sync across browser sessions and computers. The current
 * staff member is resolved server-side from the auth claims, so only the page
 * and the layout set are sent.
 */

import {apiClient} from './apiClient';
import {DispatchLayoutDto} from "../interfaces/dispatchLayout";

/** Returns the staff member's saved layouts for the page (excludes the client Default). */
export async function getLayouts(page: string): Promise<DispatchLayoutDto[]> {
    const layouts = await apiClient.get<DispatchLayoutDto[]>('DispatchLayout/GetLayouts', {page});
    return layouts ?? [];
}

/** Replaces the staff member's layouts for the page (upsert + delete-missing). */
export async function saveLayouts(page: string, layouts: DispatchLayoutDto[]): Promise<void> {
    await apiClient.post('DispatchLayout/SaveLayouts', {page, layouts});
}
