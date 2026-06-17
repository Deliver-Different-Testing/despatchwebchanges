/**
 * MapControls Component
 *
 * Top-left map overlay with fit-all and refresh actions, matching the
 * dispatch map's control style (see components/common/dispatch-map/
 * MapControlButtons.tsx + MapZoomViewControls.tsx). Sits opposite the
 * bottom-left zoom/layer rail so the two never overlap.
 */

import React from 'react';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import SyncIcon from '@mui/icons-material/Sync';
import type { MapControlsProps } from '../CourierMapPage.types';

const ICON_SIZE = 20;
const buttonSx = { borderRadius: 0, p: 0.75 } as const;

export function MapControls({ onFitAll, onRefresh, isLoading }: MapControlsProps) {
    return (
        <Paper
            elevation={3}
            sx={{
                position: 'absolute',
                top: 16,
                left: 10,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'background.paper',
            }}
        >
            <Tooltip title="Fit all drivers in view" placement="right">
                <IconButton
                    size="small"
                    onClick={onFitAll}
                    aria-label="Return to overview"
                    sx={buttonSx}
                >
                    <FitScreenIcon sx={{ fontSize: ICON_SIZE }} />
                </IconButton>
            </Tooltip>
            <Divider />
            <Tooltip title="Refresh locations" placement="right">
                <span>
                    <IconButton
                        size="small"
                        onClick={onRefresh}
                        disabled={isLoading}
                        aria-label="Refresh data"
                        sx={buttonSx}
                    >
                        {isLoading ? (
                            <CircularProgress size={ICON_SIZE} color="inherit" />
                        ) : (
                            <SyncIcon sx={{ fontSize: ICON_SIZE }} />
                        )}
                    </IconButton>
                </span>
            </Tooltip>
        </Paper>
    );
}
