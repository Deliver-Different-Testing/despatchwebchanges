import {momentFormatFilter} from './filters';

describe('momentFormatFilter', () => {
    it('formats a date using the US month-first pattern', () => {
        expect(momentFormatFilter('2024-01-15T14:30:00', 'MMM/DD/YYYY h:mm A')).toBe('Jan/15/2024 2:30 PM');
    });

    it('formats a date using the NZ day-first 24-hour pattern', () => {
        expect(momentFormatFilter('2024-01-15T14:30:00', 'DD/MMM/YYYY HH:mm')).toBe('15/Jan/2024 14:30');
    });

    it('returns an empty string for missing input', () => {
        expect(momentFormatFilter('', 'DD/MMM/YYYY HH:mm')).toBe('');
        expect(momentFormatFilter(null as unknown as string, 'DD/MMM/YYYY HH:mm')).toBe('');
        expect(momentFormatFilter(undefined as unknown as string, 'DD/MMM/YYYY HH:mm')).toBe('');
    });
});
