import {ContactID} from '../contants';

const STORAGE_KEY = `aiEnabled_${ContactID}`;
const AUTO_OPEN_STORAGE_KEY = `aiAutoOpen_${ContactID}`;

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

/**
 * Returns true when the user wants the Auto-mate briefing to open expanded
 * automatically, rather than starting collapsed (click-to-open). Per-user
 * only. Defaults to false, preserving the click-to-open behaviour.
 */
export function isAiAutoOpenEnabled(): boolean {
    return localStorage.getItem(AUTO_OPEN_STORAGE_KEY) === 'true';
}

export function setAiAutoOpenEnabled(enabled: boolean): void {
    localStorage.setItem(AUTO_OPEN_STORAGE_KEY, String(enabled));
}
