import type {HereMapsAddress, HereMapsLookupResponse} from '../types';

export function formatHereStreetName(location: HereMapsLookupResponse): string {
    const si = location.streetInfo?.[0];
    if (!si) return location.address.street || '';

    let formatted = '';
    if (si.prefix) formatted += si.prefix + ' ';
    if (si.streetTypePrecedes && si.streetType) formatted += si.streetType + ' ';
    formatted += si.baseName;
    if (!si.streetTypePrecedes && si.streetType) formatted += ' ' + si.streetType;
    if (si.suffix) formatted += ' ' + si.suffix;
    return formatted.trim();
}

/**
 * Address lines 5-7 for a non-US tenant. AU keeps the state where NZ keeps the city, matching Booking;
 * HERE often gives no district for an AU suburb and puts it in city instead.
 */
export function hereNonUsLocalityLines(address: HereMapsAddress, isAu: boolean): [string, string, string] {
    return isAu
        ? [address.district || address.city || '', address.stateCode || address.state || '', address.postalCode || '']
        : [address.district || '', address.city || '', address.postalCode || ''];
}
