/**
 * jobAddressFormat tests
 *
 * The grid and the panel compose the same address lines — the grid to display them,
 * the panel to sort by them — so the composition lives in one place and is proved here
 * rather than through either component.
 */

import type {DispatchJob} from '../../interfaces/dispatchJob';
import type {AddressFormatSides} from '../../interfaces/address';
import {createMockAddress} from '../../__testUtils__/mockData';
import {
    flattenLineFormat,
    formatAddressLines,
    formatAddressWithFields,
    getDeliveryAddressNz,
    getDeliveryAddressUs,
    getDeliveryCityState,
    getPickupAddressNz,
    getPickupAddressUs,
    getPickupCityState,
    parseAddressFormatJson,
    serializeAddressFormatJson,
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

    describe('formatAddressWithFields', () => {
        it('joins the selected fields in the order given', () => {
            expect(formatAddressWithFields(address, ['streetNumber', 'streetName', 'cityOrSuburb', 'postcode'], undefined))
                .toBe('15, Gilgit Road, Newmarket, 1050');
        });

        it('supports any order, not just line order', () => {
            expect(formatAddressWithFields(address, ['cityOrSuburb', 'streetName', 'streetNumber'], undefined))
                .toBe('Newmarket, Gilgit Road, 15');
        });

        it('maps every field key to its address line', () => {
            expect(formatAddressWithFields(
                address,
                ['building', 'unit', 'streetNumber', 'streetName', 'cityOrSuburb', 'stateOrCity', 'postcode', 'country'],
                undefined,
            )).toBe('Acme Building, Unit 4, 15, Gilgit Road, Newmarket, Auckland, 1050, New Zealand');
        });

        it('skips blank fields and an empty field list', () => {
            expect(formatAddressWithFields(address, [], undefined)).toBe('');
            expect(formatAddressWithFields(
                createMockAddress({addressLine6: '', addressLine7: '1050'}),
                ['stateOrCity', 'postcode'],
                undefined,
            )).toBe('1050');
        });

        it('falls back to the free-text copy when there is no structured address', () => {
            expect(formatAddressWithFields(undefined, ['streetName'], '15,Gilgit Road,  Newmarket'))
                .toBe('15, Gilgit Road, Newmarket');
        });
    });

    describe('formatAddressLines', () => {
        it('splits fields across the two lines, with the fallback only on line 1', () => {
            const [line1, line2] = formatAddressLines(
                address,
                {line1: ['streetNumber', 'streetName'], line2: ['cityOrSuburb', 'postcode']},
                undefined,
            );
            expect(line1).toBe('15, Gilgit Road');
            expect(line2).toBe('Newmarket, 1050');
        });

        it('leaves line 2 empty when no fields are assigned to it', () => {
            const [, line2] = formatAddressLines(address, {line1: ['streetName'], line2: []}, undefined);
            expect(line2).toBe('');
        });

        it('falls back to the free-text copy on line 1 only, when there is no structured address', () => {
            const [line1, line2] = formatAddressLines(
                undefined,
                {line1: ['streetName'], line2: ['postcode']},
                '15,Gilgit Road,  Newmarket',
            );
            expect(line1).toBe('15, Gilgit Road, Newmarket');
            expect(line2).toBe('');
        });

        it('treats a null format as nothing configured', () => {
            expect(formatAddressLines(undefined, null, '15,Gilgit Road')).toEqual(['15, Gilgit Road', '']);
        });
    });

    describe('flattenLineFormat', () => {
        it('concatenates line 1 then line 2', () => {
            expect(flattenLineFormat({line1: ['streetNumber', 'streetName'], line2: ['postcode']}))
                .toEqual(['streetNumber', 'streetName', 'postcode']);
        });

        it('returns an empty array for a null/undefined format', () => {
            expect(flattenLineFormat(null)).toEqual([]);
            expect(flattenLineFormat(undefined)).toEqual([]);
        });
    });

    describe('serializeAddressFormatJson / parseAddressFormatJson', () => {
        it('round-trips both sides', () => {
            const sides: AddressFormatSides = {
                pickup: {line1: ['streetNumber', 'streetName'], line2: ['postcode']},
                delivery: {line1: ['cityOrSuburb'], line2: []},
            };
            expect(parseAddressFormatJson(serializeAddressFormatJson(sides))).toEqual(sides);
        });

        it('returns both sides null for null, undefined, or malformed JSON', () => {
            expect(parseAddressFormatJson(null)).toEqual({pickup: null, delivery: null});
            expect(parseAddressFormatJson(undefined)).toEqual({pickup: null, delivery: null});
            expect(parseAddressFormatJson('not json')).toEqual({pickup: null, delivery: null});
            expect(parseAddressFormatJson('{}')).toEqual({pickup: null, delivery: null});
        });

        it('drops unrecognised field keys rather than propagating corrupt data', () => {
            expect(parseAddressFormatJson('{"pickup":{"line1":["streetName","bogus",42],"line2":[]},"delivery":null}'))
                .toEqual({pickup: {line1: ['streetName'], line2: []}, delivery: null});
        });

        it('maps the legacy single-list shape onto line 1 of both sides', () => {
            expect(parseAddressFormatJson('{"fields":["streetName","postcode"]}')).toEqual({
                pickup: {line1: ['streetName', 'postcode'], line2: []},
                delivery: {line1: ['streetName', 'postcode'], line2: []},
            });
        });

        it('treats an empty legacy field list as unconfigured', () => {
            expect(parseAddressFormatJson('{"fields":[]}')).toEqual({pickup: null, delivery: null});
        });
    });
});
