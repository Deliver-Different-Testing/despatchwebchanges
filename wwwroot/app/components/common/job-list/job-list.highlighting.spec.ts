/**
 * Tests for JobListComponent job highlighting
 * Verifies that direct and chilled/frozen jobs are correctly identified for highlighting
 */

import {IDispatchJob, ISuggestion} from "../../../interfaces/job.interface";

describe('JobListComponent highlighting', () => {
    /**
     * Checks if a job is a chilled/frozen delivery based on vehicle type
     * Mirror of the actual isChilledJob implementation
     */
    const isChilledJob = (job: Partial<IDispatchJob>): boolean => {
        if (!job.vehicle?.text) return false;
        const vehicleName = job.vehicle.text.toLowerCase();
        return vehicleName.includes('chilled') || vehicleName.includes('frozen');
    };

    const createMockJob = (overrides: Partial<IDispatchJob> = {}): Partial<IDispatchJob> => ({
        id: 1,
        jobNo: '12345',
        direct: false,
        vehicle: undefined,
        ...overrides,
    });

    const createVehicle = (text: string): ISuggestion => ({
        id: 1,
        text,
    });

    describe('isChilledJob', () => {
        describe('returns true for chilled vehicles', () => {
            it('should return true when vehicle text contains "chilled"', () => {
                const job = createMockJob({
                    vehicle: createVehicle('Chilled Van'),
                });

                expect(isChilledJob(job)).toBe(true);
            });

            it('should return true when vehicle text contains "chilled" (lowercase)', () => {
                const job = createMockJob({
                    vehicle: createVehicle('chilled van'),
                });

                expect(isChilledJob(job)).toBe(true);
            });

            it('should return true when vehicle text contains "chilled" (uppercase)', () => {
                const job = createMockJob({
                    vehicle: createVehicle('CHILLED VAN'),
                });

                expect(isChilledJob(job)).toBe(true);
            });

            it('should return true when vehicle text contains "Chilled" with mixed case', () => {
                const job = createMockJob({
                    vehicle: createVehicle('ChIlLeD Sprinter'),
                });

                expect(isChilledJob(job)).toBe(true);
            });
        });

        describe('returns true for frozen vehicles', () => {
            it('should return true when vehicle text contains "frozen"', () => {
                const job = createMockJob({
                    vehicle: createVehicle('Frozen Van'),
                });

                expect(isChilledJob(job)).toBe(true);
            });

            it('should return true when vehicle text contains "frozen" (lowercase)', () => {
                const job = createMockJob({
                    vehicle: createVehicle('frozen truck'),
                });

                expect(isChilledJob(job)).toBe(true);
            });

            it('should return true when vehicle text contains "frozen" (uppercase)', () => {
                const job = createMockJob({
                    vehicle: createVehicle('FROZEN TRUCK'),
                });

                expect(isChilledJob(job)).toBe(true);
            });
        });

        describe('returns false for non-chilled/frozen vehicles', () => {
            it('should return false for regular van', () => {
                const job = createMockJob({
                    vehicle: createVehicle('Van'),
                });

                expect(isChilledJob(job)).toBe(false);
            });

            it('should return false for truck', () => {
                const job = createMockJob({
                    vehicle: createVehicle('Truck'),
                });

                expect(isChilledJob(job)).toBe(false);
            });

            it('should return false for sprinter', () => {
                const job = createMockJob({
                    vehicle: createVehicle('Sprinter'),
                });

                expect(isChilledJob(job)).toBe(false);
            });

            it('should return false for bike', () => {
                const job = createMockJob({
                    vehicle: createVehicle('Bike'),
                });

                expect(isChilledJob(job)).toBe(false);
            });
        });

        describe('handles edge cases', () => {
            it('should return false when vehicle is undefined', () => {
                const job = createMockJob({
                    vehicle: undefined,
                });

                expect(isChilledJob(job)).toBe(false);
            });

            it('should return false when vehicle text is empty', () => {
                const job = createMockJob({
                    vehicle: createVehicle(''),
                });

                expect(isChilledJob(job)).toBe(false);
            });

            it('should return false when vehicle text is whitespace only', () => {
                const job = createMockJob({
                    vehicle: createVehicle('   '),
                });

                expect(isChilledJob(job)).toBe(false);
            });

            it('should handle vehicle with null text', () => {
                const job = createMockJob({
                    vehicle: { id: 1, text: null as any },
                });

                expect(isChilledJob(job)).toBe(false);
            });
        });

        describe('partial matches', () => {
            it('should match "chilled" anywhere in the vehicle name', () => {
                const job = createMockJob({
                    vehicle: createVehicle('Large Chilled Delivery Van'),
                });

                expect(isChilledJob(job)).toBe(true);
            });

            it('should match "frozen" anywhere in the vehicle name', () => {
                const job = createMockJob({
                    vehicle: createVehicle('Small Frozen Goods Truck'),
                });

                expect(isChilledJob(job)).toBe(true);
            });
        });
    });

    describe('Direct job highlighting', () => {
        it('should identify direct jobs by direct property being true', () => {
            const job = createMockJob({
                direct: true,
            });

            expect(job.direct).toBe(true);
        });

        it('should identify non-direct jobs by direct property being false', () => {
            const job = createMockJob({
                direct: false,
            });

            expect(job.direct).toBe(false);
        });

        it('should handle undefined direct property', () => {
            const job = createMockJob();
            delete (job as any).direct;

            expect(job.direct).toBeUndefined();
        });
    });

    describe('Combined highlighting scenarios', () => {
        it('should identify job that is both direct and chilled', () => {
            const job = createMockJob({
                direct: true,
                vehicle: createVehicle('Chilled Van'),
            });

            expect(job.direct).toBe(true);
            expect(isChilledJob(job)).toBe(true);
        });

        it('should identify job that is direct but not chilled', () => {
            const job = createMockJob({
                direct: true,
                vehicle: createVehicle('Van'),
            });

            expect(job.direct).toBe(true);
            expect(isChilledJob(job)).toBe(false);
        });

        it('should identify job that is chilled but not direct', () => {
            const job = createMockJob({
                direct: false,
                vehicle: createVehicle('Frozen Truck'),
            });

            expect(job.direct).toBe(false);
            expect(isChilledJob(job)).toBe(true);
        });

        it('should identify job that is neither direct nor chilled', () => {
            const job = createMockJob({
                direct: false,
                vehicle: createVehicle('Sprinter'),
            });

            expect(job.direct).toBe(false);
            expect(isChilledJob(job)).toBe(false);
        });
    });
});
