/**
 * aiPreferenceSync tests.
 *
 * The migration path is what carries risk: a user who never touched the old
 * opt-in flag should come out with Auto-mate on, a user who turned it off should
 * stay off *and* have that written up so the next machine agrees.
 */

import {startAiPreferenceSync, resetAiPreferenceSyncForTest} from './aiPreferenceSync';
import {getPreference, savePreference} from './userPreferenceApi';
import {getAiPreferences, isAiFeatureEnabled, resetAiPreferencesForTest} from './aiPreferenceStore';
import {ContactID} from '../../contants';

jest.mock('./userPreferenceApi', () => ({
    PREFERENCE_KEYS: {autoMate: 'AutoMate'},
    getPreference: jest.fn(),
    savePreference: jest.fn(),
}));

const mockGet = getPreference as jest.MockedFunction<typeof getPreference>;
const mockSave = savePreference as jest.MockedFunction<typeof savePreference>;

const stored = (value: unknown) =>
    ({key: 'AutoMate', preferenceJson: value === null ? null : JSON.stringify(value)});

describe('startAiPreferenceSync', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
        localStorage.clear();
        resetAiPreferencesForTest();
        resetAiPreferenceSyncForTest();
        mockSave.mockResolvedValue(undefined);
    });

    it('applies what the server holds', async () => {
        mockGet.mockResolvedValue(stored({enabled: true, categories: {writing: false}}));

        await startAiPreferenceSync();

        expect(isAiFeatureEnabled('writing')).toBe(false);
        expect(isAiFeatureEnabled('pricing')).toBe(true);
    });

    it('switches a never-configured user on and writes that up', async () => {
        jest.useFakeTimers();
        mockGet.mockResolvedValue(stored(null));

        await startAiPreferenceSync();

        expect(getAiPreferences().enabled).toBe(true);
        jest.advanceTimersByTime(1000);
        expect(mockSave).toHaveBeenCalledWith('AutoMate', expect.stringContaining('"enabled":true'));
    });

    it('keeps a user who explicitly opted out switched off, and records it', async () => {
        jest.useFakeTimers();
        localStorage.setItem(`aiEnabled_${ContactID}`, 'false');
        mockGet.mockResolvedValue(stored(null));

        await startAiPreferenceSync();

        expect(getAiPreferences().enabled).toBe(false);
        jest.advanceTimersByTime(1000);
        expect(mockSave).toHaveBeenCalledWith('AutoMate', expect.stringContaining('"enabled":false'));
    });

    it('leaves the cached preferences in place when the server cannot be reached', async () => {
        localStorage.setItem(`aiEnabled_${ContactID}`, 'false');
        mockGet.mockRejectedValue(new Error('offline'));

        await startAiPreferenceSync();

        expect(getAiPreferences().enabled).toBe(false);
    });

    it('pulls once even if the shell remounts on a route change', async () => {
        mockGet.mockResolvedValue(stored({enabled: true}));

        await startAiPreferenceSync();
        await startAiPreferenceSync();

        expect(mockGet).toHaveBeenCalledTimes(1);
    });
});
