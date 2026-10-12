/**
 * A job stores its addresses twice: the free-text copy (`fromAddress`/`toAddress`,
 * i.e. ucjbFromAddr/ucjbToAddr) that the driver app, tracking page and delivery
 * journey read, and the structured address lines that dispatch, the grid, the map
 * and rating compose. Upstream edits that only land on the free-text copy leave
 * dispatch looking at the previous destination while the driver has the new one.
 *
 * These helpers spot that divergence so the UI can say so instead of quietly
 * showing a stale address.
 */

/** Street-type and filler words carry no identity, so they never count as evidence either way. */
const IGNORED_WORDS = new Set([
    'st', 'street', 'rd', 'road', 'ave', 'avenue', 'dr', 'drive', 'ln', 'lane',
    'hwy', 'highway', 'pl', 'place', 'way', 'ct', 'court', 'cres', 'crescent',
    'tce', 'terrace', 'blvd', 'boulevard', 'pde', 'parade', 'qy', 'quay',
    'unit', 'level', 'suite', 'floor', 'gate', 'door', 'the', 'and',
    'new', 'zealand', 'nz', 'united', 'states', 'usa', 'australia',
]);

/**
 * Lower-cased identity words. Numbers are kept whatever their length — a street
 * number or postcode is exactly the sort of difference worth noticing — while
 * short alphabetic fragments are dropped as noise.
 */
export function addressTokens(address?: string | null): string[] {
    if (!address) return [];

    return address
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(token => token.length > 0)
        .filter(token => /[0-9]/.test(token) || token.length >= 3)
        .filter(token => !IGNORED_WORDS.has(token));
}

/** Share of `tokens` that `other` never mentions. */
function missingShare(tokens: string[], other: string[]): number {
    if (tokens.length === 0) return 0;

    const present = new Set(other);

    return tokens.filter(token => !present.has(token)).length / tokens.length;
}

/**
 * True when the two copies of an address describe different places.
 *
 * Both directions have to disagree before this fires: a free-text address is often
 * a legitimately terser or richer rendering of the same place, and a false alarm on
 * a dispatch screen is worse than a missed one. Requiring each side to be mostly
 * absent from the other means only a wholesale change trips it.
 */
export function addressesDisagree(deviceAddress?: string | null, composedAddress?: string | null): boolean {
    const device = addressTokens(deviceAddress);
    const composed = addressTokens(composedAddress);

    if (device.length < 2 || composed.length < 2) return false;

    return missingShare(device, composed) > 0.5 && missingShare(composed, device) > 0.5;
}

/**
 * The wording shown when the two copies disagree. Both the job-detail pane and the
 * grid say the same thing, so they say it from here.
 */
export const STALE_ADDRESS_LEAD = 'The driver app has a different address:';
export const STALE_ADDRESS_DETAIL = 'This address and the map pin may be out of date.';

/** One-line rendering for a tooltip or any other single-string surface. */
export function staleAddressSummary(deviceAddress?: string | null): string {
    return `${STALE_ADDRESS_LEAD} ${deviceAddress}. ${STALE_ADDRESS_DETAIL}`;
}
