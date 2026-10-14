/**
 * Auto-refresh cadence options for the Nationwide page.
 *
 * Framework-free so the AngularJS controller and the React page share it.
 * Extracted from `initRefreshIntervalOptions` (2003), `formatDuration` (2023)
 * and the resolution half of `loadSavedRefreshInterval` (739).
 */

export interface RefreshIntervalOption {
    id: number;
    text: string;
}

/** Cadence of 0 means "off". */
export const DISABLED_INTERVAL: RefreshIntervalOption = {id: 0, text: 'Disabled'};

/** Longest offered cadence: 15 minutes. */
export const MAX_REFRESH_SECONDS = 15 * 60;

/** Gap between offered cadences. */
export const REFRESH_STEP_SECONDS = 30;

/**
 * A cadence as `"30 seconds"` / `"1 min"` / `"2 mins"` / `"2 mins 30 seconds"`.
 *
 * Singular only at exactly one minute.
 */
export function formatIntervalDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
        return `${seconds} seconds`;
    }

    const minText = minutes === 1 ? 'min' : 'mins';

    if (remainingSeconds === 0) {
        return `${minutes} ${minText}`;
    }
    return `${minutes} ${minText} ${remainingSeconds} seconds`;
}

/** Disabled, then every 30 seconds up to 15 minutes. */
export function buildRefreshIntervalOptions(): RefreshIntervalOption[] {
    const options: RefreshIntervalOption[] = [DISABLED_INTERVAL];

    for (let seconds = REFRESH_STEP_SECONDS; seconds <= MAX_REFRESH_SECONDS; seconds += REFRESH_STEP_SECONDS) {
        options.push({id: seconds, text: formatIntervalDuration(seconds)});
    }

    return options;
}

/**
 * The option a stored cadence id refers to.
 *
 * `undefined` means "no usable stored preference" — either nothing was stored,
 * or the stored id no longer matches an offered option (a cadence saved before
 * the option list changed). V1 left the selection unset and started no timer in
 * that case, which callers should preserve. Unparseable input falls back to
 * {@link DISABLED_INTERVAL}, matching V1's `parseInt(...) || 0`.
 */
export function resolveSavedInterval(
    stored: string | null | undefined,
    options: RefreshIntervalOption[],
): RefreshIntervalOption | undefined {
    if (!stored) return undefined;

    const id = parseInt(stored, 10) || 0;
    return options.find(option => option.id === id);
}
