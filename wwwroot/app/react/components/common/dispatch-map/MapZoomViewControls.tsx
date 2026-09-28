/**
 * MapZoomViewControls
 *
 * Top-right map overlay providing zoom in/out and a base-map view picker
 * (roadmap / satellite / terrain). Rendered as app components so the controls
 * match the rest of the app instead of HERE Maps' native chrome.
 */

import React, {useEffect, useImperativeHandle, useRef, useState} from 'react';
import {ActionIcon, Divider, Menu, Paper, Tooltip} from '@mantine/core';
import {Check, Layers, Minus, Mountain, Plus, Satellite, TrafficCone, TriangleAlert} from 'lucide-react';
import {IconMap} from '@tabler/icons-react';
import {Icon} from '../icon/Icon';

const ICON_SIZE = 20;

interface RailButtonProps extends React.ComponentPropsWithoutRef<'button'> {
    label: string;
    active?: boolean;
    children: React.ReactNode;
}

/**
 * One button in the vertical rail. Square (the theme's pill radius would break a
 * flush-stacked rail into detached lozenges) and 32px, matching the original
 * density. Kept local because the rail is the only thing that wants this shape.
 *
 * forwardRef and the `...rest` spread are load-bearing: Tooltip and Menu.Target
 * both hand their child a ref plus the hover/click handlers that drive them, and
 * a component that drops either silently renders no tooltip and no menu.
 */
const RailButton = React.forwardRef<HTMLButtonElement, RailButtonProps>(function RailButton(
    {label, active, children, ...rest},
    ref,
) {
    return (
        <ActionIcon
            ref={ref}
            variant="subtle"
            color={active ? 'brand' : 'gray'}
            size="md"
            radius={0}
            aria-label={label}
            {...(active === undefined ? {} : {'data-active': active})}
            {...rest}
        >
            {children}
        </ActionIcon>
    );
});

type ViewType = 'roadmap' | 'satellite' | 'terrain';

interface MapZoomViewControlsProps {
    map: any | null;
    platform: any | null;
    defaultLayers: any | null;
    showTraffic?: boolean;
    showIncidents?: boolean;
    showViewPicker?: boolean;
    /** Which edge of the map the control rail anchors to. Defaults to 'right'. */
    placement?: 'left' | 'right';
    /** Base view to apply on mount, once. Defaults to 'roadmap' (today's behaviour — no-op). */
    defaultView?: ViewType;
    /** Whether the traffic layer should already be on at mount. Defaults to false (today's behaviour). */
    defaultTrafficEnabled?: boolean;
}

/** Imperative controls for a parent that needs to drive this rail's state from outside — e.g. a
 * display-settings preset applying its saved view/traffic choice after the rail has mounted. */
export interface MapZoomViewControlsHandle {
    setView: (view: ViewType) => void;
    setTrafficEnabled: (enabled: boolean) => void;
}

const VIEW_OPTIONS: ReadonlyArray<{value: ViewType; label: string; icon: React.ReactNode}> = [
    {value: 'roadmap', label: 'Roadmap', icon: <Icon tabler={IconMap} size={16}/>},
    {value: 'satellite', label: 'Satellite', icon: <Icon lucide={Satellite} size={16}/>},
    {value: 'terrain', label: 'Terrain', icon: <Icon lucide={Mountain} size={16}/>},
];

function getLayer(defaultLayers: any, view: ViewType): any | null {
    if (!defaultLayers?.raster) return null;
    switch (view) {
        case 'roadmap':
            return defaultLayers.raster.normal?.base ?? null;
        case 'satellite':
            return defaultLayers.raster.satellite?.map ?? null;
        case 'terrain':
            return defaultLayers.raster.terrain?.map ?? null;
    }
}

function getTrafficLayer(defaultLayers: any, platform: any): any | null {
    const fromDefaults =
        defaultLayers?.vector?.normal?.traffic ??
        defaultLayers?.raster?.normal?.traffic ??
        defaultLayers?.raster?.traffic?.flow ??
        null;
    if (fromDefaults) return fromDefaults;

    if (!platform || typeof platform.getMapTileService !== 'function') return null;
    try {
        const trafficService = platform.getMapTileService({type: 'traffic'});
        return trafficService.createTileLayer('traffictile', 'normal.day', 256, 'png8', {style: 'flow'});
    } catch {
        return null;
    }
}

function getTrafficIncidentsLayer(defaultLayers: any, platform: any): any | null {
    const fromDefaults =
        defaultLayers?.vector?.normal?.trafficincidents ??
        defaultLayers?.raster?.normal?.trafficincidents ??
        defaultLayers?.raster?.traffic?.incidents ??
        null;
    if (fromDefaults) return fromDefaults;

    if (!platform || typeof platform.getMapTileService !== 'function') return null;
    try {
        const trafficService = platform.getMapTileService({type: 'traffic'});
        return trafficService.createTileLayer('traffictile', 'normal.day', 256, 'png8', {style: 'incidents'});
    } catch {
        return null;
    }
}

