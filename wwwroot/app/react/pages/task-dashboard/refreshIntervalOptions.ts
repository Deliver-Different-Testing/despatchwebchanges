/**
 * Auto-refresh interval options for the Task Dashboard.
 *
 * Mirrors the dispatch page's `getMinsSelectionOptions` (30s start, 30s steps,
 * up to 15 min) so the two pages offer the same cadences. Intervals are stored
 * in localStorage as seconds (0 = off) and applied as a React Query
 * `refetchInterval` in milliseconds (`false` = off).
 */

export interface RefreshIntervalOption {
    /** 0 = off; otherwise the interval in seconds. */
    seconds: number;
    /** Long label for the menu (e.g. "30 seconds", "1 min", "2 mins 30 seconds"). */
    label: string;
}

function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes === 0) {
        return `${seconds} seconds`;
    }
    if (remainingSeconds === 0) {
        return minutes === 1 ? '1 min' : `${minutes} mins`;
    }
    const minText = minutes === 1 ? 'min' : 'mins';
    return `${minutes} ${minText} ${remainingSeconds} seconds`;
}

/** Off + 30s → 15 min in 30s steps. */
export function getRefreshIntervalOptions(): RefreshIntervalOption[] {
    const options: RefreshIntervalOption[] = [{seconds: 0, label: 'Off'}];
    const maxSeconds = 15 * 60;
    for (let seconds = 30; seconds <= maxSeconds; seconds += 30) {
        options.push({seconds, label: formatDuration(seconds)});
    }
    return options;
}

/**
 * Freshness label for the toolbar (e.g. "Updated just now", "Updated 12s ago",
 * "Updated 3m ago"). `updatedAt`/`now` are epoch ms; returns '' when there is
 * no successful fetch yet (`updatedAt` falsy).
 */
export function formatUpdatedAgo(updatedAt: number, now: number): string {
    if (!updatedAt) return '';
    const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
    if (seconds < 5) return 'Updated just now';
    if (seconds < 60) return `Updated ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Updated ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `Updated ${hours}h ago`;
}

/** Compact label for the toolbar button (e.g. "Auto-refresh", "Auto: 30s", "Auto: 1m"). */
export function formatRefreshButtonLabel(refetchIntervalMs: number | false): string {
    if (!refetchIntervalMs) return 'Auto-refresh';
    const seconds = Math.round(refetchIntervalMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes === 0) return `Auto: ${seconds}s`;
    if (remainingSeconds === 0) return `Auto: ${minutes}m`;
    return `Auto: ${minutes}m ${remainingSeconds}s`;
}
