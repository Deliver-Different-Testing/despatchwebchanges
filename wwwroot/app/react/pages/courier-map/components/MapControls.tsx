/**
 * MapControls Component
 *
 * Top-left map overlay with fit-all and refresh actions, matching the
 * dispatch map's control style (see components/common/dispatch-map/
 * MapControlButtons.tsx + MapZoomViewControls.tsx). Sits opposite the
 * bottom-left zoom/layer rail so the two never overlap.
 */

import React from 'react';
import {ActionIcon, Divider, Loader, Paper, Tooltip} from '@mantine/core';
import {RefreshCw, Scan} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import type { MapControlsProps } from '../CourierMapPage.types';
import {DisplaySettingsMenu} from './DisplaySettingsMenu';

const ICON_SIZE = 20;

/**
 * Square (the theme's pill radius would break a flush-stacked rail into detached
 * lozenges) and 32px, matching the dispatch rail's density.
 */
const railButtonProps = {
    variant: 'subtle',
    color: 'gray',
    size: 'md',
    radius: 0,
} as const;

export function MapControls({
    onFitAll,
    onRefresh,
    isLoading,
    displaySettings,
    onDisplaySettingsChange,
}: MapControlsProps) {
    return (
        <Paper
            shadow="md"
            radius="sm"
            style={{
                position: 'absolute',
                top: 16,
                left: 10,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            <Tooltip label="Fit all drivers in view" position="right">
                <ActionIcon {...railButtonProps} onClick={onFitAll} aria-label="Return to overview">
                    <Icon lucide={Scan} size={ICON_SIZE} />
                </ActionIcon>
            </Tooltip>
            <Divider />
            {/* The <span> is load-bearing: a disabled button fires no pointer events,
                so without a wrapper the tooltip vanishes while a refresh is in flight. */}
            <Tooltip label="Refresh locations" position="right">
                <span>
                    <ActionIcon
                        {...railButtonProps}
                        onClick={onRefresh}
                        disabled={isLoading}
                        aria-label="Refresh data"
                    >
                        {isLoading ? (
                            <Loader size={ICON_SIZE} color="currentColor" aria-label="Refreshing locations" />
                        ) : (
                            <Icon lucide={RefreshCw} size={ICON_SIZE} />
                        )}
                    </ActionIcon>
                </span>
            </Tooltip>
            <Divider/>
            <DisplaySettingsMenu settings={displaySettings} onChange={onDisplaySettingsChange}/>
        </Paper>
    );
}
