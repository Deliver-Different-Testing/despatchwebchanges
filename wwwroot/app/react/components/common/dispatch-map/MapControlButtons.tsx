/**
 * MapControlButtons Component
 *
 * Control buttons for the dispatch map: auto zoom, couriers only,
 * urgent army filter, and large view toggle.
 */

import React from 'react';
import { Tooltip, IconButton, Box } from '@mui/material';
import type { MapControlButtonsProps } from './DispatchMap.types';

interface ControlButtonProps {
    active: boolean;
    disabled?: boolean;
    onClick: () => void;
    icon: string;
    activeIcon?: string;
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
        <Tooltip title={displayTooltip} placement="right">
            <span>
                <IconButton
                    onClick={onClick}
                    disabled={disabled}
                    aria-label={ariaLabel}
                    sx={{
                        width: 40,
                        height: 40,
                        backgroundColor: active ? '#3f51b5' : '#f44336',
                        color: 'white',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                        '&:hover': {
                            backgroundColor: active ? '#303f9f' : '#d32f2f',
                        },
                        '&:disabled': {
                            opacity: 0.5,
                            backgroundColor: active ? '#3f51b5' : '#f44336',
                            color: 'white',
                        },
                    }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                        {displayIcon}
                    </span>
                </IconButton>
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

    return (
        <Box
            sx={{
                position: 'absolute',
                bottom: 20,
                left: 10,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
            }}
        >
            {/* Auto Zoom Button */}
            <ControlButton
                active={autoZoomEnabled}
                onClick={onToggleAutoZoom}
                icon="zoom_out_map"
                activeIcon="fit_screen"
                tooltip="Auto Zoom Disabled"
                activeTooltip="Auto Zoom Enabled"
                ariaLabel="Toggle Auto Zoom"
            />

            {/* Couriers Only Button */}
            <ControlButton
                active={couriersOnlyEnabled}
                disabled={couriersLargeViewEnabled}
                onClick={onToggleCouriersOnly}
                icon="map"
                activeIcon="local_shipping"
                tooltip="Pins and Couriers"
                activeTooltip="Couriers Only"
                ariaLabel="Toggle Couriers Only"
            />

            {/* Urgent Army Button */}
            <ControlButton
                active={urgentArmyOnlyEnabled}
                disabled={couriersLargeViewEnabled}
                onClick={onToggleUrgentArmyOnly}
                icon="visibility_off"
                activeIcon="emergency"
                tooltip="Show All Couriers"
                activeTooltip="Show Fleet Only"
                ariaLabel="Toggle Urgent Army Filter"
            />

            {/* Couriers Large View Button */}
            <ControlButton
                active={couriersLargeViewEnabled}
                onClick={onToggleCouriersLargeView}
                icon="fullscreen_exit"
                activeIcon="fullscreen"
                tooltip="Normal View"
                activeTooltip="Couriers Large View"
                ariaLabel="Toggle Couriers Large View"
            />
        </Box>
    );
}
