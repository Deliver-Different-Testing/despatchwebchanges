/**
 * Job List view options — density selector, reset-columns, and the (dispatch-only)
 * "logged-in couriers only" toggle. Rendered either inline in the toolbar
 * (default) or, on the dispatch page, portaled into the panel header
 * (`headerVariant`) — a plain `'surface'` paper bar, so controls inherit the
 * body text colour and tint with the shared header overlay colour.
 *
 * Density is a mutually-exclusive choice, so it is a `SegmentedToggle` rather
 * than a hand-rolled `aria-pressed` button group: it reads as one radio group to
 * assistive tech, and it marks the selection with the same sliding indicator the
 * scope toggles use.
 */

import React from 'react';
import {Group, Switch} from '@mantine/core';
import {AlignJustify, Check, Columns3, Rows3, Rows4} from 'lucide-react';

import {Icon} from '../common/icon/Icon';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../common/panel-controls';
import {SegmentedToggle, SEGMENTED_TOGGLE_GLYPH_SIZE} from '../common/segmented-toggle';
import {headerSurfaceAccent} from '../dialogs/shared/mantine/styles';
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

// The options render as glyphs only, so each carries its name as a tooltip —
// the label is otherwise reachable only through the accessible name.
const densityData = DENSITY_OPTIONS.map(({value, label, icon}) => ({
    value,
    label,
    tooltip: label,
    icon: <Icon lucide={icon} size={SEGMENTED_TOGGLE_GLYPH_SIZE}/>,
}));

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
            /*
             * `size="sm"` clears a usable hit target — the previous `xs` track was
             * ~16px tall. The body is pinned to a centred nowrap row: the header
             * bar is cramped, and a wrapped body drops the label under the track.
             */
            <Switch
                size="sm"
                checked={loggedInCouriersOnly}
                onChange={(event) => onLoggedInCouriersOnlyChange(event.currentTarget.checked)}
                label="Logged-in only"
                thumbIcon={loggedInCouriersOnly
                    ? <Icon lucide={Check} size={10} color={headerSurfaceAccent}/>
                    : undefined}
                styles={{
                    body: {alignItems: 'center', flexWrap: 'nowrap'},
                    label: {fontSize: 'var(--mantine-font-size-xs)', whiteSpace: 'nowrap', lineHeight: 1.2},
                }}
            />
        )}

        <SegmentedToggle<DensityMode>
            aria-label="Row density"
            value={densityMode}
            onChange={onDensityModeChange}
            variant={headerVariant ? 'header' : 'inline'}
            data={densityData}
        />

        <HeaderActionIcon label="Reset columns" onClick={onResetColumns}>
            <Icon lucide={Columns3} size={PANEL_CONTROL_GLYPH_SIZE}/>
        </HeaderActionIcon>
    </Group>
);
