import {SxProps, Theme} from '@mui/material';

// Day-of-week color mapping — each day gets a distinct MUI chip color
const dayColorMap: Record<string, 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'default'> = {
    monday: 'primary',
    tuesday: 'secondary',
    wednesday: 'success',
    thursday: 'info',
    friday: 'warning',
    saturday: 'error',
    sunday: 'default',
};

export function getDayChipColor(day: string): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'default' {
    return dayColorMap[day.toLowerCase()] ?? 'default';
}

// Compliance type color mapping
export function getComplianceTypeColor(type: string): 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'default' {
    switch (type?.toLowerCase()) {
        case "driver's license":
        case 'drivers license':
            return 'primary';
        case 'dg endorsement':
            return 'warning';
        case 'insurance':
            return 'info';
        case 'vehicle wof':
            return 'success';
        case 'vehicle registration':
        case 'vehicle rego':
            return 'secondary';
        default:
            return 'default';
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

export function getFleetChipSx(fleet: string): SxProps<Theme> {
    const idx = hashString(fleet) % fleetPalette.length;
    const color = fleetPalette[idx];
    return {
        bgcolor: color.bg,
        color: color.text,
        borderColor: color.border,
        fontWeight: 500,
    };
}
