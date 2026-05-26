/**
 * US States Utility
 *
 * Shared US states data and helper functions for address processing.
 * Used by EditAddressDialog and CreateJobDialog for state abbreviation mapping.
 */

import {StateInfo} from '../interfaces';

export const US_STATES: StateInfo[] = [
    {abbreviation: 'AL', name: 'Alabama'},
    {abbreviation: 'AK', name: 'Alaska'},
    {abbreviation: 'AZ', name: 'Arizona'},
    {abbreviation: 'AR', name: 'Arkansas'},
    {abbreviation: 'CA', name: 'California'},
    {abbreviation: 'CO', name: 'Colorado'},
    {abbreviation: 'CT', name: 'Connecticut'},
    {abbreviation: 'DE', name: 'Delaware'},
    {abbreviation: 'FL', name: 'Florida'},
    {abbreviation: 'GA', name: 'Georgia'},
    {abbreviation: 'HI', name: 'Hawaii'},
    {abbreviation: 'ID', name: 'Idaho'},
    {abbreviation: 'IL', name: 'Illinois'},
    {abbreviation: 'IN', name: 'Indiana'},
    {abbreviation: 'IA', name: 'Iowa'},
    {abbreviation: 'KS', name: 'Kansas'},
    {abbreviation: 'KY', name: 'Kentucky'},
    {abbreviation: 'LA', name: 'Louisiana'},
    {abbreviation: 'ME', name: 'Maine'},
    {abbreviation: 'MD', name: 'Maryland'},
    {abbreviation: 'MA', name: 'Massachusetts'},
    {abbreviation: 'MI', name: 'Michigan'},
    {abbreviation: 'MN', name: 'Minnesota'},
    {abbreviation: 'MS', name: 'Mississippi'},
    {abbreviation: 'MO', name: 'Missouri'},
    {abbreviation: 'MT', name: 'Montana'},
    {abbreviation: 'NE', name: 'Nebraska'},
    {abbreviation: 'NV', name: 'Nevada'},
    {abbreviation: 'NH', name: 'New Hampshire'},
    {abbreviation: 'NJ', name: 'New Jersey'},
    {abbreviation: 'NM', name: 'New Mexico'},
    {abbreviation: 'NY', name: 'New York'},
    {abbreviation: 'NC', name: 'North Carolina'},
    {abbreviation: 'ND', name: 'North Dakota'},
    {abbreviation: 'OH', name: 'Ohio'},
    {abbreviation: 'OK', name: 'Oklahoma'},
    {abbreviation: 'OR', name: 'Oregon'},
    {abbreviation: 'PA', name: 'Pennsylvania'},
    {abbreviation: 'RI', name: 'Rhode Island'},
    {abbreviation: 'SC', name: 'South Carolina'},
    {abbreviation: 'SD', name: 'South Dakota'},
    {abbreviation: 'TN', name: 'Tennessee'},
    {abbreviation: 'TX', name: 'Texas'},
    {abbreviation: 'UT', name: 'Utah'},
    {abbreviation: 'VT', name: 'Vermont'},
    {abbreviation: 'VA', name: 'Virginia'},
    {abbreviation: 'WA', name: 'Washington'},
    {abbreviation: 'WV', name: 'West Virginia'},
    {abbreviation: 'WI', name: 'Wisconsin'},
    {abbreviation: 'WY', name: 'Wyoming'},
];

export function getStateByAbbreviation(abbr: string): StateInfo | undefined {
    return US_STATES.find(s => s.abbreviation === abbr);
}

export function getStateNameByAbbreviation(abbr: string): string {
    return getStateByAbbreviation(abbr)?.name || abbr;
}

export function getStateByName(name: string): StateInfo | undefined {
    return US_STATES.find(s => s.name.toLowerCase() === name.toLowerCase());
}

/**
 * Normalise a raw state string (abbreviation, full name, mixed case, with or
 * without surrounding whitespace) to its canonical 2-letter abbreviation.
 * Returns '' for unknown or empty input so it can be safely fed straight into
 * a controlled <Select> whose options are keyed by abbreviation.
 */
export function normalizeToStateAbbreviation(value: string | null | undefined): string {
    if (!value) return '';
    const trimmed = value.trim();
    if (!trimmed) return '';

    const byAbbr = getStateByAbbreviation(trimmed.toUpperCase());
    if (byAbbr) return byAbbr.abbreviation;

    const byName = getStateByName(trimmed);
    if (byName) return byName.abbreviation;

    return '';
}
