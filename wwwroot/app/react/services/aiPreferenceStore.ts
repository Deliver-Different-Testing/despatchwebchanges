/**
 * Auto-mate preferences: one master switch plus five category toggles, governing
 * 15 AI features spread across every page.
 *
 * **Why the state lives on `window` rather than in module scope.** Each React
 * island is its own root *and* its own bundle — the build does no code-splitting,
 * so a module-level singleton would give every island a private copy of the state
 * and flipping the switch in the side menu would change nothing anywhere else.
 * `window` is the one thing they genuinely share, so it holds the state and a
 * `CustomEvent` carries the change to every island's `useSyncExternalStore`.
 *
 * **Why it initialises synchronously.** localStorage seeds the state at import
 * time and the server reconciles afterwards. A user who opted out would otherwise
 * watch AI controls appear and then vanish on every page load.
 *
 * These are preferences, not permissions: they shape the UI. The server-side
 * controls are `Anthropic:Enabled` and the AI rate limiter.
 */

import {ContactID} from '../../contants';

export type AiFeatureCategory = 'briefings' | 'writing' | 'pricing' | 'formFilling' | 'triage';

export const AI_FEATURE_CATEGORIES: AiFeatureCategory[] =
    ['briefings', 'writing', 'pricing', 'formFilling', 'triage'];

export interface AiPreferences {
    /** The master switch. Off means, whatever the categories say. */
    enabled: boolean;
    /**
     * Per-category opt-outs. Absent means on — so a category added in a later
     * release inherits the master rather than appearing unannounced.
     */
    categories: Partial<Record<AiFeatureCategory, boolean>>;
    /** Open the briefing expanded rather than click-to-open. A sub-setting of `briefings`. */
    autoOpen: boolean;
    /** Whether this user has seen the one-time "Auto-mate is now on" notice. */
    noticeSeen: boolean;
}

/** On for everyone, every category, until the user says otherwise. */
export const DEFAULT_AI_PREFERENCES: AiPreferences = Object.freeze({
    enabled: true,
    categories: Object.freeze({}) as Partial<Record<AiFeatureCategory, boolean>>,
    autoOpen: false,
    noticeSeen: false,
});

const WINDOW_KEY = '__dfrntAiPreferences';
const CHANGE_EVENT = 'dfrnt:ai-preferences-changed';

/** The offline cache. Also what the server reconciles against on load. */
const CACHE_KEY = `aiPreferences_${ContactID}`;

/** The pre-categories flag, read once so an explicit opt-out survives the change. */
const LEGACY_ENABLED_KEY = `aiEnabled_${ContactID}`;
const LEGACY_AUTO_OPEN_KEY = `aiAutoOpen_${ContactID}`;

type PreferenceWindow = typeof globalThis & {[WINDOW_KEY]?: AiPreferences};

function preferenceWindow(): PreferenceWindow {
    return window as PreferenceWindow;
}

/**
 * The state a user starts from when nothing has been stored for them yet.
 *
 * Auto-mate used to be off by default and opt-in. `getItem` distinguishes "never
 * touched it" (null) from "turned it off" ('false'), so the handful of users who
 * explicitly opted out keep their choice while everyone else gets the new default.
 */
export function migrateLegacyPreferences(): AiPreferences {
    let optedOut = false;
    let autoOpen = false;
    try {
        optedOut = localStorage.getItem(LEGACY_ENABLED_KEY) === 'false';
        autoOpen = localStorage.getItem(LEGACY_AUTO_OPEN_KEY) === 'true';
    } catch {
        // A browser with storage blocked still gets the defaults.
    }

    return {...DEFAULT_AI_PREFERENCES, enabled: !optedOut, autoOpen};
}

function readCache(): AiPreferences | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? normalize(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

function writeCache(preferences: AiPreferences): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(preferences));
    } catch {
        // Storage full or blocked. The window state is still correct for this page.
    }
}

/** Anything stored or returned by the server is untrusted shape until this runs. */
export function normalize(value: unknown): AiPreferences {
    const source = (value ?? {}) as Partial<AiPreferences>;
    const categories: Partial<Record<AiFeatureCategory, boolean>> = {};

    for (const category of AI_FEATURE_CATEGORIES) {
        const stored = source.categories?.[category];
        // Only an explicit false is an opt-out; anything else leaves it on.
        if (stored === false) categories[category] = false;
    }

    return {
        enabled: source.enabled !== false,
        categories,
        autoOpen: source.autoOpen === true,
        noticeSeen: source.noticeSeen === true,
    };
}

function ensureInitialised(): AiPreferences {
    const target = preferenceWindow();
    if (!target[WINDOW_KEY]) {
        target[WINDOW_KEY] = readCache() ?? migrateLegacyPreferences();
    }
    return target[WINDOW_KEY];
}

export function getAiPreferences(): AiPreferences {
    return ensureInitialised();
}

export function subscribeToAiPreferences(onChange: () => void): () => void {
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/**
 * Replaces the stored preferences and tells every island. `persist` is false only
 * when the caller is reconciling from the server — writing that straight back
 * would be an echo.
 */
export function setAiPreferences(
    patch: Partial<AiPreferences>,
    options: {persist?: boolean} = {},
): AiPreferences {
    const next = normalize({...ensureInitialised(), ...patch});

    preferenceWindow()[WINDOW_KEY] = next;
    writeCache(next);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));

    if (options.persist !== false) void schedulePush(next);

    return next;
}

/** Whether one feature is on: the master AND its own category. */
export function isAiFeatureEnabled(
    category: AiFeatureCategory,
    preferences: AiPreferences = getAiPreferences(),
): boolean {
    if (!preferences.enabled) return false;
    return preferences.categories[category] !== false;
}

/** The master switch on its own — for chrome that is about Auto-mate itself. */
export function isAutoMateEnabled(preferences: AiPreferences = getAiPreferences()): boolean {
    return preferences.enabled;
}

// ---------------------------------------------------------------------------
//  Server reconciliation
// ---------------------------------------------------------------------------

/** Matches the debounce the dispatch layouts already push on. */
const PUSH_DEBOUNCE_MS = 750;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushFn: ((preferences: AiPreferences) => Promise<void>) | null = null;

/**
 * Supplies the server writer. Injected rather than imported so this module stays
 * free of the API layer and testable without a network stub.
 */
export function configureAiPreferencePush(
    push: ((preferences: AiPreferences) => Promise<void>) | null,
): void {
    pushFn = push;
}

async function schedulePush(preferences: AiPreferences): Promise<void> {
    if (!pushFn) return;

    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
        pushTimer = null;
        // A failed push leaves the cache correct for this browser; the next change
        // retries. Losing a toggle is not worth surfacing an error toast for.
        void pushFn?.(preferences).catch(() => undefined);
    }, PUSH_DEBOUNCE_MS);
}

/**
 * Applies what the server holds. A null payload means this user has never saved
 * their preferences — so whatever the legacy migration decided is now the answer,
 * and it gets written up so it survives on their next machine.
 */
export function applyServerPreferences(stored: unknown | null): AiPreferences {
    if (stored == null) {
        const migrated = ensureInitialised();
        return setAiPreferences(migrated);
    }

    return setAiPreferences(normalize(stored), {persist: false});
}

/** Test seam: drops the window state and any pending push. */
export function resetAiPreferencesForTest(): void {
    delete preferenceWindow()[WINDOW_KEY];
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    pushFn = null;
}
