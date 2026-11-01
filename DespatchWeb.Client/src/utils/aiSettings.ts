import {getContactId} from '../api/session';
import {getPreference, savePreference} from '../api/preferencesApi';

const storageKey = () => `aiEnabled_${getContactId()}`;
const autoOpenStorageKey = () => `aiAutoOpen_${getContactId()}`;
const chatStorageKey = () => `aiChatEnabled_${getContactId()}`;

/** Fired on window when the chat setting changes so the mounted chat provider can follow it. */
export const AI_CHAT_CHANGED_EVENT = 'automate-chat-enabled-changed';

/** StaffPreference key: source of truth is the server, localStorage is a synchronous read-through cache. */
const AUTO_MATE_PREFERENCE_KEY = 'AutoMate';

interface AutoMatePreference {
    aiEnabled: boolean;
    aiAutoOpen: boolean;
    chatEnabled?: boolean;
}

/**
 * Returns true when the signed-in user has opted in to AI features via
 * the Settings page. Defaults to false: users have to turn it on themselves.
 */
export function isAiEnabled(): boolean {
    return localStorage.getItem(storageKey()) === 'true';
}

/**
 * Returns true when the user wants the Auto-mate briefing to open expanded
 * automatically, rather than starting collapsed (click-to-open). Defaults to
 * false, preserving the click-to-open behaviour.
 */
export function isAiAutoOpenEnabled(): boolean {
    return localStorage.getItem(autoOpenStorageKey()) === 'true';
}

/** Returns true unless the user has turned the Auto-mate chat assistant off. Defaults to true. */
export function isAiChatEnabled(): boolean {
    return localStorage.getItem(chatStorageKey()) !== 'false';
}

/**
 * Pushes the combined Auto-mate payload to the server. Fire-and-forget: a
 * failed sync is logged rather than surfaced, so the toggle stays usable
 * offline — the local value it just wrote is already correct for this
 * browser.
 */
function persistAutoMateToServer(): void {
    const payload: AutoMatePreference = {
        aiEnabled: isAiEnabled(),
        aiAutoOpen: isAiAutoOpenEnabled(),
        chatEnabled: isAiChatEnabled(),
    };
    void savePreference(AUTO_MATE_PREFERENCE_KEY, JSON.stringify(payload)).catch(error =>
        console.error('Failed to sync Auto-mate settings to server:', error),
    );
}

export function setAiEnabled(enabled: boolean): void {
    localStorage.setItem(storageKey(), String(enabled));
    persistAutoMateToServer();
}

export function setAiAutoOpenEnabled(enabled: boolean): void {
    localStorage.setItem(autoOpenStorageKey(), String(enabled));
    persistAutoMateToServer();
}

export function setAiChatEnabled(enabled: boolean): void {
    localStorage.setItem(chatStorageKey(), String(enabled));
    window.dispatchEvent(new Event(AI_CHAT_CHANGED_EVENT));
    persistAutoMateToServer();
}

/**
 * Pulls Auto-mate settings from the server into localStorage so the existing
 * synchronous isAiEnabled()/isAiAutoOpenEnabled() reads see them, the same
 * read-through pattern dispatch layouts use. If the server has nothing yet,
 * seeds it only from choices made in this browser, so opening Settings never
 * saves the defaults.
 */
export async function loadAutoMateFromServer(): Promise<void> {
    const json = await getPreference(AUTO_MATE_PREFERENCE_KEY);
    if (json === null) {
        const hasLocalChoice = localStorage.getItem(storageKey()) !== null
            || localStorage.getItem(autoOpenStorageKey()) !== null
            || localStorage.getItem(chatStorageKey()) !== null;
        if (hasLocalChoice) persistAutoMateToServer();
        return;
    }

    try {
        const payload = JSON.parse(json) as AutoMatePreference;
        localStorage.setItem(storageKey(), String(payload.aiEnabled));
        localStorage.setItem(autoOpenStorageKey(), String(payload.aiAutoOpen));
        // Payloads saved before the chat existed have no chatEnabled; those users get the default (on).
        localStorage.setItem(chatStorageKey(), String(payload.chatEnabled !== false));
        window.dispatchEvent(new Event(AI_CHAT_CHANGED_EVENT));
    } catch (error) {
        console.error('Failed to parse Auto-mate settings from server:', error);
    }
}
