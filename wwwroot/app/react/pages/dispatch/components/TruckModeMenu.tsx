import React from 'react';
import {Button, Menu} from '@mantine/core';
import {Check, ChevronDown} from 'lucide-react';
import {IconTruck} from '@tabler/icons-react';
import {Icon} from '../../../components/common/icon/Icon';
import {headerTextButtonStyle} from './headerControls';
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
export const TruckModeMenu: React.FC<TruckModeMenuProps> = ({value, onChange}) => (
    <Menu position="bottom-end" shadow="md" withinPortal>
        <Menu.Target>
            <Button
                size="compact-sm"
                variant="subtle"
                leftSection={<Icon tabler={IconTruck} size={16}/>}
                rightSection={<Icon lucide={ChevronDown} size={16}/>}
                aria-label="Truck mode"
                style={headerTextButtonStyle}
            >
                Trucks: {value}
            </Button>
        </Menu.Target>
        <Menu.Dropdown>
            {MODES.map((mode) => (
                <Menu.Item
                    key={mode}
                    onClick={() => onChange(mode)}
                    leftSection={mode === value
                        // Lucide emits no `data-testid`, so the active mark names itself.
                        ? <span data-testid="mode-check"><Icon lucide={Check} size={16}/></span>
                        : <span style={{width: 16}}/>}
                >
                    {mode}
                </Menu.Item>
            ))}
        </Menu.Dropdown>
    </Menu>
);
