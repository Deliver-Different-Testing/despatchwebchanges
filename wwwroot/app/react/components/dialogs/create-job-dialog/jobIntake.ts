/**
 * Helpers for turning an Auto-mate booking extraction into Create Job form input.
 *
 * The dialog's two address fields are HERE autocomplete pickers, and the job needs
 * the lat/long that only a picked HERE result carries. So an extracted address is
 * not written into the form as a value — it is typed into the search box for the
 * operator to pick the match, which keeps the geocode honest.
 */

import {AiIntakeAddress} from '../../../interfaces/ai';

/**
 * The street-level parts of an extracted address, as one line for the geocoder.
 *
 * Line 1 (company) and line 8 (access notes — "rear entrance", a door code) are
 * deliberately left out: neither helps HERE find the place and both routinely
 * stop it finding anything at all.
 */
export function intakeAddressToSearchText(address: AiIntakeAddress | null | undefined): string {
    if (!address) return '';

    const street = [address.addressLine3, address.addressLine4].filter(Boolean).join(' ').trim();
    const region = [address.addressLine6, address.addressLine7].filter(Boolean).join(' ').trim();

    return [street, address.addressLine5, region]
        .map(part => (part ?? '').trim())
        .filter(Boolean)
        .join(', ');
}

/** Whether an extraction gave us anything at all worth writing into the form. */
export function hasAnythingToFill(address: AiIntakeAddress | null | undefined): boolean {
    return intakeAddressToSearchText(address).length > 0;
}
