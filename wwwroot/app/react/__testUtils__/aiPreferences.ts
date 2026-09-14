/**
 * Auto-mate preference helpers for tests.
 *
 * Drives the real store rather than mocking a gate. The store is plain state on
 * `window`, so a test can set it directly — and doing so exercises the same
 * resolution rules the app uses, which a `jest.mock` of a boolean never would.
 */

import {
    AiFeatureCategory,
    resetAiPreferencesForTest,
    setAiPreferences,
} from '../services/aiPreferenceStore';

/** Back to the shipped defaults: Auto-mate on, every category on. */
export function resetAiPreferences(): void {
    localStorage.clear();
    resetAiPreferencesForTest();
}

/** Turns the master switch off, which turns every category off with it. */
export function disableAutoMate(): void {
    setAiPreferences({enabled: false}, {persist: false});
}

export function enableAutoMate(): void {
    setAiPreferences({enabled: true}, {persist: false});
}

/** Turns one category off while leaving the master and the others alone. */
export function disableAiCategory(category: AiFeatureCategory): void {
    setAiPreferences(
        {enabled: true, categories: {[category]: false}},
        {persist: false},
    );
}
