import {ContactID} from '../contants';

const STORAGE_KEY = `aiEnabled_${ContactID}`;

/** Cached server-side flag. null = not yet fetched (assume enabled to avoid flicker). */
let _serverEnabled: boolean | null = null;

/**
 * Fetches the server-side EnableAiFeatures flag and caches it.
 * Call once during app init (e.g. app shell mount).
 */
export async function initAiSettings(): Promise<void> {
    try {
        const response = await fetch('/Ai/IsEnabled', {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'include',
        });
        if (response.ok) {
            const data = await response.json() as { enabled: boolean };
            _serverEnabled = data.enabled;
        }
    } catch {
        // Network error — default to enabled so existing features don't break
        _serverEnabled = null;
    }
}

/**
 * Returns true only when AI is enabled both server-side (via Anthropic__EnableAiFeatures)
 * and by the user's per-account localStorage preference.
 */
export function isAiEnabled(): boolean {
    if (_serverEnabled === false) return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
}

export function setAiEnabled(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEY, String(enabled));
}
