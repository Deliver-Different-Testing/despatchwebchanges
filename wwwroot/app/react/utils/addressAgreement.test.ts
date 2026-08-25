/**
 * addressAgreement tests
 *
 * A job carries its delivery address twice: the free-text copy the driver app and
 * tracking page read, and the structured address lines dispatch composes. An edit
 * that only lands on one of them leaves dispatch routing to the wrong place, so the
 * pane needs to be able to spot the two describing different destinations.
 */

import {addressesDisagree, STALE_ADDRESS_DETAIL, STALE_ADDRESS_LEAD, staleAddressSummary} from './addressAgreement';
import {STALE_ADDRESS_DEVICE, STALE_ADDRESS_LINES} from '../__testUtils__/mockData';

describe('addressesDisagree', () => {
    it('flags a job whose free-text address moved but whose address lines did not', () => {
        expect(addressesDisagree(STALE_ADDRESS_DEVICE, STALE_ADDRESS_LINES)).toBe(true);
    });

    it('does not flag the same job before the edit', () => {
        expect(addressesDisagree('ALLEVIA HOSPITAL EPSOM, 15-17 Gilgit Road', STALE_ADDRESS_LINES)).toBe(false);
    });

    it('does not flag a terse free-text address against a richer set of lines', () => {
        expect(addressesDisagree(
            '79 St Georges Bay Road',
            'ALLEVIA HOSPITAL CSSD, 79, St Georges Bay Road, Parnell, Auckland, 1052, New Zealand',
        )).toBe(false);
    });

    it('ignores street-type wording, punctuation and casing', () => {
        expect(addressesDisagree('123 Queen St', '123 Queen Street, Auckland')).toBe(false);
        expect(addressesDisagree('123 QUEEN ST.', '123, Queen Street, Auckland, 1010')).toBe(false);
    });

    it('does not flag when either address is missing or too short to compare', () => {
        expect(addressesDisagree(undefined, STALE_ADDRESS_LINES)).toBe(false);
        expect(addressesDisagree(STALE_ADDRESS_DEVICE, '')).toBe(false);
        expect(addressesDisagree('  ', STALE_ADDRESS_LINES)).toBe(false);
        expect(addressesDisagree('Airport', STALE_ADDRESS_LINES)).toBe(false);
    });
});

describe('staleAddressSummary', () => {
    it('joins the shared lead, the device address and the shared detail into one line', () => {
        expect(staleAddressSummary(STALE_ADDRESS_DEVICE))
            .toBe(`${STALE_ADDRESS_LEAD} ${STALE_ADDRESS_DEVICE}. ${STALE_ADDRESS_DETAIL}`);
    });
});
