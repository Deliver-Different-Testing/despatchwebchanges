import type {DispatchJob} from '../../../interfaces/dispatchJob';
import {computeMapJobs, selectedCourierId} from './mapJobs';

const job = (over: Partial<DispatchJob> = {}): DispatchJob => ({
    id: 1,
    jobNo: 'J1',
    statusId: 0,
    ...over,
} as DispatchJob);

describe('selectedCourierId', () => {
    it('is undefined for no job', () => {
        expect(selectedCourierId(undefined)).toBeUndefined();
    });

    it('is undefined for an unassigned job', () => {
        expect(selectedCourierId(job())).toBeUndefined();
    });

    it('prefers courierData.courierId', () => {
        expect(selectedCourierId(job({
            courierData: {courierId: 42} as DispatchJob['courierData'],
            assignedCourier: {id: 99, text: 'C'} as DispatchJob['assignedCourier'],
        }))).toBe(42);
    });

    it('falls back to assignedCourier.id', () => {
        expect(selectedCourierId(job({
            assignedCourier: {id: 99, text: 'C'} as DispatchJob['assignedCourier'],
        }))).toBe(99);
    });
});

describe('computeMapJobs', () => {
    const all = [job({id: 1}), job({id: 2}), job({id: 3})];

    it('returns all loaded jobs when nothing is selected', () => {
        expect(computeMapJobs({allJobs: all})).toBe(all);
    });

    it('returns only the selected job when it has no courier', () => {
        const current = job({id: 2});
        expect(computeMapJobs({currentJob: current, allJobs: all})).toEqual([current]);
    });

    it('returns the courier’s undispatched jobs for a dispatched selection', () => {
        const current = job({id: 2, statusId: 3, courierData: {courierId: 7} as DispatchJob['courierData']});
        const courierJobs = [
            job({id: 10, statusId: 0}),
            job({id: 11, statusId: 5}), // already dispatched — excluded
            job({id: 12, statusId: 0}),
        ];
        expect(computeMapJobs({currentJob: current, allJobs: all, courierJobs}))
            .toEqual([courierJobs[0], courierJobs[2]]);
    });

    it('falls back to the selected job when the courier has no undispatched jobs', () => {
        const current = job({id: 2, statusId: 3, courierData: {courierId: 7} as DispatchJob['courierData']});
        expect(computeMapJobs({currentJob: current, allJobs: all, courierJobs: [job({id: 11, statusId: 5})]}))
            .toEqual([current]);
    });

    it('falls back to the selected job when courier jobs have not loaded', () => {
        const current = job({id: 2, statusId: 3, courierData: {courierId: 7} as DispatchJob['courierData']});
        expect(computeMapJobs({currentJob: current, allJobs: all})).toEqual([current]);
    });
});
