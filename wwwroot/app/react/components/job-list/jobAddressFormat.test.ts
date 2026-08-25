/**
 * jobAddressFormat tests
 *
 * The grid and the panel compose the same address lines — the grid to display them,
 * the panel to sort by them — so the composition lives in one place and is proved here
 * rather than through either component.
 */

import type {DispatchJob} from '../../interfaces/dispatchJob';
import {createMockAddress} from '../../__testUtils__/mockData';
import {
    getDeliveryAddressNz,
    getDeliveryAddressUs,
    getDeliveryCityState,
    getPickupAddressNz,
    getPickupAddressUs,
    getPickupCityState,
} from './jobAddressFormat';

const address = createMockAddress({
    addressLine1: 'Acme Building',
    addressLine2: 'Unit 4',
    addressLine3: '15',
    addressLine4: 'Gilgit Road',
    addressLine5: 'Newmarket',
    addressLine6: 'Auckland',
    addressLine7: '1050',
    addressLine8: 'New Zealand',
});

function job(overrides: Partial<DispatchJob>): DispatchJob {
    return overrides as DispatchJob;
}

describe('jobAddressFormat', () => {
    it('composes the pickup lines and takes line 5 alone for the suburb-only column', () => {
        const withAddress = job({pickupAddress: address});

        expect(getPickupAddressUs(withAddress))
            .toBe('Unit 4, 15, Gilgit Road, Newmarket, Auckland, 1050, New Zealand');
        expect(getPickupAddressNz(withAddress)).toBe('Newmarket');
        expect(getPickupCityState(withAddress)).toBe('Acme Building');
    });

    it('composes the delivery lines, putting the suburb first for the NZ ordering', () => {
        const withAddress = job({deliveryAddress: address});

        expect(getDeliveryAddressUs(withAddress))
            .toBe('Unit 4, 15, Gilgit Road, Newmarket, New Zealand');
        expect(getDeliveryAddressNz(withAddress))
            .toBe('Newmarket, Unit 4, 15, Gilgit Road, New Zealand');
        expect(getDeliveryCityState(withAddress)).toBe('Acme Building');
    });

    it('skips blank and whitespace-only lines', () => {
        const sparse = job({
            pickupAddress: createMockAddress({
                addressLine2: '', addressLine3: '15', addressLine4: '   ',
                addressLine5: 'Newmarket', addressLine6: '', addressLine7: '', addressLine8: '',
            }),
        });

        expect(getPickupAddressUs(sparse)).toBe('15, Newmarket');
    });

    it('falls back to the free-text copy, re-spaced, when there are no address lines', () => {
        expect(getPickupAddressUs(job({from: '15,Gilgit Road,  Newmarket'})))
            .toBe('15, Gilgit Road, Newmarket');
        expect(getDeliveryAddressUs(job({toAddress: '79,St Georges Bay Road'})))
            .toBe('79, St Georges Bay Road');
        expect(getDeliveryAddressNz(job({toAddress: '79,St Georges Bay Road'})))
            .toBe('79, St Georges Bay Road');
    });

    it('returns an empty string when the job has neither copy', () => {
        expect(getPickupAddressUs(job({}))).toBe('');
        expect(getPickupAddressNz(job({}))).toBe('');
        expect(getPickupCityState(job({}))).toBe('');
        expect(getDeliveryAddressUs(job({}))).toBe('');
        expect(getDeliveryCityState(job({}))).toBe('');
    });
});
