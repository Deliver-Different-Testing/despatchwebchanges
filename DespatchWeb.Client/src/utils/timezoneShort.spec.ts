import {timezoneShort} from './timezoneShort';

describe('timezoneShort', () => {
    it('returns an empty string for missing input', () => {
        expect(timezoneShort('')).toBe('');
        expect(timezoneShort(undefined as unknown as string)).toBe('');
    });

    it('returns no label for New Zealand timezones', () => {
        expect(timezoneShort('Pacific/Auckland')).toBe('');
        expect(timezoneShort('New Zealand Standard Time')).toBe('');
    });

    it('returns a bracketed abbreviation for other timezones', () => {
        expect(timezoneShort('America/Los_Angeles')).toMatch(/^\((PST|PDT)\)$/);
    });
});
