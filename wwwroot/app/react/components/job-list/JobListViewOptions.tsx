/**
 * Job List view options — density selector, reset-columns, and the (dispatch-only)
 * "logged-in couriers only" toggle. Rendered either inline in the toolbar
 * (default) or, on the dispatch page, portaled into the panel header
 * (`headerVariant`) — a plain `'surface'` paper bar, so controls inherit the
 * body text colour and tint with the shared header overlay colour.
 */

import React from 'react';
import {ActionIcon, Group, Switch, Tooltip} from '@mantine/core';
import {AlignJustify, Columns3, Rows3, Rows4} from 'lucide-react';

import {Icon} from '../common/icon/Icon';
import {headerOverlayColor} from '../dialogs/shared/mantine';
import type {DensityMode} from '../../interfaces/dispatchJob';

interface JobListViewOptionsProps {
    densityMode: DensityMode;
    onDensityModeChange: (mode: DensityMode) => void;
    onResetColumns: () => void;
    loggedInCouriersOnly: boolean;
    onLoggedInCouriersOnlyChange: (checked: boolean) => void;
    /** Show the logged-in-couriers toggle (dispatch contexts only). */
    showLoggedInSwitch?: boolean;
    /** Style for the panel header bar (inherit its on-colour) vs the toolbar. */
    headerVariant?: boolean;
}

const DENSITY_OPTIONS: {value: DensityMode; label: string; icon: React.ComponentProps<typeof Icon>['lucide']}[] = [
    {value: 'normal', label: 'Normal', icon: Rows3},
    {value: 'dense', label: 'Dense', icon: Rows4},
    {value: 'ultra-dense', label: 'Ultra Dense', icon: AlignJustify},
];

/**
 * On the neutral panel bar the controls take the bar's own on-colour and wash
 * with the shared `'surface'` overlay; in the toolbar they follow the theme.
 */
function actionIconProps(headerVariant: boolean | undefined, selected = false) {
    if (!headerVariant) {
        return {
            variant: selected ? 'light' : 'subtle',
            color: selected ? 'brand' : 'gray',
        } as const;
    }
    return {
        variant: 'subtle' as const,
        styles: {
            root: {
                color: 'inherit',
                backgroundColor: selected ? headerOverlayColor(0.12, 'surface') : undefined,
                '&:hover': {backgroundColor: headerOverlayColor(selected ? 0.16 : 0.08, 'surface')},
            },
        },
    };
}

export const JobListViewOptions: React.FC<JobListViewOptionsProps> = ({
    densityMode,
    onDensityModeChange,
    onResetColumns,
    loggedInCouriersOnly,
    onLoggedInCouriersOnlyChange,
    showLoggedInSwitch,
    headerVariant,
}) => (
    <Group align="center" gap={headerVariant ? 4 : 'xs'} wrap="nowrap">
        {showLoggedInSwitch && (
            <Switch
                size="xs"
                checked={loggedInCouriersOnly}
                onChange={(event) => onLoggedInCouriersOnlyChange(event.currentTarget.checked)}
                label="Logged-in only"
                styles={{label: {fontSize: '0.75rem', whiteSpace: 'nowrap', color: 'inherit'}}}
            />
        )}

        <ActionIcon.Group aria-label="Row density">
            {DENSITY_OPTIONS.map(({value, label, icon}) => (
                <Tooltip key={value} label={label} withArrow>
                    <ActionIcon
                        size="md"
                        aria-label={label}
                        aria-pressed={densityMode === value}
                        onClick={() => onDensityModeChange(value)}
                        {...actionIconProps(headerVariant, densityMode === value)}
                    >
                        <Icon lucide={icon} size={16}/>
                    </ActionIcon>
                </Tooltip>
            ))}
        </ActionIcon.Group>

        <Tooltip label="Reset columns" withArrow>
            <ActionIcon
                size="md"
                aria-label="Reset columns"
                onClick={onResetColumns}
                {...actionIconProps(headerVariant)}
            >
                <Icon lucide={Columns3} size={16}/>
            </ActionIcon>
        </Tooltip>
    </Group>
);
