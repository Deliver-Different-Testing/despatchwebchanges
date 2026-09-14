/**
 * The single question every AI surface asks: "should I render?"
 *
 * This replaces the three idioms that grew up around `isAiEnabled()` — a
 * component-level early return, a parent-level `&&`, and `AiDraftButton`'s own
 * self-gate — so a new AI feature has one obvious way to be switchable and the
 * answer updates live rather than at mount.
 */

import {useSyncExternalStore} from 'react';
import {
    AiFeatureCategory,
    AiPreferences,
    getAiPreferences,
    isAiFeatureEnabled,
    subscribeToAiPreferences,
} from '../services/aiPreferenceStore';

/** Every island shares the `window` state, so a change in one re-renders them all. */
export function useAiPreferences(): AiPreferences {
    return useSyncExternalStore(subscribeToAiPreferences, getAiPreferences, getAiPreferences);
}

/** True when the master switch and this feature's own category are both on. */
export function useAiFeature(category: AiFeatureCategory): boolean {
    const preferences = useAiPreferences();
    return isAiFeatureEnabled(category, preferences);
}

/** The master switch alone — for chrome that is about Auto-mate itself. */
export function useAutoMateEnabled(): boolean {
    return useAiPreferences().enabled;
}

/** Whether the briefing should open expanded. Meaningless while briefings are off. */
export function useAiAutoOpen(): boolean {
    const preferences = useAiPreferences();
    return isAiFeatureEnabled('briefings', preferences) && preferences.autoOpen;
}
