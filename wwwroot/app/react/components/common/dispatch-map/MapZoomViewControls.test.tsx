
import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {MapZoomViewControls} from './MapZoomViewControls';
import {renderWithTheme} from '../../../__testUtils__';

function createMockMap() {
    return {
        getZoom: jest.fn(() => 10),
        setZoom: jest.fn(),
        setBaseLayer: jest.fn(),
        addLayer: jest.fn(),
        removeLayer: jest.fn(),
    };
}

function createMockLayers(opts: {includeTraffic?: boolean} = {}) {
    const {includeTraffic = true} = opts;
    return {
        ...(includeTraffic ? {vector: {normal: {traffic: {id: 'traffic-layer'}}}} : {}),
        raster: {
            normal: {base: {id: 'roadmap-layer'}},
            satellite: {map: {id: 'satellite-layer'}},
            terrain: {map: {id: 'terrain-layer'}},
        },
    };
}

function createMockPlatform() {
    const trafficLayer = {id: 'platform-traffic-layer'};
    const createTileLayer = jest.fn(() => trafficLayer);
    const getMapTileService = jest.fn(() => ({createTileLayer}));
    return {platform: {getMapTileService}, trafficLayer, getMapTileService, createTileLayer};
}

describe('MapZoomViewControls', () => {
    it('renders zoom in, zoom out, traffic and choose view buttons', () => {
        renderWithTheme(<MapZoomViewControls map={createMockMap()} platform={null} defaultLayers={createMockLayers()}/>);
        expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
        expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
        expect(screen.getByLabelText('Toggle traffic conditions')).toBeInTheDocument();
        expect(screen.getByLabelText('Choose view')).toBeInTheDocument();
    });

    it('adds the traffic layer when toggled on and removes it when toggled off', () => {
        const map = createMockMap();
        const layers = createMockLayers();
        renderWithTheme(<MapZoomViewControls map={map} platform={null} defaultLayers={layers}/>);

        const trafficBtn = screen.getByLabelText('Toggle traffic conditions');
        expect(trafficBtn).toHaveAttribute('data-active', 'false');

        fireEvent.click(trafficBtn);
        expect(map.addLayer).toHaveBeenCalledWith(layers.vector!.normal.traffic);
        expect(trafficBtn).toHaveAttribute('data-active', 'true');

        fireEvent.click(trafficBtn);
        expect(map.removeLayer).toHaveBeenCalledWith(layers.vector!.normal.traffic);
        expect(trafficBtn).toHaveAttribute('data-active', 'false');
    });

    it('falls back to building a traffic tile layer via the platform when defaultLayers lacks one', () => {
        const map = createMockMap();
        const layers = createMockLayers({includeTraffic: false});
        const {platform, trafficLayer, getMapTileService, createTileLayer} = createMockPlatform();
        renderWithTheme(<MapZoomViewControls map={map} platform={platform} defaultLayers={layers}/>);

        fireEvent.click(screen.getByLabelText('Toggle traffic conditions'));

        expect(getMapTileService).toHaveBeenCalledWith({type: 'traffic'});
        expect(createTileLayer).toHaveBeenCalledWith('traffictile', 'normal.day', 256, 'png8', {style: 'flow'});
        expect(map.addLayer).toHaveBeenCalledWith(trafficLayer);
    });

    it('calls map.setZoom with current zoom + 1 when zoom in is clicked', () => {
        const map = createMockMap();
        renderWithTheme(<MapZoomViewControls map={map} platform={null} defaultLayers={createMockLayers()}/>);

        fireEvent.click(screen.getByLabelText('Zoom in'));
        expect(map.setZoom).toHaveBeenCalledWith(11, true);
    });

    it('calls map.setZoom with current zoom - 1 when zoom out is clicked', () => {
        const map = createMockMap();
        renderWithTheme(<MapZoomViewControls map={map} platform={null} defaultLayers={createMockLayers()}/>);

        fireEvent.click(screen.getByLabelText('Zoom out'));
        expect(map.setZoom).toHaveBeenCalledWith(9, true);
    });

    it('opens the view menu and switches base layer on selection', () => {
        const map = createMockMap();
        const layers = createMockLayers();
        renderWithTheme(<MapZoomViewControls map={map} platform={null} defaultLayers={layers}/>);

        fireEvent.click(screen.getByLabelText('Choose view'));
        expect(screen.getByText('Roadmap')).toBeInTheDocument();
        expect(screen.getByText('Satellite')).toBeInTheDocument();
        expect(screen.getByText('Terrain')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Satellite'));
        expect(map.setBaseLayer).toHaveBeenCalledWith(layers.raster.satellite.map);
    });

    it('renders without crashing when map is null and does not throw on clicks', () => {
        renderWithTheme(<MapZoomViewControls map={null} platform={null} defaultLayers={createMockLayers()}/>);
        expect(() => fireEvent.click(screen.getByLabelText('Zoom in'))).not.toThrow();
        expect(() => fireEvent.click(screen.getByLabelText('Zoom out'))).not.toThrow();
    });
});
