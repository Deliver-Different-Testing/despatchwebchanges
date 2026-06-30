/**
 * MapControlButtons Component
 *
 * Control buttons for the dispatch map: auto zoom, couriers only,
 * urgent army filter, and large view toggle.
 */

import React from 'react';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import MapIcon from '@mui/icons-material/Map';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EmergencyIcon from '@mui/icons-material/Emergency';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
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
        <Tooltip title={displayTooltip} placement="right">
            <span>
                <IconButton
                    size="small"
                    onClick={onClick}
                    disabled={disabled}
                    color={active ? 'primary' : 'default'}
                    aria-label={ariaLabel}
                    data-active={active}
                    sx={{borderRadius: 0, p: 0.75}}
                >
                    {displayIcon}
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
        <Paper
            elevation={3}
            sx={{
                position: 'absolute',
                bottom: 20,
                left: 10,
                zIndex: 10,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'background.paper',
            }}
        >
            <ControlButton
                active={autoZoomEnabled}
                onClick={onToggleAutoZoom}
                icon={<ZoomOutMapIcon sx={{fontSize: ICON_SIZE}}/>}
                activeIcon={<FitScreenIcon sx={{fontSize: ICON_SIZE}}/>}
                tooltip="Auto Zoom Disabled"
                activeTooltip="Auto Zoom Enabled"
                ariaLabel="Toggle Auto Zoom"
            />
            <Divider/>
            <ControlButton
                active={couriersOnlyEnabled}
                disabled={couriersLargeViewEnabled}
                onClick={onToggleCouriersOnly}
                icon={<MapIcon sx={{fontSize: ICON_SIZE}}/>}
                activeIcon={<LocalShippingIcon sx={{fontSize: ICON_SIZE}}/>}
                tooltip="Pins and Couriers"
                activeTooltip="Couriers Only"
                ariaLabel="Toggle Couriers Only"
            />
            <Divider/>
            <ControlButton
                active={urgentArmyOnlyEnabled}
                disabled={couriersLargeViewEnabled}
                onClick={onToggleUrgentArmyOnly}
                icon={<VisibilityOffIcon sx={{fontSize: ICON_SIZE}}/>}
                activeIcon={<EmergencyIcon sx={{fontSize: ICON_SIZE}}/>}
                tooltip="Show All Couriers"
                activeTooltip="Show Fleet Only"
                ariaLabel="Toggle Urgent Army Filter"
            />
            <Divider/>
            <ControlButton
                active={couriersLargeViewEnabled}
                onClick={onToggleCouriersLargeView}
                icon={<FullscreenExitIcon sx={{fontSize: ICON_SIZE}}/>}
                activeIcon={<FullscreenIcon sx={{fontSize: ICON_SIZE}}/>}
                tooltip="Normal View"
                activeTooltip="Couriers Large View"
                ariaLabel="Toggle Couriers Large View"
            />
        </Paper>
    );
}
