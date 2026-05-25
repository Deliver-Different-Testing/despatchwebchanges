/** @jest-environment jest-environment-jsdom */
/**
 * Tests for the formatChangeRequestValue helper. Covers the per-category
 * rendering branches and the Packages JSON summariser added when parcel
 * edits started routing through the inter-tenant change-request flow.
 */

import {
    datetimeFieldSide,
    formatAddressLines,
    formatChangeRequestValue,
    formatChangeRequestValueWithTz,
    formatRequestedAtTooltip,
    getFieldMeta,
} from './jobChangeRequestFormatting';

describe('formatChangeRequestValue — Packages', () => {
    beforeEach(() => {
        // Default to non-US so the formatter shows kg; tests that need lbs set
        // window.serverConfig directly.
        (window as unknown as {serverConfig?: {isUSCustomer: boolean}}).serverConfig = {isUSCustomer: false};
    });

    it('classifies Packages as the packages category', () => {
        expect(getFieldMeta('Packages').category).toBe('packages');
    });

    it('shows "N parcels · X kg" for a non-US tenant', () => {
        const payload = JSON.stringify({
            parcels: [
                {itemName: 'Box', weight: 5},
                {itemName: 'Box', weight: 5},
                {itemName: 'Pallet', weight: 15},
            ],
            weight: 25,
        });
        expect(formatChangeRequestValue('Packages', payload)).toBe('3 parcels · 25 kg');
    });

    it('uses lbs when the tenant is a US customer', () => {
        (window as unknown as {serverConfig?: {isUSCustomer: boolean}}).serverConfig = {isUSCustomer: true};
        const payload = JSON.stringify({
            parcels: [{itemName: 'Box', weight: 12}],
            weight: 12,
        });
        expect(formatChangeRequestValue('Packages', payload)).toBe('1 parcel · 12 lbs');
    });

    it('pluralises a single parcel correctly', () => {
        const payload = JSON.stringify({
            parcels: [{itemName: 'Box', weight: 3}],
            weight: 3,
        });
        expect(formatChangeRequestValue('Packages', payload)).toBe('1 parcel · 3 kg');
    });

    it('omits the weight clause when weight is missing', () => {
        const payload = JSON.stringify({parcels: [{itemName: 'Box'}, {itemName: 'Box'}]});
        expect(formatChangeRequestValue('Packages', payload)).toBe('2 parcels');
    });

    it('omits the weight clause when weight is zero', () => {
        const payload = JSON.stringify({parcels: [{itemName: 'Box'}], weight: 0});
        expect(formatChangeRequestValue('Packages', payload)).toBe('1 parcel');
    });

    it('falls back to the raw value when the JSON is malformed', () => {
        expect(formatChangeRequestValue('Packages', 'not-json')).toBe('not-json');
    });

    it('returns the em-dash placeholder for empty values', () => {
        expect(formatChangeRequestValue('Packages', '')).toBe('—');
        expect(formatChangeRequestValue('Packages', null)).toBe('—');
        expect(formatChangeRequestValue('Packages', undefined)).toBe('—');
    });
});

describe('formatAddressLines', () => {
    it('returns the addressLine1..8 slots when populated, ignoring blanks', () => {
        const payload = JSON.stringify({
            addressLine1: '12 King St',
            addressLine2: '',
            addressLine3: 'Auckland Central',
            addressLine4: 'Auckland 1010',
            addressLine7: 'NZ',
        });
        expect(formatAddressLines(payload)).toEqual([
            '12 King St',
            'Auckland Central',
            'Auckland 1010',
            'NZ',
        ]);
    });

    it('falls back to splitting fullAddress when no per-line slots exist', () => {
        const payload = JSON.stringify({fullAddress: '12 King St, Auckland 1010, NZ'});
        expect(formatAddressLines(payload)).toEqual(['12 King St', 'Auckland 1010', 'NZ']);
    });

    it('returns the raw value as a single line when JSON parsing fails', () => {
        expect(formatAddressLines('not-json')).toEqual(['not-json']);
    });

    it('returns an empty array for empty input', () => {
        expect(formatAddressLines('')).toEqual([]);
        expect(formatAddressLines(null)).toEqual([]);
        expect(formatAddressLines(undefined)).toEqual([]);
    });
});

describe('datetimeFieldSide', () => {
    it('maps DeliverBy to the delivery side', () => {
        expect(datetimeFieldSide('DeliverBy')).toBe('delivery');
    });

    it('maps every other datetime field to the pickup side', () => {
        expect(datetimeFieldSide('PuTime')).toBe('pickup');
        expect(datetimeFieldSide('BookedTime')).toBe('pickup');
        expect(datetimeFieldSide('Date')).toBe('pickup');
        expect(datetimeFieldSide('Time')).toBe('pickup');
    });
});

describe('formatChangeRequestValueWithTz', () => {
    // ICU short timezone names follow DST: "Pacific Standard Time" emits "PDT"
    // in March and "PST" in January. We only assert the abbreviation slot is
    // populated, not which spelling ICU picked.
    it('appends a pacific-side timezone abbreviation for datetime fields', () => {
        const iso = '2025-03-15T14:30:00+13:00';
        const out = formatChangeRequestValueWithTz('PuTime', iso, 'Pacific Standard Time');
        expect(out).toMatch(/\(P[SD]T\)$/);
    });

    it('appends an eastern-side timezone abbreviation when the tz text says so', () => {
        const iso = '2025-03-15T14:30:00+13:00';
        const out = formatChangeRequestValueWithTz('DeliverBy', iso, 'Eastern Standard Time');
        expect(out).toMatch(/\(E[SD]T\)$/);
    });

    it('falls back to the tenant timezone when no timezone text is supplied', () => {
        const iso = '2025-03-15T14:30:00+13:00';
        // setup.ts assigns window.TimeZone = 'Europe/London'. ICU returns
        // "GMT", "BST", or "GMT+1" depending on the runtime — just require a
        // parenthesised abbreviation at the end.
        const out = formatChangeRequestValueWithTz('PuTime', iso);
        expect(out).toMatch(/\([^)]+\)$/);
    });

    it('passes non-datetime categories through unchanged from formatChangeRequestValue', () => {
        expect(formatChangeRequestValueWithTz('PartnerAgreedRate', '42.5'))
            .toBe(formatChangeRequestValue('PartnerAgreedRate', '42.5'));
    });

    it('returns the em-dash placeholder for empty values', () => {
        expect(formatChangeRequestValueWithTz('PuTime', '')).toBe('—');
        expect(formatChangeRequestValueWithTz('PuTime', null)).toBe('—');
    });
});

describe('formatRequestedAtTooltip', () => {
    it('renders the ISO timestamp with the tenant timezone abbreviation slot populated', () => {
        const out = formatRequestedAtTooltip('2025-03-15T14:30:00+13:00');
        expect(out).toMatch(/\([^)]+\)$/);
    });

    it('returns the raw input when the timestamp is unparseable', () => {
        expect(formatRequestedAtTooltip('not-a-date')).toBe('not-a-date');
    });
});
