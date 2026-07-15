import {formatRefreshButtonLabel, formatUpdatedAgo, getRefreshIntervalOptions} from './refreshIntervalOptions';

describe('refreshIntervalOptions', () => {
    describe('getRefreshIntervalOptions', () => {
        const options = getRefreshIntervalOptions();

        it('starts with an Off option (0 seconds)', () => {
            expect(options[0]).toEqual({seconds: 0, label: 'Off'});
        });

        it('offers 30s → 15 min in 30s steps', () => {
            const intervals = options.slice(1).map(o => o.seconds);
            expect(intervals[0]).toBe(30);
            expect(intervals[intervals.length - 1]).toBe(15 * 60);
            // 30..900 in 30s steps = 30 options after Off
            expect(intervals).toHaveLength(30);
            expect(intervals.every((s, i) => s === (i + 1) * 30)).toBe(true);
        });

        it('labels sub-minute, whole-minute and mixed durations', () => {
            const bySeconds = new Map(options.map(o => [o.seconds, o.label]));
            expect(bySeconds.get(30)).toBe('30 seconds');
            expect(bySeconds.get(60)).toBe('1 min');
            expect(bySeconds.get(90)).toBe('1 min 30 seconds');
            expect(bySeconds.get(120)).toBe('2 mins');
        });
    });

    describe('formatRefreshButtonLabel', () => {
        it('shows "Auto-refresh" when off', () => {
            expect(formatRefreshButtonLabel(false)).toBe('Auto-refresh');
        });

        it('formats seconds, whole minutes and mixed intervals compactly', () => {
            expect(formatRefreshButtonLabel(30_000)).toBe('Auto: 30s');
            expect(formatRefreshButtonLabel(60_000)).toBe('Auto: 1m');
            expect(formatRefreshButtonLabel(90_000)).toBe('Auto: 1m 30s');
        });
    });

    describe('formatUpdatedAgo', () => {
        const now = 1_000_000_000_000;

        it('returns empty string before the first successful fetch', () => {
            expect(formatUpdatedAgo(0, now)).toBe('');
        });

        it('labels sub-5s as "just now" and clamps negatives', () => {
            expect(formatUpdatedAgo(now, now)).toBe('Updated just now');
            expect(formatUpdatedAgo(now + 5_000, now)).toBe('Updated just now');
        });

        it('scales through seconds, minutes and hours', () => {
            expect(formatUpdatedAgo(now - 12_000, now)).toBe('Updated 12s ago');
            expect(formatUpdatedAgo(now - 3 * 60_000, now)).toBe('Updated 3m ago');
            expect(formatUpdatedAgo(now - 2 * 3_600_000, now)).toBe('Updated 2h ago');
        });
    });
});
