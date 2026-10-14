/** @jest-environment node */
/**
 * Extracted from `NationwideControl`'s `STATUS_TO_LIST_MAP` (306) and the
 * refresh-set derivation inside `handleStatusChange` (897).
 */

import {JobDataType} from './jobDataType';
import {listsAffectedByStatusChange, listsForStatus} from './statusListMap';

describe('listsForStatus', () => {
    it.each([
        [1, [JobDataType.NEW]],
        [3, [JobDataType.POD]],
        [4, [JobDataType.REPRICE]],
    ])('maps status %i to %s', (status, expected) => {
        expect(listsForStatus(status)).toEqual(expected);
    });

    it('returns nothing for a status that feeds no list', () => {
        // Statuses 0, 2, 5, 6... are not on this page's three lists.
        expect(listsForStatus(2)).toEqual([]);
        expect(listsForStatus(99)).toEqual([]);
        expect(listsForStatus(undefined as never)).toEqual([]);
    });
});

describe('listsAffectedByStatusChange', () => {
    it('refreshes both the list the job left and the one it joined', () => {
        expect(listsAffectedByStatusChange(1, 3))
            .toEqual([JobDataType.NEW, JobDataType.POD]);
    });

    it('de-duplicates when both statuses map to the same list', () => {
        expect(listsAffectedByStatusChange(1, 1)).toEqual([JobDataType.NEW]);
    });

    it('handles a move from an untracked status into a tracked one', () => {
        expect(listsAffectedByStatusChange(2, 4)).toEqual([JobDataType.REPRICE]);
    });

    it('handles a move out of a tracked status into an untracked one', () => {
        expect(listsAffectedByStatusChange(3, 6)).toEqual([JobDataType.POD]);
    });

    it('returns an empty list when neither status is tracked', () => {
        // Nothing to refresh -- the caller should skip the round-trip entirely.
        expect(listsAffectedByStatusChange(2, 6)).toEqual([]);
    });
});
