/**
 * aiPreferenceStore tests.
 *
 * Two things carry real risk here: the resolution rules (a master switch that has
 * to beat everything, and a category added later that must not appear unannounced)
 * and the migration off the old opt-in flag, where getting it wrong silently
 * re-enables AI for someone who turned it off.
 */

import {
    AI_FEATURE_CATEGORIES,
    applyServerPreferences,
    configureAiPreferencePush,
    getAiPreferences,
    isAiFeatureEnabled,
    migrateLegacyPreferences,
    normalize,
    resetAiPreferencesForTest,
    setAiPreferences,
    subscribeToAiPreferences,
} from './aiPreferenceStore';
import {ContactID} from '../../contants';

describe('aiPreferenceStore', () => {
    beforeEach(() => {
        localStorage.clear();
        resetAiPreferencesForTest();
        jest.useRealTimers();
    });

    describe('defaults', () => {
        it('is on for everyone, in every category, before anyone touches it', () => {
            const preferences = getAiPreferences();

            expect(preferences.enabled).toBe(true);
            for (const category of AI_FEATURE_CATEGORIES) {
                expect(isAiFeatureEnabled(category, preferences)).toBe(true);
            }
        });

        it('has the briefing collapsed and the notice unseen', () => {
            expect(getAiPreferences().autoOpen).toBe(false);
            expect(getAiPreferences().noticeSeen).toBe(false);
        });
    });

    describe('resolution', () => {
        it('lets one category be turned off while the rest stay on', () => {
            setAiPreferences({categories: {pricing: false}});

            expect(isAiFeatureEnabled('pricing')).toBe(false);
            expect(isAiFeatureEnabled('briefings')).toBe(true);
        });

        it('master off beats every category being on', () => {
            setAiPreferences({enabled: false, categories: {}});

            for (const category of AI_FEATURE_CATEGORIES) {
                expect(isAiFeatureEnabled(category, getAiPreferences())).toBe(false);
            }
        });

        it('a category nobody has stored is on under an on master, off under an off one', () => {
            // The Firefox rule: a feature shipped later inherits the master rather
            // than appearing unannounced.
            const unknown = 'somethingShippedLater' as never;

            setAiPreferences({enabled: true});
            expect(isAiFeatureEnabled(unknown)).toBe(true);

            setAiPreferences({enabled: false});
            expect(isAiFeatureEnabled(unknown)).toBe(false);
        });
    });

    describe('normalize', () => {
        it('treats anything but an explicit false as on', () => {
            const preferences = normalize({categories: {pricing: undefined, briefings: false}});

            expect(preferences.enabled).toBe(true);
            expect(isAiFeatureEnabled('pricing', preferences)).toBe(true);
            expect(isAiFeatureEnabled('briefings', preferences)).toBe(false);
        });

        it('survives junk from storage or an older payload shape', () => {
            expect(normalize(null).enabled).toBe(true);
            expect(normalize('nonsense').enabled).toBe(true);
            expect(normalize({categories: {notACategory: false}}).categories).toEqual({});
        });
    });

    describe('migration off the old opt-in flag', () => {
        it('keeps an explicit opt-out switched off', () => {
            localStorage.setItem(`aiEnabled_${ContactID}`, 'false');

            expect(migrateLegacyPreferences().enabled).toBe(false);
        });

        it('switches on for someone who never touched the old flag', () => {
            expect(migrateLegacyPreferences().enabled).toBe(true);
        });

        it('switches on for someone who had opted in', () => {
            localStorage.setItem(`aiEnabled_${ContactID}`, 'true');

            expect(migrateLegacyPreferences().enabled).toBe(true);
        });

        it('carries the old auto-open choice across', () => {
            localStorage.setItem(`aiAutoOpen_${ContactID}`, 'true');

            expect(migrateLegacyPreferences().autoOpen).toBe(true);
        });
    });

    describe('server reconciliation', () => {
        it('a stored payload wins over whatever the migration decided', () => {
            localStorage.setItem(`aiEnabled_${ContactID}`, 'false');

            applyServerPreferences({enabled: true, categories: {writing: false}});

            expect(getAiPreferences().enabled).toBe(true);
            expect(isAiFeatureEnabled('writing')).toBe(false);
        });

        it('a null payload keeps the migrated state and writes it up', async () => {
            jest.useFakeTimers();
            localStorage.setItem(`aiEnabled_${ContactID}`, 'false');
            const push = jest.fn().mockResolvedValue(undefined);
            configureAiPreferencePush(push);

            applyServerPreferences(null);

            expect(getAiPreferences().enabled).toBe(false);
            jest.advanceTimersByTime(1000);
            expect(push).toHaveBeenCalledWith(expect.objectContaining({enabled: false}));
        });

        it('does not echo a server payload straight back to the server', () => {
            jest.useFakeTimers();
            const push = jest.fn().mockResolvedValue(undefined);
            configureAiPreferencePush(push);

            applyServerPreferences({enabled: true});

            jest.advanceTimersByTime(1000);
            expect(push).not.toHaveBeenCalled();
        });
    });

    describe('persistence', () => {
        it('debounces the push so a run of toggles is one write', () => {
            jest.useFakeTimers();
            const push = jest.fn().mockResolvedValue(undefined);
            configureAiPreferencePush(push);

            setAiPreferences({categories: {pricing: false}});
            setAiPreferences({categories: {pricing: false, writing: false}});
            setAiPreferences({enabled: false});

            jest.advanceTimersByTime(1000);
            expect(push).toHaveBeenCalledTimes(1);
            expect(push).toHaveBeenCalledWith(expect.objectContaining({enabled: false}));
        });

        it('caches to localStorage so the next page load has no flash of the wrong state', () => {
            setAiPreferences({enabled: false});
            resetAiPreferencesForTest();

            expect(getAiPreferences().enabled).toBe(false);
        });

        it('a failed push is swallowed rather than losing the toggle', () => {
            jest.useFakeTimers();
            configureAiPreferencePush(jest.fn().mockRejectedValue(new Error('offline')));

            setAiPreferences({enabled: false});
            jest.advanceTimersByTime(1000);

            expect(getAiPreferences().enabled).toBe(false);
        });
    });

    describe('subscribers', () => {
        it('notifies on change and stops after unsubscribe', () => {
            const listener = jest.fn();
            const unsubscribe = subscribeToAiPreferences(listener);

            setAiPreferences({enabled: false});
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe();
            setAiPreferences({enabled: true});
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });
});
