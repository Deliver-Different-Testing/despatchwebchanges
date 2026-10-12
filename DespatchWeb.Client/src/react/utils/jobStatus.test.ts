import {JobStatus} from '../../enums/job-status.enum';
import {resolvedStatusId, resolvedStatusLabel, resolvedStatusTone} from './jobStatus';

describe('jobStatus', () => {
    describe('resolvedStatusId', () => {
        it('trusts the server rather than re-deriving from the raw fields', () => {
            expect(resolvedStatusId({statusId: JobStatus.New, resolvedStatusId: JobStatus.Void})).toBe(JobStatus.Void);
        });

        it('falls back to the raw status, and to New when there is none', () => {
            expect(resolvedStatusId({statusId: JobStatus.InTransit})).toBe(JobStatus.InTransit);
            expect(resolvedStatusId({})).toBe(JobStatus.New);
        });
    });

    describe('resolvedStatusLabel', () => {
        it("keeps the tenant's own status name when the resolved status matches the raw one", () => {
            expect(
                resolvedStatusLabel({
                    statusId: JobStatus.InTransit,
                    statusName: 'On the road',
                    resolvedStatusId: JobStatus.InTransit,
                }),
            ).toBe('On the road');
        });

        it('names the resolved status when it overrides the raw one', () => {
            expect(
                resolvedStatusLabel({
                    statusId: JobStatus.New,
                    statusName: 'New',
                    resolvedStatusId: JobStatus.Void,
                }),
            ).toBe('Void');
        });
    });

    describe('resolvedStatusTone', () => {
        it.each([
            [JobStatus.Void, 'void'],
            [JobStatus.Completed, 'done'],
            [JobStatus.Undeliverable, 'done'],
            [JobStatus.InTransit, 'dispatched'],
            [JobStatus.Dispatched, 'dispatched'],
            [JobStatus.New, 'pending'],
        ])('tones %s as %s', (statusId, expected) => {
            expect(resolvedStatusTone({resolvedStatusId: statusId})).toBe(expected);
        });

        it('cannot contradict the label, because both read the same resolved status', () => {
            const voidedButStillMarkedNew = {
                statusId: JobStatus.New,
                statusName: 'New',
                resolvedStatusId: JobStatus.Void,
            };

            expect(resolvedStatusLabel(voidedButStillMarkedNew)).toBe('Void');
            expect(resolvedStatusTone(voidedButStillMarkedNew)).toBe('void');
        });
    });
});
