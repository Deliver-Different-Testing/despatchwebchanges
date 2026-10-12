/** @jest-environment node */
/**
 * Extracted from `NationwideControl.initRefreshIntervalOptions` (2003),
 * `formatDuration` (2023) and `loadSavedRefreshInterval` (739).
 */

import {
    DISABLED_INTERVAL,
    MAX_REFRESH_SECONDS,
    buildRefreshIntervalOptions,
    formatIntervalDuration,
    resolveSavedInterval,
} from './refreshInterval';

describe('formatIntervalDuration', () => {
    it.each([
        [30, '30 seconds'],
        [59, '59 seconds'],
        [60, '1 min'],
        [90, '1 min 30 seconds'],
        [120, '2 mins'],
        [150, '2 mins 30 seconds'],
        [600, '10 mins'],
        [900, '15 mins'],
    ])('formats %i seconds as "%s"', (seconds, expected) => {
        expect(formatIntervalDuration(seconds)).toBe(expected);
    });

    it('singularises only at exactly one minute', () => {
        expect(formatIntervalDuration(60)).toBe('1 min');
        expect(formatIntervalDuration(90)).toBe('1 min 30 seconds');
        expect(formatIntervalDuration(120)).toBe('2 mins');
    });
});

describe('buildRefreshIntervalOptions', () => {
    const options = buildRefreshIntervalOptions();

    it('leads with the Disabled option at id 0', () => {
        expect(options[0]).toEqual({id: 0, text: 'Disabled'});
        expect(DISABLED_INTERVAL).toEqual({id: 0, text: 'Disabled'});
    });

    it('steps every 30 seconds up to 15 minutes', () => {
        const ids = options.slice(1).map(o => o.id);
        expect(ids[0]).toBe(30);
        expect(ids[ids.length - 1]).toBe(MAX_REFRESH_SECONDS);
        expect(MAX_REFRESH_SECONDS).toBe(900);
        expect(ids).toHaveLength(30);
        expect(ids.every((id, i) => id === (i + 1) * 30)).toBe(true);
    });

    it('labels each option with its formatted duration', () => {
        expect(options.find(o => o.id === 60)?.text).toBe('1 min');
        expect(options.find(o => o.id === 150)?.text).toBe('2 mins 30 seconds');
    });
});

describe('resolveSavedInterval', () => {
    const options = buildRefreshIntervalOptions();

    it('resolves a stored id to its option', () => {
        expect(resolveSavedInterval('60', options)).toEqual({id: 60, text: '1 min'});
    });

    it('treats a missing value as no stored preference', () => {
        expect(resolveSavedInterval(null, options)).toBeUndefined();
        expect(resolveSavedInterval('', options)).toBeUndefined();
    });

    it('falls back to Disabled for unparseable input, matching V1', () => {
        // V1 did `parseInt(...) || 0`, so garbage became id 0.
        expect(resolveSavedInterval('not-a-number', options)).toEqual(DISABLED_INTERVAL);
    });

    it('returns undefined when the stored id matches no option', () => {
        // e.g. a cadence saved before the option list changed. V1 left
        // `selectedRefreshInterval` undefined here and started no timer.
        expect(resolveSavedInterval('45', options)).toBeUndefined();
    });

    it('resolves the explicit Disabled selection', () => {
        expect(resolveSavedInterval('0', options)).toEqual(DISABLED_INTERVAL);
    });
});
