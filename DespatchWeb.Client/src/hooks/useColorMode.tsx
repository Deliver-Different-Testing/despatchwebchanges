import {getSession} from '../api/session';
/**
 * DFRNT light/dark colour-mode provider + hook. Ported from the
 * `dfrnt-brand-theming` skill (`assets/useColorMode.tsx`).
 *
 * Defaults to the OS theme ('system'), persists an explicit 'light'/'dark' pick to
 * localStorage, and follows OS changes live. Wire it above `MantineProvider` and
 * feed the resolved `mode` into `forceColorScheme` so there is one source of truth
 * — `DfrntMantineProvider` already does this.
 *
 * Every island mounts its own provider, so a pick is broadcast on `window`
 * (same document) and via the `storage` event (other tabs) to keep them in step.
 * The pick is also saved as the `Appearance` StaffPreference so it follows the
 * user across devices; localStorage stays the synchronous cache that avoids a flash.
 */
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import type {Md3Mode} from '../theme/md3';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';
import {getPreference, savePreference} from '../api/preferencesApi';

export const COLOR_MODE_STORAGE_KEY = 'dd-color-mode';
const CHANGE_EVENT = 'dd-color-mode-change';
const SERVER_SYNC_FLAG = '__ddColorModeServerSynced';
const DARK_QUERY = '(prefers-color-scheme: dark)';

export type ColorModePreference = Md3Mode | 'system';

export interface ColorModeContextValue {
    mode: Md3Mode;
    preference: ColorModePreference;
    setPreference: (preference: ColorModePreference) => void;
}

const DEFAULT_VALUE: ColorModeContextValue = {
    mode: 'light',
    preference: 'system',
    setPreference: () => {},
};

export const ColorModeContext = createContext<ColorModeContextValue>(DEFAULT_VALUE);

export function useColorMode(): ColorModeContextValue {
    return useContext(ColorModeContext);
}

function isPreference(value: unknown): value is ColorModePreference {
    return value === 'light' || value === 'dark' || value === 'system';
}

/** The pick saved in this browser, or null when the user has never chosen one here. */
function readExplicitPreference(): ColorModePreference | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
        if (isPreference(stored)) return stored;
    } catch {
        /* localStorage unavailable — treat as no choice */
    }
    return null;
}

function readStoredPreference(): ColorModePreference {
    return readExplicitPreference() ?? 'system';
}

function getSystemMode(): Md3Mode {
    try {
        if (window.matchMedia?.(DARK_QUERY).matches) return 'dark';
    } catch {
        /* matchMedia unavailable — fall through to default */
    }
    return 'light';
}

function resolveMode(preference: ColorModePreference): Md3Mode {
    return preference === 'system' ? getSystemMode() : preference;
}

function persist(preference: ColorModePreference): void {
    try {
        window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, preference);
    } catch {
        /* ignore */
    }
}

function saveToServer(preference: ColorModePreference): void {
    void savePreference(StaffPreferenceKey.Appearance, preference).catch(error =>
        console.error('Failed to sync appearance preference to server:', error),
    );
}

/** Only a signed-in staff member (Razor sets ContactID) has a server preference to sync. */
function canSyncWithServer(): boolean {
    return Number(getSession().contactId) > 0;
}

/**
 * Reconciles with the server once per page (islands share one window): a saved
 * server value wins and is broadcast; with none saved, only a choice made in this
 * browser seeds it, so opening a page never saves the 'system' default.
 */
async function syncFromServerOnce(): Promise<void> {
    const flagged = window as unknown as Record<string, boolean>;
    if (flagged[SERVER_SYNC_FLAG]) return;
    flagged[SERVER_SYNC_FLAG] = true;
    try {
        const value = await getPreference(StaffPreferenceKey.Appearance);
        if (isPreference(value)) {
            persist(value);
            window.dispatchEvent(new CustomEvent<ColorModePreference>(CHANGE_EVENT, {detail: value}));
        } else {
            const local = readExplicitPreference();
            if (local) saveToServer(local);
        }
    } catch (error) {
        console.error('Failed to load appearance preference from server:', error);
    }
}

export function ColorModeProvider({children}: {children: ReactNode}) {
    const [preference, setPreferenceState] = useState<ColorModePreference>(readStoredPreference);
    const [mode, setModeState] = useState<Md3Mode>(() => resolveMode(readStoredPreference()));
    const preferenceRef = useRef<ColorModePreference>(preference);

    const setPreference = useCallback((requested: ColorModePreference) => {
        const next = requested;
        preferenceRef.current = next;
        setPreferenceState(next);
        setModeState(resolveMode(next));
        persist(next);
        saveToServer(next);
        window.dispatchEvent(new CustomEvent<ColorModePreference>(CHANGE_EVENT, {detail: next}));
    }, []);

    // Adopt a pick made by another island (same document) or another tab.
    useEffect(() => {
        const adopt = (incoming: ColorModePreference) => {
            preferenceRef.current = incoming;
            setPreferenceState(incoming);
            setModeState(resolveMode(incoming));
        };
        const onChange = (e: Event) => {
            const next = (e as CustomEvent<unknown>).detail;
            if (isPreference(next)) adopt(next);
        };
        const onStorage = (e: StorageEvent) => {
            if (e.key === COLOR_MODE_STORAGE_KEY && isPreference(e.newValue)) adopt(e.newValue);
        };
        window.addEventListener(CHANGE_EVENT, onChange);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener(CHANGE_EVENT, onChange);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    useEffect(() => {
        if (canSyncWithServer()) void syncFromServerOnce();
    }, []);

    // Follow OS theme changes live while the preference is 'system'.
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mql = window.matchMedia(DARK_QUERY);
        const onChange = (e: MediaQueryListEvent) => {
            if (preferenceRef.current === 'system') setModeState(e.matches ? 'dark' : 'light');
        };
        mql.addEventListener?.('change', onChange);
        return () => mql.removeEventListener?.('change', onChange);
    }, []);

    // _Layout's pre-paint attribute pins the canvas dark with !important; it must follow the live mode.
    useEffect(() => {
        const root = document.documentElement;
        if (mode === 'dark') root.setAttribute('data-dd-boot-scheme', 'dark');
        else root.removeAttribute('data-dd-boot-scheme');
    }, [mode]);

    const value = useMemo(
        () => ({mode, preference, setPreference}),
        [mode, preference, setPreference],
    );
    return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
}
