/**
 * MapControls Component
 *
 * Horizontal glassmorphic floating bar with fit-all and refresh actions.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import type { MapControlsProps } from '../CourierMapPage.types';

const GLASS_BG = 'rgba(255, 255, 255, 0.82)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.45)';
const GLASS_BLUR = '20px';
const EASE_OUT = 'cubic-bezier(0.2, 0, 0, 1)';

const controlBarSx = {
    position: 'absolute',
    bottom: { xs: 16, md: 24 },
    left: { xs: 12, md: 16 },
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    p: '4px',
    bgcolor: GLASS_BG,
    backdropFilter: `blur(${GLASS_BLUR})`,
    WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: '12px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04)',
    zIndex: 49,
    transition: `box-shadow 200ms ${EASE_OUT}`,
    '&:hover': {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.06)',
    },
} as const;

const buttonSx = {
    width: { xs: 32, md: 36 },
    height: { xs: 32, md: 36 },
    border: 'none',
    background: 'transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `all 150ms ${EASE_OUT}`,
    '&:hover': { background: 'rgba(0, 0, 0, 0.06)' },
    '&:hover span': { color: '#1e293b' },
    '&:active': { transform: 'scale(0.92)' },
    '&:disabled': {
        opacity: 0.35,
        cursor: 'not-allowed',
        transform: 'none',
    },
    '&:disabled:hover': { background: 'transparent' },
    '&:disabled:hover span': { color: '#475569' },
    '& span': {
        color: '#475569',
        fontSize: { xs: 18, md: 20 },
        transition: 'color 150ms ease',
    },
} as const;

const dividerSx = {
    width: '1px',
    height: 20,
    bgcolor: 'rgba(0, 0, 0, 0.1)',
    flexShrink: 0,
} as const;

export function MapControls({ onFitAll, onRefresh, isLoading }: MapControlsProps) {
    return (
        <Box sx={controlBarSx}>
            <Tooltip title="Fit all drivers in view" placement="top">
                <Box
                    component="button"
                    sx={buttonSx}
                    onClick={onFitAll}
                    aria-label="Return to overview"
                >
                    <span className="material-symbols-outlined">fit_screen</span>
                </Box>
            </Tooltip>
            <Box sx={dividerSx} />
            <Tooltip title="Refresh locations" placement="top">
                <Box
                    component="button"
                    sx={buttonSx}
                    onClick={onRefresh}
                    disabled={isLoading}
                    aria-label="Refresh data"
                >
                    <Box
                        component="span"
                        className="material-symbols-outlined"
                        sx={isLoading ? {
                            animation: 'map-ctrl-spin 1s linear infinite',
                            '@keyframes map-ctrl-spin': {
                                from: { transform: 'rotate(0deg)' },
                                to: { transform: 'rotate(360deg)' },
                            },
                        } : undefined}
                    >
                        sync
                    </Box>
                </Box>
            </Tooltip>
        </Box>
    );
}
