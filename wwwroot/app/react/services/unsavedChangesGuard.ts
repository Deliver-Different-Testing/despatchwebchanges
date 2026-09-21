/**
 * Cross-boundary "leave without saving?" guard.
 *
 * Bridges the AngularJS ui-router transition hook (app.ts, `$transitions.onBefore`
 * — same hook `dashboardRouteGuard` uses) to whichever React page currently has
 * unsaved edits. A page registers itself on mount and unregisters on unmount, so
 * this is a single-slot registry: only one page can hold the guard at a time.
 */

export type LeaveDecision = 'save-and-leave' | 'discard' | 'stay';

export interface UnsavedChangesGuard {
    isDirty: () => boolean;
    /** Opens the page's own confirmation UI and resolves with the user's choice. */
    promptToLeave: () => Promise<LeaveDecision>;
    save: () => Promise<void>;
}

let activeGuard: UnsavedChangesGuard | null = null;

/** Call on mount; call the returned function on unmount. */
export function registerUnsavedChangesGuard(guard: UnsavedChangesGuard): () => void {
    activeGuard = guard;
    return () => {
        if (activeGuard === guard) activeGuard = null;
    };
}

/** Called by the ui-router transition hook before every state change. */
export async function confirmNavigationAllowed(): Promise<boolean> {
    const guard = activeGuard;
    if (!guard?.isDirty()) return true;

    const decision = await guard.promptToLeave();
    if (decision === 'stay') return false;
    if (decision === 'save-and-leave') await guard.save();
    return true;
}
