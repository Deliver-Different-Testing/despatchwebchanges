/**
 * HereMap React Component
 *
 * A React component that renders a HERE Maps instance with job tracking capabilities.
 * Supports displaying pickup/delivery markers, courier locations, and route lines.
 */

import React from 'react';
import Box from '@mui/material/Box';
import {useHereMap} from './useHereMap';
import type {HereMapProps} from './HereMap.types';
import {MapZoomViewControls} from '../dispatch-map';

/**
 * HereMap Component
 *
 * Renders a HERE Maps instance within a container element.
 * Manages map lifecycle through the useHereMap hook.
 * The hook handles all map updates internally based on config changes.
 */
export const HereMap: React.FC<HereMapProps> = ({
                                                    mapId,
                                                    credentials,
                                                    config,
                                                    onMapReady,
                                                }) => {
    const {mapInstance, platform} = useHereMap({
        mapId,
        credentials,
        config,
        onMapReady,
    });

    return (
        <Box
            sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: 300,
            }}
        >
            <Box
                id={mapId}
                className="here-map"
                sx={{
                    width: '100%',
                    height: '100%',
                }}
            />
            <MapZoomViewControls
                map={mapInstance?.map ?? null}
                platform={platform}
                defaultLayers={mapInstance?.defaultLayers ?? null}
            />
        </Box>
    );
};

export default HereMap;
