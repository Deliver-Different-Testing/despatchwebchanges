import type React from 'react';

/**
 * Badge colours for the driver-management chips.
 *
 * These are Mantine palette keys rather than the tenant brand: the point of a
 * day-of-week or compliance-type chip is that each value is *distinguishable
 * from its neighbours*, so keying them off a brand that changes per tenant would
 * collapse two of them together on one tenant and not the other. Same reasoning
 * as the map flag colours.
 */

// Day-of-week colour mapping — each day gets a distinct chip colour
const dayColorMap: Record<string, string> = {
    monday: 'blue',
    tuesday: 'grape',
    wednesday: 'green',
    thursday: 'cyan',
    friday: 'yellow',
    saturday: 'red',
    sunday: 'gray',
};

export function getDayChipColor(day: string): string {
    return dayColorMap[day.toLowerCase()] ?? 'gray';
}

// Compliance type colour mapping
export function getComplianceTypeColor(type: string): string {
    switch (type?.toLowerCase()) {
        case "driver's license":
        case 'drivers license':
            return 'blue';
        case 'dg endorsement':
            return 'yellow';
        case 'insurance':
            return 'cyan';
        case 'vehicle wof':
            return 'green';
        case 'vehicle registration':
        case 'vehicle rego':
            return 'grape';
        default:
            return 'gray';
    }
}

// Fleet color palette — deterministic hash assigns each fleet a unique color
const fleetPalette: Array<{ bg: string; text: string; border: string }> = [
    {bg: '#e3f2fd', text: '#1565c0', border: '#90caf9'},   // blue
    {bg: '#f3e5f5', text: '#7b1fa2', border: '#ce93d8'},   // purple
    {bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7'},   // green
    {bg: '#fff3e0', text: '#e65100', border: '#ffcc80'},    // orange
    {bg: '#fce4ec', text: '#c62828', border: '#ef9a9a'},    // red
    {bg: '#e0f7fa', text: '#00838f', border: '#80deea'},    // cyan
    {bg: '#fff8e1', text: '#f57f17', border: '#ffe082'},    // amber
    {bg: '#ede7f6', text: '#4527a0', border: '#b39ddb'},    // deep purple
    {bg: '#e0f2f1', text: '#00695c', border: '#80cbc4'},    // teal
    {bg: '#fbe9e7', text: '#bf360c', border: '#ffab91'},    // deep orange
];

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

/**
 * A fleet's chip colours. The palette is explicit hex because the fleet is data:
 * there is no fixed set to assign theme colours to, so a hash picks one of ten.
 * Returns a style object rather than `sx` — the values were already concrete, so
 * only the container changed.
 */
export function getFleetChipStyle(fleet: string): React.CSSProperties {
    const idx = hashString(fleet) % fleetPalette.length;
    const color = fleetPalette[idx];
    return {
        backgroundColor: color.bg,
        color: color.text,
        borderColor: color.border,
        fontWeight: 500,
    };
}
