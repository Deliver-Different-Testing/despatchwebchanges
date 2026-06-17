/**
 * MapZoomViewControls
 *
 * Top-right map overlay providing zoom in/out and a base-map view picker
 * (roadmap / satellite / terrain). Rendered as MUI components so the
 * controls match the rest of the app instead of HERE Maps' native chrome.
 */

import React, {useRef, useState} from 'react';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import LayersIcon from '@mui/icons-material/Layers';
import MapIcon from '@mui/icons-material/Map';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import TerrainIcon from '@mui/icons-material/Terrain';
import TrafficIcon from '@mui/icons-material/Traffic';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import CheckIcon from '@mui/icons-material/Check';

const ICON_SIZE = 20;

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
}

const VIEW_OPTIONS: ReadonlyArray<{value: ViewType; label: string; icon: React.ReactNode}> = [
    {value: 'roadmap', label: 'Roadmap', icon: <MapIcon fontSize="small"/>},
    {value: 'satellite', label: 'Satellite', icon: <SatelliteAltIcon fontSize="small"/>},
    {value: 'terrain', label: 'Terrain', icon: <TerrainIcon fontSize="small"/>},
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

export function MapZoomViewControls({
    map,
    platform,
    defaultLayers,
    showTraffic = true,
    showIncidents = true,
    showViewPicker = true,
    placement = 'right',
}: MapZoomViewControlsProps) {
    const isLeft = placement === 'left';
    const tooltipPlacement = isLeft ? 'right' : 'left';
    const [viewMenuAnchor, setViewMenuAnchor] = useState<HTMLElement | null>(null);
    const [activeView, setActiveView] = useState<ViewType>('roadmap');
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

    const handleViewSelect = (view: ViewType) => {
        const layer = getLayer(defaultLayers, view);
        if (map && layer) {
            map.setBaseLayer(layer);
            setActiveView(view);
        }
        setViewMenuAnchor(null);
    };

    const handleToggleTraffic = () => {
        if (!map) return;
        if (!trafficLayerRef.current) {
            trafficLayerRef.current = getTrafficLayer(defaultLayers, platform);
        }
        const layer = trafficLayerRef.current;
        if (!layer) return;
        if (trafficEnabled) {
            map.removeLayer(layer);
        } else {
            map.addLayer(layer);
        }
        setTrafficEnabled(!trafficEnabled);
    };

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
        <>
            <Paper
                elevation={3}
                sx={{
                    position: 'absolute',
                    bottom: 20,
                    ...(isLeft ? { left: 10 } : { right: 10 }),
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 1,
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                }}
            >
                <Tooltip title="Zoom in" placement={tooltipPlacement}>
                    <IconButton
                        size="small"
                        onClick={handleZoomIn}
                        aria-label="Zoom in"
                        sx={{borderRadius: 0, p: 0.75}}
                    >
                        <AddIcon sx={{fontSize: ICON_SIZE}}/>
                    </IconButton>
                </Tooltip>
                <Divider/>
                <Tooltip title="Zoom out" placement={tooltipPlacement}>
                    <IconButton
                        size="small"
                        onClick={handleZoomOut}
                        aria-label="Zoom out"
                        sx={{borderRadius: 0, p: 0.75}}
                    >
                        <RemoveIcon sx={{fontSize: ICON_SIZE}}/>
                    </IconButton>
                </Tooltip>
                {showTraffic && (
                    <>
                        <Divider/>
                        <Tooltip title={trafficEnabled ? 'Hide traffic conditions' : 'Show traffic conditions'} placement={tooltipPlacement}>
                            <IconButton
                                size="small"
                                onClick={handleToggleTraffic}
                                color={trafficEnabled ? 'primary' : 'default'}
                                aria-label="Toggle traffic conditions"
                                data-active={trafficEnabled}
                                sx={{borderRadius: 0, p: 0.75}}
                            >
                                <TrafficIcon sx={{fontSize: ICON_SIZE}}/>
                            </IconButton>
                        </Tooltip>
                    </>
                )}
                {showIncidents && (
                    <>
                        <Divider/>
                        <Tooltip title={incidentsEnabled ? 'Hide traffic incidents' : 'Show traffic incidents'} placement={tooltipPlacement}>
                            <IconButton
                                size="small"
                                onClick={handleToggleIncidents}
                                color={incidentsEnabled ? 'primary' : 'default'}
                                aria-label="Toggle traffic incidents"
                                data-active={incidentsEnabled}
                                sx={{borderRadius: 0, p: 0.75}}
                            >
                                <ReportProblemIcon sx={{fontSize: ICON_SIZE}}/>
                            </IconButton>
                        </Tooltip>
                    </>
                )}
                {showViewPicker && (
                    <>
                        <Divider/>
                        <Tooltip title="Choose view" placement={tooltipPlacement}>
                            <IconButton
                                size="small"
                                onClick={(e) => setViewMenuAnchor(e.currentTarget)}
                                aria-label="Choose view"
                                sx={{borderRadius: 0, p: 0.75}}
                            >
                                <LayersIcon sx={{fontSize: ICON_SIZE}}/>
                            </IconButton>
                        </Tooltip>
                    </>
                )}
            </Paper>
            <Menu
                anchorEl={viewMenuAnchor}
                open={Boolean(viewMenuAnchor)}
                onClose={() => setViewMenuAnchor(null)}
                anchorOrigin={{vertical: 'top', horizontal: isLeft ? 'left' : 'right'}}
                transformOrigin={{vertical: 'bottom', horizontal: isLeft ? 'left' : 'right'}}
            >
                {VIEW_OPTIONS.map((opt) => (
                    <MenuItem
                        key={opt.value}
                        selected={activeView === opt.value}
                        onClick={() => handleViewSelect(opt.value)}
                    >
                        <ListItemIcon>{opt.icon}</ListItemIcon>
                        <ListItemText>{opt.label}</ListItemText>
                        {activeView === opt.value && <CheckIcon fontSize="small" sx={{ml: 2}}/>}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
