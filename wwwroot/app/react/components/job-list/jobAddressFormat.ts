/**
 * Job address composition
 *
 * A job carries its addresses twice: the structured lines (`pickupAddress`/`deliveryAddress`)
 * and the free-text copy (`from`/`toAddress`). Both the grid, which displays them, and the
 * panel, which sorts by them, compose the same line selections, so the selections live here.
 */

import type {AddressViewModel} from '../../interfaces/address';
import type {DispatchJob} from '../../interfaces/dispatchJob';

type PickLines = (address: AddressViewModel) => Array<string | undefined>;

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
