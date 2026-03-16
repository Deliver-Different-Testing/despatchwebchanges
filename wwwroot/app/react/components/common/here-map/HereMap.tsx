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
    // Hook handles all map initialization and updates internally
    useHereMap({
        mapId,
        credentials,
        config,
        onMapReady,
    });

    return (
        <Box
            id={mapId}
            className="here-map"
            sx={{
                width: '100%',
                height: '100%',
                minHeight: 300,
            }}
        />
    );
};

export default HereMap;
