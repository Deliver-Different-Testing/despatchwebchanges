/**
 * Job address composition
 *
 * A job carries its addresses twice: the structured lines (`pickupAddress`/`deliveryAddress`)
 * and the free-text copy (`from`/`toAddress`). Both the grid, which displays them, and the
 * panel, which sorts by them, compose the same line selections, so the selections live here.
 */

import type {AddressFieldKey, AddressFormatSides, AddressLineFormat, AddressViewModel} from '../../interfaces/address';
import type {DispatchJob} from '../../interfaces/dispatchJob';

export type {AddressFieldKey, AddressFormatSides, AddressLineFormat};

type PickLines = (address: AddressViewModel) => Array<string | undefined>;

const ADDRESS_FIELD_LINE: Record<AddressFieldKey, keyof AddressViewModel> = {
    building: 'addressLine1',
    unit: 'addressLine2',
    streetNumber: 'addressLine3',
    streetName: 'addressLine4',
    cityOrSuburb: 'addressLine5',
    stateOrCity: 'addressLine6',
    postcode: 'addressLine7',
    country: 'addressLine8',
};

/** Every configurable field, in a sensible default order, for the field-order builder UI. */
export const ADDRESS_FIELD_OPTIONS: {key: AddressFieldKey; label: string}[] = [
    {key: 'building', label: 'Company / Building'},
    {key: 'unit', label: 'Unit / Suite'},
    {key: 'streetNumber', label: 'Street Number'},
    {key: 'streetName', label: 'Street Name'},
    {key: 'cityOrSuburb', label: 'City / Suburb'},
    {key: 'stateOrCity', label: 'State / City'},
    {key: 'postcode', label: 'Postcode'},
    {key: 'country', label: 'Country'},
];

const ADDRESS_FIELD_KEYS = new Set(ADDRESS_FIELD_OPTIONS.map((o) => o.key));

function isAddressFieldKey(value: unknown): value is AddressFieldKey {
    return typeof value === 'string' && ADDRESS_FIELD_KEYS.has(value as AddressFieldKey);
}

function toFieldArray(value: unknown): AddressFieldKey[] {
    return Array.isArray(value) ? value.filter(isAddressFieldKey) : [];
}

function parseLineFormat(value: unknown): AddressLineFormat | null {
    if (!value || typeof value !== 'object') return null;
    const {line1, line2} = value as {line1?: unknown; line2?: unknown};
    return {line1: toFieldArray(line1), line2: toFieldArray(line2)};
}

/**
 * Parses the per-side `{"pickup":{"line1":[...],"line2":[...]},"delivery":{...}}`
 * preference/setting shape, tolerating null/malformed JSON. Also tolerates the
 * older single-list `{"fields":[...]}` shape (pre pickup/delivery split) by
 * applying those fields to line 1 of both sides.
 */
export function parseAddressFormatJson(json: string | null | undefined): AddressFormatSides {
    if (!json) return {pickup: null, delivery: null};
    try {
        const parsed = JSON.parse(json) as {fields?: unknown; pickup?: unknown; delivery?: unknown};
        if (Array.isArray(parsed?.fields)) {
            const legacyFields = toFieldArray(parsed.fields);
            const legacy: AddressLineFormat = {line1: legacyFields, line2: []};
            return legacyFields.length ? {pickup: legacy, delivery: legacy} : {pickup: null, delivery: null};
        }
        return {pickup: parseLineFormat(parsed?.pickup), delivery: parseLineFormat(parsed?.delivery)};
    } catch {
        return {pickup: null, delivery: null};
    }
}

export function serializeAddressFormatJson(sides: AddressFormatSides): string {
    return JSON.stringify(sides);
}

/** Included fields from both lines, in display order — for sorting, where the line split doesn't matter. */
export function flattenLineFormat(format: AddressLineFormat | null | undefined): AddressFieldKey[] {
    return format ? [...format.line1, ...format.line2] : [];
}

export function formatAddressWithFields(
    address: AddressViewModel | undefined,
    fields: AddressFieldKey[],
    fallback: string | undefined,
): string {
    return formatAddressOrFallback(
        address,
        (a) => fields.map((field) => a[ADDRESS_FIELD_LINE[field]] as string | undefined),
        fallback,
    );
}

/** Line 1 carries the fallback text; line 2 is custom fields only, so the fallback never shows twice. */
export function formatAddressLines(
    address: AddressViewModel | undefined,
    format: AddressLineFormat | null | undefined,
    fallback: string | undefined,
): [string, string] {
    if (!format) return [formatAddressWithFields(address, [], fallback), ''];
    return [
        formatAddressWithFields(address, format.line1, fallback),
        formatAddressWithFields(address, format.line2, undefined),
    ];
}

export function formatAddressOrFallback(
    address: AddressViewModel | undefined,
    pickLines: PickLines,
    fallback: string | undefined,
): string {
    if (address) {
        return pickLines(address).filter((l): l is string => Boolean(l && l.trim())).join(', ');
    }
    return (fallback || '').split(',').map((l) => l.trim()).join(', ');
}

// Pickup — NZ shows the suburb alone; US shows lines 2-8.
export function getPickupAddressNz(job: DispatchJob): string {
    return job.pickupAddress?.addressLine5 || '';
}

export function getPickupAddressUs(job: DispatchJob): string {
    return formatAddressOrFallback(
        job.pickupAddress,
        (a) => [a.addressLine2, a.addressLine3, a.addressLine4, a.addressLine5, a.addressLine6, a.addressLine7, a.addressLine8],
        job.from,
    );
}

export function getPickupCityState(job: DispatchJob): string {
    return job.pickupAddress?.addressLine1 || '';
}

// Delivery — NZ leads with the suburb; US keeps the line order. Both drop lines 6 and 7.
export function getDeliveryAddressNz(job: DispatchJob): string {
    return formatAddressOrFallback(
        job.deliveryAddress,
        (a) => [a.addressLine5, a.addressLine2, a.addressLine3, a.addressLine4, a.addressLine8],
        job.toAddress,
    );
}

export function getDeliveryAddressUs(job: DispatchJob): string {
    return formatAddressOrFallback(
        job.deliveryAddress,
        (a) => [a.addressLine2, a.addressLine3, a.addressLine4, a.addressLine5, a.addressLine8],
        job.toAddress,
    );
}

export function getDeliveryCityState(job: DispatchJob): string {
    return job.deliveryAddress?.addressLine1 || '';
}
