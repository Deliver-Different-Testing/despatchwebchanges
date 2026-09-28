/** @jest-environment node */
/**
 * US States Utility Tests
 */

import {
    US_STATES,
    getStateByAbbreviation,
    getStateNameByAbbreviation,
    normalizeToStateAbbreviation,
} from './usStates';

describe('usStates', () => {
    describe('US_STATES', () => {
        it('should contain all 50 states', () => {
            expect(US_STATES).toHaveLength(50);
        });

        it('should have unique abbreviations', () => {
            const abbreviations = US_STATES.map(s => s.abbreviation);
            expect(new Set(abbreviations).size).toBe(50);
        });

        it('should have unique names', () => {
            const names = US_STATES.map(s => s.name);
            expect(new Set(names).size).toBe(50);
        });

        it('should have 2-letter abbreviations', () => {
            US_STATES.forEach(s => {
                expect(s.abbreviation).toMatch(/^[A-Z]{2}$/);
            });
        });
    });

    describe('getStateByAbbreviation', () => {
        it('should return state for valid abbreviation', () => {
            expect(getStateByAbbreviation('CA')).toEqual({abbreviation: 'CA', name: 'California'});
        });

        it('should return state for NY', () => {
            expect(getStateByAbbreviation('NY')).toEqual({abbreviation: 'NY', name: 'New York'});
        });

        it('should return undefined for invalid abbreviation', () => {
            expect(getStateByAbbreviation('XX')).toBeUndefined();
        });

        it('should return undefined for empty string', () => {
            expect(getStateByAbbreviation('')).toBeUndefined();
        });

        it('should be case-sensitive (lowercase returns undefined)', () => {
            expect(getStateByAbbreviation('ca')).toBeUndefined();
        });
    });

    describe('getStateNameByAbbreviation', () => {
        it('should return full name for valid abbreviation', () => {
            expect(getStateNameByAbbreviation('TX')).toBe('Texas');
        });

        it('should return the abbreviation itself when not found', () => {
            expect(getStateNameByAbbreviation('XX')).toBe('XX');
        });

        it('should return empty string for empty input', () => {
            expect(getStateNameByAbbreviation('')).toBe('');
        });
    });

    describe('normalizeToStateAbbreviation', () => {
        it('returns the abbreviation unchanged for an exact abbreviation', () => {
            expect(normalizeToStateAbbreviation('NY')).toBe('NY');
        });

        it('uppercases a lowercase abbreviation', () => {
            expect(normalizeToStateAbbreviation('ca')).toBe('CA');
        });

        it('converts a full state name to its abbreviation', () => {
            expect(normalizeToStateAbbreviation('New York')).toBe('NY');
        });

        it('matches full state names case-insensitively', () => {
            expect(normalizeToStateAbbreviation('new york')).toBe('NY');
            expect(normalizeToStateAbbreviation('CALIFORNIA')).toBe('CA');
        });

        it('handles multi-word state names', () => {
            expect(normalizeToStateAbbreviation('North Carolina')).toBe('NC');
            expect(normalizeToStateAbbreviation('West Virginia')).toBe('WV');
        });

        it('trims surrounding whitespace', () => {
            expect(normalizeToStateAbbreviation('  NY  ')).toBe('NY');
            expect(normalizeToStateAbbreviation('  New York  ')).toBe('NY');
        });

        it('returns empty string for unknown values', () => {
            expect(normalizeToStateAbbreviation('XX')).toBe('');
            expect(normalizeToStateAbbreviation('Auckland')).toBe('');
        });

        it('returns empty string for empty / null / undefined input', () => {
            expect(normalizeToStateAbbreviation('')).toBe('');
            expect(normalizeToStateAbbreviation('   ')).toBe('');
            expect(normalizeToStateAbbreviation(null)).toBe('');
            expect(normalizeToStateAbbreviation(undefined)).toBe('');
        });
    });
});
