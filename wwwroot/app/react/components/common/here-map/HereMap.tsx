/**
 * HereMap React Component
 *
 * A React component that renders a HERE Maps instance with job tracking capabilities.
 * Supports displaying pickup/delivery markers, courier locations, and route lines.
 */

import React from 'react';
import {Box} from '@mantine/core';
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
            w="100%"
            h="100%"
            mih={300}
            style={{position: 'relative'}}
        >
            <Box
                id={mapId}
                className="here-map"
                w="100%"
                h="100%"
                // HERE Maps renders info bubbles / tooltips inside this container
                // at a high z-index (~1001). Isolate the stacking context so those
                // overlays stay below the sibling MapZoomViewControls rail (zIndex
                // 10) instead of painting over it and hiding the buttons. Inline
                // (not a CSS module) so it stays assertable with toHaveStyle.
                style={{isolation: 'isolate'}}
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
