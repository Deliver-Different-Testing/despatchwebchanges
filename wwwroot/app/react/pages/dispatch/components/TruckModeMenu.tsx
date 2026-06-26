import React from 'react';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import type {SelectChangeEvent} from '@mui/material/Select';
import type {SxProps, Theme} from '@mui/material/styles';
import type {TruckMode} from '../../../components/common/driver-locations/DriverLocations.types';

export interface TruckModeMenuProps {
    value: TruckMode;
    onChange: (mode: TruckMode) => void;
}

const MODES: TruckMode[] = ['On', 'Off', 'Only'];

// Exposed-dropdown styling tuned for the gradient panel header: the current
// value stays visible, a clear outline + caret signal interactivity, and the
// outline brightens on hover/focus. Restrained (outline, not a fill) per M3 —
// standard/low-emphasis controls on a colourful surface.
const selectSx = {
    color: 'inherit',
    '.MuiOutlinedInput-notchedOutline': {borderColor: 'rgba(255,255,255,0.5)'},
    '&:hover .MuiOutlinedInput-notchedOutline': {borderColor: 'rgba(255,255,255,0.8)'},
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {borderColor: '#fff'},
    '.MuiSelect-icon': {color: 'inherit'},
} satisfies SxProps<Theme>;

/**
 * Driver Locations truck-mode filter, rendered in the panel header as a
 * Material Design exposed dropdown menu (`Select`) — the recommended component
 * for picking one value from a short list while keeping the current choice
 * visible. Mirrors V1's "Trucks {mode}" control.
 */
export const TruckModeMenu: React.FC<TruckModeMenuProps> = ({value, onChange}) => (
    <Select
        size="small"
        value={value}
        onChange={(e: SelectChangeEvent) => onChange(e.target.value as TruckMode)}
        renderValue={(v) => `Trucks: ${v}`}
        inputProps={{'aria-label': 'Truck mode'}}
        sx={selectSx}
    >
        {MODES.map((mode) => (
            <MenuItem key={mode} value={mode}>{mode}</MenuItem>
        ))}
    </Select>
);
