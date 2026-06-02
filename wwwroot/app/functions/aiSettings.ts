import {ContactID} from '../contants';

const STORAGE_KEY = `aiEnabled_${ContactID}`;

/**
 * Returns true when the signed-in user has opted in to AI features via
 * the dashboard settings dialog. Per-user only — there is no server-side
 * gate. Defaults to false: users have to turn it on themselves.
 */
export function isAiEnabled(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function setAiEnabled(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEY, String(enabled));
}
