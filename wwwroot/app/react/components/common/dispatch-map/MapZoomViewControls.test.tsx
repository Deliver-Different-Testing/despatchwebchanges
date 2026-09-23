
import React from 'react';
import {screen, fireEvent, act} from '@testing-library/react';
import {setupUser} from '../../../__testUtils__/setupUser';
import {MapZoomViewControls} from './MapZoomViewControls';
import type {MapZoomViewControlsHandle} from './MapZoomViewControls';
import {renderWithMantine as renderWithTheme} from '../../../__testUtils__';

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

    it.each([
        ['Zoom in', 'Zoom in'],
        ['Zoom out', 'Zoom out'],
        ['Toggle traffic conditions', 'Show traffic conditions'],
        ['Toggle traffic incidents', 'Show traffic incidents'],
        ['Choose view', 'Choose view'],
    ])('shows the %s tooltip on hover', async (ariaLabel, tooltip) => {
        const user = setupUser();
        renderWithTheme(<MapZoomViewControls map={createMockMap()} platform={null} defaultLayers={createMockLayers()}/>);

        await user.hover(screen.getByLabelText(ariaLabel));
        expect(await screen.findByText(tooltip)).toBeInTheDocument();
    });

    it('anchors the view menu to the rail button rather than the viewport origin', async () => {
        const user = setupUser();
        renderWithTheme(<MapZoomViewControls map={createMockMap()} platform={null} defaultLayers={createMockLayers()}/>);

        // Menu.Target measures the ref it hands its child to place the dropdown.
        // A trigger that drops the ref leaves floating-ui without a reference
        // element and the menu lands in the top-left corner of the page.
        const trigger = screen.getByLabelText('Choose view');
        expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await user.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
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

    describe('defaultView / defaultTrafficEnabled', () => {
        it('applies the base layer and traffic layer on mount when given non-default values', () => {
            const map = createMockMap();
            const layers = createMockLayers();
            renderWithTheme(
                <MapZoomViewControls
                    map={map} platform={null} defaultLayers={layers}
                    defaultView="satellite" defaultTrafficEnabled
                />,
            );

            expect(map.setBaseLayer).toHaveBeenCalledWith(layers.raster.satellite.map);
            expect(map.addLayer).toHaveBeenCalledWith(layers.vector!.normal.traffic);
            expect(screen.getByLabelText('Toggle traffic conditions')).toHaveAttribute('data-active', 'true');
        });

        it('does not touch the map when defaultView/defaultTrafficEnabled are omitted (today\'s behaviour)', () => {
            const map = createMockMap();
            renderWithTheme(<MapZoomViewControls map={map} platform={null} defaultLayers={createMockLayers()}/>);

            expect(map.setBaseLayer).not.toHaveBeenCalled();
            expect(map.addLayer).not.toHaveBeenCalled();
        });
    });

    describe('imperative handle', () => {
        it('setView switches the base layer and updates the active view menu item', () => {
            const map = createMockMap();
            const layers = createMockLayers();
            const ref = React.createRef<MapZoomViewControlsHandle>();
            renderWithTheme(<MapZoomViewControls ref={ref} map={map} platform={null} defaultLayers={layers}/>);

            act(() => ref.current?.setView('satellite'));

            expect(map.setBaseLayer).toHaveBeenCalledWith(layers.raster.satellite.map);
            fireEvent.click(screen.getByLabelText('Choose view'));
            const satelliteItem = screen.getByText('Satellite').closest('[data-selected]');
            expect(satelliteItem).toHaveAttribute('data-selected', 'true');
        });

        it('setTrafficEnabled adds/removes the traffic layer and updates the rail button state', () => {
            const map = createMockMap();
            const layers = createMockLayers();
            const ref = React.createRef<MapZoomViewControlsHandle>();
            renderWithTheme(<MapZoomViewControls ref={ref} map={map} platform={null} defaultLayers={layers}/>);

            act(() => ref.current?.setTrafficEnabled(true));
            expect(map.addLayer).toHaveBeenCalledWith(layers.vector!.normal.traffic);
            expect(screen.getByLabelText('Toggle traffic conditions')).toHaveAttribute('data-active', 'true');

            act(() => ref.current?.setTrafficEnabled(false));
            expect(map.removeLayer).toHaveBeenCalledWith(layers.vector!.normal.traffic);
            expect(screen.getByLabelText('Toggle traffic conditions')).toHaveAttribute('data-active', 'false');
        });

        it("does not touch the map when the imperative call is a no-op (already at that state)", () => {
            const map = createMockMap();
            const layers = createMockLayers();
            const ref = React.createRef<MapZoomViewControlsHandle>();
            renderWithTheme(<MapZoomViewControls ref={ref} map={map} platform={null} defaultLayers={layers}/>);

            act(() => ref.current?.setTrafficEnabled(false));
            expect(map.removeLayer).not.toHaveBeenCalled();
        });
    });
});
