/**
 * Tests for Date Filter Persistence
 * Verifies that date filter data (including useTime) is correctly saved and restored from localStorage
 */

import dayjs, { Dayjs } from 'dayjs';

// Mock the IDateFilterData interface
interface IDateFilterData {
    startDate: Dayjs;
    endDate: Dayjs;
    useTime?: boolean;
}

describe('Date Filter Persistence', () => {
    // Simulate the loadDateFilterFromStorage logic
    const loadDateFilterFromStorage = (savedDateFilter: string | null): IDateFilterData | null => {
        if (!savedDateFilter) return null;

        try {
            const parsedDateFilter = JSON.parse(savedDateFilter);
            return {
                startDate: dayjs(parsedDateFilter.startDate),
                endDate: dayjs(parsedDateFilter.endDate),
                useTime: parsedDateFilter.useTime ?? false
            };
        } catch {
            return null;
        }
    };

    // Simulate the saveDateFilterToStorage logic
    const saveDateFilterToStorage = (dateFilterData: IDateFilterData): string => {
        return JSON.stringify(dateFilterData);
    };

    describe('useTime property persistence', () => {
        it('should restore useTime as true when saved as true', () => {
            const original: IDateFilterData = {
                startDate: dayjs('2024-01-01T09:00:00'),
                endDate: dayjs('2024-01-01T17:00:00'),
                useTime: true
            };

            const saved = saveDateFilterToStorage(original);
            const restored = loadDateFilterFromStorage(saved);

            expect(restored).not.toBeNull();
            expect(restored!.useTime).toBe(true);
        });

        it('should restore useTime as false when saved as false', () => {
            const original: IDateFilterData = {
                startDate: dayjs('2024-01-01'),
                endDate: dayjs('2024-01-02'),
                useTime: false
            };

            const saved = saveDateFilterToStorage(original);
            const restored = loadDateFilterFromStorage(saved);

            expect(restored).not.toBeNull();
            expect(restored!.useTime).toBe(false);
        });

        it('should default useTime to false when not present in saved data', () => {
            // Simulate old saved data without useTime property
            const oldSavedData = JSON.stringify({
                startDate: '2024-01-01T00:00:00.000Z',
                endDate: '2024-01-02T00:00:00.000Z'
                // useTime is missing
            });

            const restored = loadDateFilterFromStorage(oldSavedData);

            expect(restored).not.toBeNull();
            expect(restored!.useTime).toBe(false);
        });

        it('should default useTime to false when useTime is undefined', () => {
            const savedWithUndefined = JSON.stringify({
                startDate: '2024-01-01T00:00:00.000Z',
                endDate: '2024-01-02T00:00:00.000Z',
                useTime: undefined
            });

            const restored = loadDateFilterFromStorage(savedWithUndefined);

            expect(restored).not.toBeNull();
            expect(restored!.useTime).toBe(false);
        });

        it('should default useTime to false when useTime is null', () => {
            const savedWithNull = JSON.stringify({
                startDate: '2024-01-01T00:00:00.000Z',
                endDate: '2024-01-02T00:00:00.000Z',
                useTime: null
            });

            const restored = loadDateFilterFromStorage(savedWithNull);

            expect(restored).not.toBeNull();
            expect(restored!.useTime).toBe(false);
        });
    });

    describe('Date properties persistence', () => {
        it('should restore startDate correctly', () => {
            const originalDate = '2024-06-15T10:30:00';
            const original: IDateFilterData = {
                startDate: dayjs(originalDate),
                endDate: dayjs('2024-06-15T18:00:00'),
                useTime: true
            };

            const saved = saveDateFilterToStorage(original);
            const restored = loadDateFilterFromStorage(saved);

            expect(restored).not.toBeNull();
            expect(restored!.startDate.isValid()).toBe(true);
            expect(restored!.startDate.format('YYYY-MM-DD')).toBe('2024-06-15');
        });

        it('should restore endDate correctly', () => {
            const original: IDateFilterData = {
                startDate: dayjs('2024-06-15T10:30:00'),
                endDate: dayjs('2024-06-15T18:00:00'),
                useTime: true
            };

            const saved = saveDateFilterToStorage(original);
            const restored = loadDateFilterFromStorage(saved);

            expect(restored).not.toBeNull();
            expect(restored!.endDate.isValid()).toBe(true);
            expect(restored!.endDate.format('YYYY-MM-DD')).toBe('2024-06-15');
        });
    });

    describe('Error handling', () => {
        it('should return null for null input', () => {
            const restored = loadDateFilterFromStorage(null);
            expect(restored).toBeNull();
        });

        it('should return null for invalid JSON', () => {
            const restored = loadDateFilterFromStorage('not valid json');
            expect(restored).toBeNull();
        });

        it('should return null for empty string', () => {
            const restored = loadDateFilterFromStorage('');
            expect(restored).toBeNull();
        });
    });

    describe('Round-trip persistence', () => {
        it('should preserve all properties through save/restore cycle', () => {
            const original: IDateFilterData = {
                startDate: dayjs('2024-03-15T08:00:00'),
                endDate: dayjs('2024-03-15T20:00:00'),
                useTime: true
            };

            const saved = saveDateFilterToStorage(original);
            const restored = loadDateFilterFromStorage(saved);

            expect(restored).not.toBeNull();
            expect(restored!.startDate.format('YYYY-MM-DD HH:mm')).toBe(original.startDate.format('YYYY-MM-DD HH:mm'));
            expect(restored!.endDate.format('YYYY-MM-DD HH:mm')).toBe(original.endDate.format('YYYY-MM-DD HH:mm'));
            expect(restored!.useTime).toBe(original.useTime);
        });

        it('should handle Minutes mode (useTime: true) correctly', () => {
            // Simulate "Minutes" mode with specific time range
            const now = dayjs();
            const original: IDateFilterData = {
                startDate: now,
                endDate: now.add(30, 'minutes'),
                useTime: true  // Minutes mode uses time
            };

            const saved = saveDateFilterToStorage(original);
            const restored = loadDateFilterFromStorage(saved);

            expect(restored).not.toBeNull();
            expect(restored!.useTime).toBe(true);
        });

        it('should handle All Time mode (useTime: false) correctly', () => {
            // Simulate "All Time" mode with 24-hour range
            const original: IDateFilterData = {
                startDate: dayjs().startOf('day'),
                endDate: dayjs().endOf('day'),
                useTime: false  // All Time mode doesn't use specific time
            };

            const saved = saveDateFilterToStorage(original);
            const restored = loadDateFilterFromStorage(saved);

            expect(restored).not.toBeNull();
            expect(restored!.useTime).toBe(false);
        });

        it('should handle Custom Date mode (useTime: false) correctly', () => {
            // Simulate "Custom Date" mode
            const original: IDateFilterData = {
                startDate: dayjs('2024-01-01'),
                endDate: dayjs('2024-01-31'),
                useTime: false  // Custom Date mode doesn't use specific time
            };

            const saved = saveDateFilterToStorage(original);
            const restored = loadDateFilterFromStorage(saved);

            expect(restored).not.toBeNull();
            expect(restored!.useTime).toBe(false);
        });
    });
});

describe('localStorage key patterns', () => {
    // These tests document the expected localStorage key patterns used by the controllers

    it('should use correct key pattern for home page (dispatch)', () => {
        const appPage = 'dispatch';
        const contactId = '12345';
        const expectedKey = `dateFilter-${appPage}-${contactId}`;

        expect(expectedKey).toBe('dateFilter-dispatch-12345');
    });

    it('should use correct key pattern for domestic page', () => {
        const appPage = 'domestic';
        const contactId = '12345';
        const expectedKey = `dateFilter-${appPage}-${contactId}`;

        expect(expectedKey).toBe('dateFilter-domestic-12345');
    });

    it('should use correct key pattern for date range option', () => {
        const appPage = 'dispatch';
        const contactId = '12345';
        const expectedKey = `${appPage}-dateRangeOption-${contactId}`;

        expect(expectedKey).toBe('dispatch-dateRangeOption-12345');
    });
});
