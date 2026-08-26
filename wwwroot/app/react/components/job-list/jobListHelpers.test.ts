/**
 * The priority column's sort order is the same branch chain that picks the row's
 * marker, so these cases double as the drift guard for the icons themselves —
 * see `getPriorityIndicator` in JobListTable.tsx.
 */
import dayjs from 'dayjs';

import {JobStatus} from '../../../enums/job-status.enum';
import {createMockDispatchJob} from '../../__testUtils__/mockData';
import type {DispatchJob} from '../../interfaces/dispatchJob';
import {PRIORITY_ORDER, priorityKey, priorityRank} from './jobListHelpers';

const job = (overrides: Partial<DispatchJob>): DispatchJob => createMockDispatchJob({
    // A plain unassigned New job is "active"; every case below overrides its way out of that.
    statusId: JobStatus.New,
    booked: dayjs().add(8, 'hours'),
    ...overrides,
});

describe('priorityKey', () => {
    it('names the branch each job falls into, in the order the markers are shown', () => {
        expect(priorityKey(job({toAirportId: 12}))).toBe('flight');
        expect(priorityKey(job({fromAirportId: 12}))).toBe('flight');
        expect(priorityKey(job({vehicle: {id: 2, text: 'Chilled Van'}}))).toBe('chilled');
        expect(priorityKey(job({_groupChildren: [createMockDispatchJob({id: 2})]}))).toBe('multiPart');
        expect(priorityKey(job({isPartnerJob: true}))).toBe('partner');
        expect(priorityKey(job({statusId: JobStatus.LatePickup}))).toBe('latePickup');
        expect(priorityKey(job({statusId: JobStatus.LateDelivery}))).toBe('lateDelivery');
        expect(priorityKey(job({booked: dayjs().add(10, 'minutes')}))).toBe('urgent');
        expect(priorityKey(job({statusId: JobStatus.InTransit, assignedCourier: {id: 5, text: '5 - R'}}))).toBe('inTransit');
        expect(priorityKey(job({statusId: JobStatus.Completed}))).toBe('done');
        expect(priorityKey(job({}))).toBe('active');
        expect(priorityKey(job({statusId: JobStatus.Void}))).toBe('none');
    });

    it('keeps the job-type branches ahead of the status ones', () => {
        // A completed chilled job still shows (and sorts as) chilled.
        expect(priorityKey(job({vehicle: {id: 2, text: 'Frozen Truck'}, statusId: JobStatus.Completed}))).toBe('chilled');
        // A late flight leg is a flight leg first.
        expect(priorityKey(job({toAirportId: 12, statusId: JobStatus.LateDelivery}))).toBe('flight');
    });
});

describe('priorityRank', () => {
    it('ranks by position in PRIORITY_ORDER, lowest first', () => {
        expect(priorityRank(job({toAirportId: 12}))).toBe(PRIORITY_ORDER.indexOf('flight'));
        expect(priorityRank(job({statusId: JobStatus.Void}))).toBe(PRIORITY_ORDER.indexOf('none'));
        expect(priorityRank(job({toAirportId: 12}))).toBeLessThan(priorityRank(job({statusId: JobStatus.Completed})));
        expect(priorityRank(job({statusId: JobStatus.LatePickup})))
            .toBeLessThan(priorityRank(job({booked: dayjs().add(10, 'minutes')})));
    });

    it('gives an unmarked row the last rank so it sinks below every marker', () => {
        const ranks = PRIORITY_ORDER.map((_, index) => index);
        expect(priorityRank(job({statusId: JobStatus.Void}))).toBe(Math.max(...ranks));
    });
});