export const MapZoomViewControls = React.forwardRef<MapZoomViewControlsHandle, MapZoomViewControlsProps>(
    function MapZoomViewControls({
        map,
        platform,
        defaultLayers,
        showTraffic = true,
        showIncidents = true,
        showViewPicker = true,
        placement = 'right',
        defaultView = 'roadmap',
        defaultTrafficEnabled = false,
    }, ref) {
    const isLeft = placement === 'left';
    const tooltipPlacement = isLeft ? 'right' : 'left';
    const [activeView, setActiveView] = useState<ViewType>('roadmap');
    const [viewMenuOpened, setViewMenuOpened] = useState(false);
    const [trafficEnabled, setTrafficEnabled] = useState(false);
    const trafficLayerRef = useRef<any>(null);
    const [incidentsEnabled, setIncidentsEnabled] = useState(false);
    const incidentsLayerRef = useRef<any>(null);

    const handleZoomIn = () => {
        if (!map) return;
        map.setZoom(map.getZoom() + 1, true);
    };

    const handleZoomOut = () => {
        if (!map) return;
        map.setZoom(map.getZoom() - 1, true);
    };

    /** Switches the base layer, unless `view` is already active. */
    const applyView = (view: ViewType) => {
        if (view === activeView) return;
        const layer = getLayer(defaultLayers, view);
        if (map && layer) {
            map.setBaseLayer(layer);
            setActiveView(view);
        }
    };

    /** Adds/removes the traffic layer to reach `enabled`, unless it's already there. */
    const applyTraffic = (enabled: boolean) => {
        if (!map || enabled === trafficEnabled) return;
        if (!trafficLayerRef.current) {
            trafficLayerRef.current = getTrafficLayer(defaultLayers, platform);
        }
        const layer = trafficLayerRef.current;
        if (!layer) return;
        if (enabled) {
            map.addLayer(layer);
        } else {
            map.removeLayer(layer);
        }
        setTrafficEnabled(enabled);
    };

    const handleViewSelect = (view: ViewType) => applyView(view);
    const handleToggleTraffic = () => applyTraffic(!trafficEnabled);

    useImperativeHandle(ref, () => ({setView: applyView, setTrafficEnabled: applyTraffic}));

    // Apply the initial view/traffic the parent asked for, once, when the map first mounts —
    // e.g. a display-settings preset ("Live" = satellite + traffic) applied at page load.
    useEffect(() => {
        if (!map) return;
        applyView(defaultView);
        applyTraffic(defaultTrafficEnabled);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- apply once when the map becomes available
    }, [map]);

    const handleToggleIncidents = () => {
        if (!map) return;
        if (!incidentsLayerRef.current) {
            incidentsLayerRef.current = getTrafficIncidentsLayer(defaultLayers, platform);
        }
        const layer = incidentsLayerRef.current;
        if (!layer) return;
        if (incidentsEnabled) {
            map.removeLayer(layer);
        } else {
            map.addLayer(layer);
        }
        setIncidentsEnabled(!incidentsEnabled);
    };

    return (
        <Paper
            shadow="md"
            radius="sm"
            style={{
                position: 'absolute',
                bottom: 20,
                ...(isLeft ? {left: 10} : {right: 10}),
                zIndex: 10,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            <Tooltip label="Zoom in" position={tooltipPlacement}>
                <RailButton label="Zoom in" onClick={handleZoomIn}>
                    <Icon lucide={Plus} size={ICON_SIZE}/>
                </RailButton>
            </Tooltip>
            <Divider/>
            <Tooltip label="Zoom out" position={tooltipPlacement}>
                <RailButton label="Zoom out" onClick={handleZoomOut}>
                    <Icon lucide={Minus} size={ICON_SIZE}/>
                </RailButton>
            </Tooltip>
            {showTraffic && (
                <>
                    <Divider/>
                    <Tooltip
                        label={trafficEnabled ? 'Hide traffic conditions' : 'Show traffic conditions'}
                        position={tooltipPlacement}
                    >
                        <RailButton
                            label="Toggle traffic conditions"
                            onClick={handleToggleTraffic}
                            active={trafficEnabled}
                        >
                            <Icon lucide={TrafficCone} size={ICON_SIZE}/>
                        </RailButton>
                    </Tooltip>
                </>
            )}
            {showIncidents && (
                <>
                    <Divider/>
                    <Tooltip
                        label={incidentsEnabled ? 'Hide traffic incidents' : 'Show traffic incidents'}
                        position={tooltipPlacement}
                    >
                        <RailButton
                            label="Toggle traffic incidents"
                            onClick={handleToggleIncidents}
                            active={incidentsEnabled}
                        >
                            <Icon lucide={TriangleAlert} size={ICON_SIZE}/>
                        </RailButton>
                    </Tooltip>
                </>
            )}
            {showViewPicker && (
                <>
                    <Divider/>
                    {/* Mantine's Menu anchors to its own Target, so the rail no longer
                        has to carry an anchorEl in state the way MUI's Menu required. */}
                    <Menu
                        position={isLeft ? 'right-end' : 'left-end'}
                        withinPortal
                        onChange={setViewMenuOpened}
                    >
                        <Menu.Target>
                            {/* Tooltip spreads Menu.Target's ARIA onto its own floating
                                box rather than the trigger, so the button states itself. */}
                            <Tooltip label="Choose view" position={tooltipPlacement}>
                                <RailButton
                                    label="Choose view"
                                    aria-haspopup="menu"
                                    aria-expanded={viewMenuOpened}
                                >
                                    <Icon lucide={Layers} size={ICON_SIZE}/>
                                </RailButton>
                            </Tooltip>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {VIEW_OPTIONS.map((opt) => (
                                <Menu.Item
                                    key={opt.value}
                                    leftSection={opt.icon}
                                    rightSection={
                                        activeView === opt.value ? <Icon lucide={Check} size={16}/> : undefined
                                    }
                                    onClick={() => handleViewSelect(opt.value)}
                                    data-selected={activeView === opt.value}
                                >
                                    {opt.label}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                </>
            )}
        </Paper>
    );
});
