/** @jest-environment node */
/**
 * vendor-core dayjs plugin contract test.
 *
 * build.ts's createGlobalShimPlugin stubs every per-module `dayjs/plugin/*`
 * import to a no-op, so any library that extends a plugin from inside a bundled
 * module extends a no-op instead. The real plugin behaviour has to come from
 * vendor-core, which is why wwwroot/app/vendor-core-dayjs.ts exists.
 *
 * Both vendor-core (wwwroot/app/index.ts) and this test import that side-effect
 * module, so they share one source of truth. If a plugin stops being registered
 * there, this test fails.
 *
 * The contract used to be expressed through @mui/x-date-pickers' AdapterDayjs.
 * That package has no app consumers and is gone, so the plugins are now pinned
 * against their real consumers:
 *
 *   utc, timezone      — the wall-clock date path (utils/dateUtils.ts, ~33 `.tz()` sites)
 *   isoWeek            — @mantine/dates (the only dayjs plugin it imports)
 *   customParseFormat  — explicit-format parsing (e.g. OpenJobsWidget's `dayjs(t, 'HH:mm')`)
 *
 * The remaining five (localizedFormat, weekday, advancedFormat, isBetween,
 * weekOfYear) have no proven call site today but stay registered: dayjs plugins
 * are routinely consumed transitively by locale data and library internals, and
 * a missing one fails silently rather than loudly. The last block below asserts
 * they are extended, so removing one is a deliberate act with a failing test,
 * not an accident.
 */

import dayjs from 'dayjs';
import '../vendor-core-dayjs';

describe('vendor-core dayjs plugins', () => {
    describe('required by app code and @mantine/dates', () => {
        it('utc + timezone: resolves a wall-clock time in a named zone', () => {
            const inZone = dayjs('2025-03-15T12:00:00Z').tz('Pacific/Auckland');
            expect(inZone.isValid()).toBe(true);
            expect(inZone.format('YYYY-MM-DD HH:mm')).toBe('2025-03-16 01:00');
            expect(dayjs.utc('2025-03-15T12:00:00').format('HH:mm')).toBe('12:00');
        });

        it('isoWeek: @mantine/dates week starts resolve to a Monday', () => {
            const monday = dayjs('2025-03-15').startOf('isoWeek');
            expect(monday.format('YYYY-MM-DD')).toBe('2025-03-10');
            expect(monday.day()).toBe(1);
        });

        it('customParseFormat: parses an explicit format without falling back to Date', () => {
            const parsed = dayjs('16:30', 'HH:mm');
            expect(parsed.isValid()).toBe(true);
            expect(parsed.hour()).toBe(16);
            expect(parsed.minute()).toBe(30);

            const dmy = dayjs('15/03/2025', 'DD/MM/YYYY');
            expect(dmy.isValid()).toBe(true);
            expect(dmy.date()).toBe(15);
            expect(dmy.month()).toBe(2); // March is index 2
            expect(dmy.year()).toBe(2025);
        });
    });

    describe('registered without a proven consumer (removal must be deliberate)', () => {
        it('advancedFormat: ordinal and zone tokens format', () => {
            expect(dayjs('2025-03-15').format('Do MMM YYYY')).toContain('15th');
        });

        it('localizedFormat: L / LT tokens are not emitted literally', () => {
            expect(dayjs('2025-03-15T16:30:00').format('L')).not.toBe('L');
            expect(dayjs('2025-03-15T16:30:00').format('LT')).not.toBe('LT');
        });

        it('weekday: locale-aware weekday index is available', () => {
            expect(typeof dayjs('2025-03-15').weekday()).toBe('number');
        });

        it('isBetween: bounds are inclusive with "[]"', () => {
            const start = dayjs('2025-03-01');
            const end = dayjs('2025-03-31');
            expect(dayjs('2025-03-15').isBetween(start, end, null, '[]')).toBe(true);
            expect(dayjs('2025-04-15').isBetween(start, end, null, '[]')).toBe(false);
        });

        it('weekOfYear: week() returns a finite week number', () => {
            const week = dayjs('2025-03-15').week();
            expect(Number.isFinite(week)).toBe(true);
            expect(week).toBeGreaterThanOrEqual(1);
            expect(week).toBeLessThanOrEqual(53);
        });
    });
});
