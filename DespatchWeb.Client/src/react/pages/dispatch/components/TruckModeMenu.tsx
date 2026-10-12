import React from 'react';
import {Menu} from '@mantine/core';
import {Check} from 'lucide-react';
import {IconTruck} from '@tabler/icons-react';
import {Icon} from '../../../components/common/icon/Icon';
import {HeaderMenuButton, PANEL_CONTROL_GLYPH_SIZE} from '../../../components/common/panel-controls';
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
            <HeaderMenuButton
                icon={<Icon tabler={IconTruck} size={PANEL_CONTROL_GLYPH_SIZE}/>}
                aria-label="Truck mode"
            >
                Trucks: {value}
            </HeaderMenuButton>
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
