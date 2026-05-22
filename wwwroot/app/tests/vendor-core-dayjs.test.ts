/**
 * vendor-core dayjs plugin contract test.
 *
 * @mui/x-date-pickers AdapterDayjs (node_modules/@mui/x-date-pickers/AdapterDayjs/AdapterDayjs.js
 * lines 10-28) extends several dayjs plugins on module load. build.ts's
 * createGlobalShimPlugin stubs every per-module `dayjs/plugin/*` import to a
 * no-op, so those extends become extensions of a no-op when AdapterDayjs runs
 * in a bundled module. The real plugin behaviour has to come from vendor-core.
 *
 * Both vendor-core (wwwroot/app/index.ts) and this test import the side-effect
 * module wwwroot/app/vendor-core-dayjs.ts, so they share one source of truth.
 * If a future MUI X upgrade adds a required plugin and it isn't registered
 * there, this test fails.
 */

// Force Jest to load the real AdapterDayjs instead of the lightweight mock that
// jest.config.js moduleNameMapper routes @mui/x-date-pickers/AdapterDayjs to.
// Pattern lifted from EditDateTimeDialog.realpicker.test.tsx:15-20.
jest.mock('./mocks/muiDatePickerMocks', () => ({
    ...require('../../../node_modules/@mui/x-date-pickers/AdapterDayjs'),
}));

import dayjs from 'dayjs';
import '../vendor-core-dayjs';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';

describe('vendor-core dayjs plugins required by AdapterDayjs', () => {
    it('customParseFormat: parses DD/MM/YYYY (the format used by DateFilterMenu/EditDateTimeDialog)', () => {
        const adapter = new AdapterDayjs();
        const parsed = adapter.parse('15/03/2025', 'DD/MM/YYYY');
        expect(parsed).not.toBeNull();
        expect(parsed!.isValid()).toBe(true);
        expect(parsed!.date()).toBe(15);
        expect(parsed!.month()).toBe(2); // March is index 2
        expect(parsed!.year()).toBe(2025);
    });

    it('advancedFormat: formats ordinal day tokens without throwing', () => {
        const adapter = new AdapterDayjs();
        const formatted = adapter.format(dayjs('2025-03-15'), 'keyboardDate');
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);
        // Direct dayjs.format with an advancedFormat-only token must also work.
        expect(() => dayjs('2025-03-15').format('Do MMM YYYY')).not.toThrow();
        expect(dayjs('2025-03-15').format('Do MMM YYYY')).toContain('15th');
    });

    it('isBetween: returns true for a date inside a range', () => {
        const start = dayjs('2025-03-01');
        const end = dayjs('2025-03-31');
        const inside = dayjs('2025-03-15');
        const outside = dayjs('2025-04-15');
        expect(inside.isBetween(start, end, null, '[]')).toBe(true);
        expect(outside.isBetween(start, end, null, '[]')).toBe(false);
    });

    it('weekOfYear: dayjs().week() returns a finite week number', () => {
        const week = dayjs('2025-03-15').week();
        expect(typeof week).toBe('number');
        expect(Number.isFinite(week)).toBe(true);
        expect(week).toBeGreaterThanOrEqual(1);
        expect(week).toBeLessThanOrEqual(53);
    });

    it('AdapterDayjs constructs without throwing (catches a missing plugin import)', () => {
        expect(() => new AdapterDayjs()).not.toThrow();
    });
});
