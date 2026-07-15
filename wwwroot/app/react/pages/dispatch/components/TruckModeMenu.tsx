import React, {useState} from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import CheckIcon from '@mui/icons-material/Check';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import {headerTextButtonSx} from './headerScopeToggleSx';
import type {TruckMode} from '../../../components/common/driver-locations/DriverLocations.types';

export interface TruckModeMenuProps {
    value: TruckMode;
    onChange: (mode: TruckMode) => void;
}

const MODES: TruckMode[] = ['On', 'Off', 'Only'];

/**
 * Driver Locations truck-mode filter, rendered in the panel header as a
 * low-emphasis text button that opens a menu — matching the Tasks panel
 * "Filters" control. The current mode stays visible in the button label
 * ("Trucks: On"). Mirrors V1's "Trucks {mode}" control.
 */
export const TruckModeMenu: React.FC<TruckModeMenuProps> = ({value, onChange}) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);

    const handleSelect = (mode: TruckMode) => {
        onChange(mode);
        setAnchor(null);
    };

    return (
        <>
            <Button
                size="small"
                startIcon={<LocalShippingIcon />}
                endIcon={<ArrowDropDownIcon />}
                onClick={(e) => setAnchor(e.currentTarget)}
                aria-haspopup="true"
                aria-expanded={anchor ? 'true' : undefined}
                aria-label="Truck mode"
                sx={headerTextButtonSx}
            >
                Trucks: {value}
            </Button>
            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
            >
                {MODES.map((mode) => (
                    <MenuItem key={mode} selected={mode === value} onClick={() => handleSelect(mode)}>
                        <ListItemIcon>{mode === value && <CheckIcon fontSize="small" />}</ListItemIcon>
                        {mode}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};
