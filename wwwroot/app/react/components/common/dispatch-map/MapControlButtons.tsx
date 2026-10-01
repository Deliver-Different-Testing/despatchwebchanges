/**
 * MapControlButtons Component
 *
 * Control buttons for the dispatch map: auto zoom, couriers only,
 * urgent army filter, and large view toggle.
 */

import React from 'react';
import {ActionIcon, Divider, Paper, Tooltip} from '@mantine/core';
import {Expand, EyeOff, Maximize, Minimize, Scan, Siren} from 'lucide-react';
import {IconMap, IconTruck} from '@tabler/icons-react';
import {Icon} from '../icon/Icon';
import {useMapGlassClassName} from '../../../hooks/useMapGlassClassName';
import type { MapControlButtonsProps } from './DispatchMap.types';

const ICON_SIZE = 20;

interface ControlButtonProps {
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    activeIcon?: React.ReactNode;
    tooltip: string;
    activeTooltip?: string;
    ariaLabel: string;
}

function ControlButton({
    active,
    disabled = false,
    onClick,
    icon,
    activeIcon,
    tooltip,
    activeTooltip,
    ariaLabel,
}: ControlButtonProps) {
    const displayIcon = active && activeIcon ? activeIcon : icon;
    const displayTooltip = active && activeTooltip ? activeTooltip : tooltip;

    return (
        // The <span> is load-bearing: a disabled button fires no pointer events, so
        // without a wrapper the tooltip disappears exactly when the user most needs
        // to know why the control is unavailable. Two of these disable together.
        <Tooltip label={displayTooltip} position="right">
            <span>
                <ActionIcon
                    variant="subtle"
                    color={active ? 'brand' : 'gray'}
                    // 32px, matching the rail's original density.
                    size="md"
                    // The theme makes every ActionIcon a pill (radius 9999). These
                    // are stacked flush in a rail with dividers between them, so
                    // they must be square or the rail reads as detached lozenges.
                    radius={0}
                    onClick={onClick}
                    disabled={disabled}
                    aria-label={ariaLabel}
                    data-active={active}
                >
                    {displayIcon}
                </ActionIcon>
            </span>
        </Tooltip>
    );
}

export function MapControlButtons({
    controlState,
    onToggleAutoZoom,
    onToggleCouriersOnly,
    onToggleUrgentArmyOnly,
    onToggleCouriersLargeView,
}: MapControlButtonsProps) {
    const { autoZoomEnabled, couriersOnlyEnabled, urgentArmyOnlyEnabled, couriersLargeViewEnabled } =
        controlState;
    const glassClassName = useMapGlassClassName();

    return (
        <Paper
            className={glassClassName}
            shadow="md"
            radius="sm"
            style={{
                position: 'absolute',
                bottom: 20,
                left: 10,
                zIndex: 10,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            <ControlButton
                active={autoZoomEnabled}
                onClick={onToggleAutoZoom}
                // Expand/Scan rather than the dictionary's Maximize for ZoomOutMap:
                // the large-view toggle below already owns Maximize, and two buttons
                // in the same rail carrying the same glyph is unreadable.
                // `data-control-icon` names each affordance — Lucide/Tabler emit no
                // test hook where MUI auto-generated one (same reason
                // `jobListIndicators` carries a `testId` per marker).
                icon={<Icon lucide={Expand} size={ICON_SIZE} data-control-icon="auto-zoom-off"/>}
                activeIcon={<Icon lucide={Scan} size={ICON_SIZE} data-control-icon="auto-zoom-on"/>}
                tooltip="Auto zoom disabled"
                activeTooltip="Auto zoom enabled"
                ariaLabel="Toggle auto zoom"
            />
            <Divider/>
            <ControlButton
                active={couriersOnlyEnabled}
                disabled={couriersLargeViewEnabled}
                onClick={onToggleCouriersOnly}
                icon={<Icon tabler={IconMap} size={ICON_SIZE} data-control-icon="pins-and-couriers"/>}
                activeIcon={<Icon tabler={IconTruck} size={ICON_SIZE} data-control-icon="couriers-only"/>}
                tooltip="Pins and couriers"
                activeTooltip="Couriers only"
                ariaLabel="Toggle couriers only"
            />
            <Divider/>
            <ControlButton
                active={urgentArmyOnlyEnabled}
                disabled={couriersLargeViewEnabled}
                onClick={onToggleUrgentArmyOnly}
                icon={<Icon lucide={EyeOff} size={ICON_SIZE} data-control-icon="all-couriers"/>}
                activeIcon={<Icon lucide={Siren} size={ICON_SIZE} data-control-icon="fleet-only"/>}
                tooltip="Show all couriers"
                activeTooltip="Show fleet only"
                ariaLabel="Toggle Urgent Army filter"
            />
            <Divider/>
            <ControlButton
                active={couriersLargeViewEnabled}
                onClick={onToggleCouriersLargeView}
                icon={<Icon lucide={Minimize} size={ICON_SIZE} data-control-icon="normal-view"/>}
                activeIcon={<Icon lucide={Maximize} size={ICON_SIZE} data-control-icon="large-view"/>}
                tooltip="Normal view"
                activeTooltip="Couriers large view"
                ariaLabel="Toggle couriers large view"
            />
        </Paper>
    );
}
