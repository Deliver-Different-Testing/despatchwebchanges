/**
 * US States Utility Tests
 */

import {US_STATES, getStateByAbbreviation, getStateNameByAbbreviation} from './usStates';

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
});
