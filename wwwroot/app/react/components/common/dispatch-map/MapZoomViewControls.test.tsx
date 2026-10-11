
import React from 'react';
import {screen, fireEvent, act} from '@testing-library/react';
import {setupUser} from '../../../__testUtils__/setupUser';
import {MapZoomViewControls} from './MapZoomViewControls';
import type {MapZoomViewControlsHandle} from './MapZoomViewControls';
import {renderWithMantine as renderWithTheme} from '../../../__testUtils__';
import {ColorModeContext} from '../../../hooks/useColorMode';

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
        ...(includeTraffic ? {vector: {traffic: {map: {id: 'traffic-layer'}, litenight: {id: 'traffic-night-layer'}}}} : {}),
        raster: {
            normal: {base: {id: 'roadmap-layer'}, basenight: {id: 'roadmap-night-layer'}},
            satellite: {map: {id: 'satellite-layer'}},
            terrain: {map: {id: 'terrain-layer'}},
        },
    };
}

const inMode = (mode: 'light' | 'dark', ui: React.ReactElement) => (
    <ColorModeContext.Provider value={{mode, preference: mode, setPreference: jest.fn()}}>{ui}</ColorModeContext.Provider>
);

describe('MapZoomViewControls', () => {
    describe('map theme picker', () => {
        beforeEach(() => window.localStorage.clear());

        it('pins the map dark while the app is light, and tints its surfaces', async () => {
            const user = setupUser();
            const el = document.createElement('div');
            const map = {...createMockMap(), getElement: () => el};
            renderWithTheme(<ColorModeContext.Provider value={{mode: 'light', preference: 'light', setPreference: jest.fn()}}>
                <MapZoomViewControls map={map} platform={null} defaultLayers={createMockLayers()}/>
            </ColorModeContext.Provider>);
            expect(el.dataset.mapTheme).toBe('light');
            expect(el.style.getPropertyValue('--map-surface')).toBe('#ffffff');

            await user.click(screen.getByLabelText('Map theme'));
            await user.click(await screen.findByText('Dark'));

            expect(map.setBaseLayer).toHaveBeenLastCalledWith({id: 'roadmap-night-layer'});
            expect(el.dataset.mapTheme).toBe('dark');
            expect(el.style.getPropertyValue('--map-surface')).not.toBe('#ffffff');
        });

        it('pins the map light while the app is dark, and can return to matching the app', async () => {
            const user = setupUser();
            const map = createMockMap();
            renderWithTheme(<ColorModeContext.Provider value={{mode: 'dark', preference: 'dark', setPreference: jest.fn()}}>
                <MapZoomViewControls map={map} platform={null} defaultLayers={createMockLayers()}/>
            </ColorModeContext.Provider>);

            await user.click(screen.getByLabelText('Map theme'));
            await user.click(await screen.findByText('Light'));
            expect(map.setBaseLayer).toHaveBeenLastCalledWith({id: 'roadmap-layer'});

            await user.click(screen.getByLabelText('Map theme'));
            await user.click(await screen.findByText('Match app'));
            expect(map.setBaseLayer).toHaveBeenLastCalledWith({id: 'roadmap-night-layer'});
        });

        it('can be hidden', () => {
            renderWithTheme(<MapZoomViewControls map={createMockMap()} platform={null} defaultLayers={createMockLayers()} showThemePicker={false}/>);
            expect(screen.queryByLabelText('Map theme')).not.toBeInTheDocument();
        });
    });

    describe('dark mode', () => {
        beforeEach(() => window.localStorage.clear());

        it('uses the night roadmap layer when the app is dark, and leaves light maps untouched', () => {
            const light = createMockMap();
            const {unmount} = renderWithTheme(inMode('light',
                <MapZoomViewControls map={light} platform={null} defaultLayers={createMockLayers()}/>));
            expect(light.setBaseLayer).not.toHaveBeenCalled();
            unmount();

            const dark = createMockMap();
            renderWithTheme(inMode('dark',
                <MapZoomViewControls map={dark} platform={null} defaultLayers={createMockLayers()}/>));
            expect(dark.setBaseLayer).toHaveBeenCalledWith({id: 'roadmap-night-layer'});
        });

        it('swaps the roadmap layer live when the mode changes', () => {
            const map = createMockMap();
            const layers = createMockLayers();
            const el = (mode: 'light' | 'dark') => inMode(mode,
                <MapZoomViewControls map={map} platform={null} defaultLayers={layers}/>);
            const {rerender} = renderWithTheme(el('dark'));
            map.setBaseLayer.mockClear();

            rerender(el('light'));
            expect(map.setBaseLayer).toHaveBeenLastCalledWith({id: 'roadmap-layer'});
        });

        it('keeps satellite when dark, and returns to the night roadmap from the view menu', async () => {
            const user = setupUser();
            const map = createMockMap();
            renderWithTheme(inMode('dark',
                <MapZoomViewControls map={map} platform={null} defaultLayers={createMockLayers()}/>));

            await user.click(screen.getByLabelText('Choose view'));
            await user.click(await screen.findByText('Satellite'));
            expect(map.setBaseLayer).toHaveBeenLastCalledWith({id: 'satellite-layer'});

            await user.click(screen.getByLabelText('Choose view'));
            await user.click(await screen.findByText('Roadmap'));
            expect(map.setBaseLayer).toHaveBeenLastCalledWith({id: 'roadmap-night-layer'});
        });

        it('falls back to the day roadmap when the SDK has no night layer', () => {
            const map = createMockMap();
            const layers = createMockLayers();
            delete (layers.raster.normal as any).basenight;
            renderWithTheme(inMode('dark', <MapZoomViewControls map={map} platform={null} defaultLayers={layers}/>));

            expect(map.setBaseLayer).not.toHaveBeenCalled();
        });
    });

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
        expect(map.addLayer).toHaveBeenCalledWith(layers.vector!.traffic.map);
        expect(trafficBtn).toHaveAttribute('data-active', 'true');

        fireEvent.click(trafficBtn);
        expect(map.removeLayer).toHaveBeenCalledWith(layers.vector!.traffic.map);
        expect(trafficBtn).toHaveAttribute('data-active', 'false');
    });

    it('uses the night traffic layer when the app is dark and swaps it live when the mode changes', () => {
        const map = createMockMap();
        const layers = createMockLayers();
        const {rerender} = renderWithTheme(inMode('dark', <MapZoomViewControls map={map} platform={null} defaultLayers={layers}/>));

        fireEvent.click(screen.getByLabelText('Toggle traffic conditions'));
        expect(map.addLayer).toHaveBeenCalledWith(layers.vector!.traffic.litenight);

        rerender(inMode('light', <MapZoomViewControls map={map} platform={null} defaultLayers={layers}/>));
        expect(map.removeLayer).toHaveBeenCalledWith(layers.vector!.traffic.litenight);
        expect(map.addLayer).toHaveBeenLastCalledWith(layers.vector!.traffic.map);
    });

    it('does not offer a separate incidents toggle, and warns when the SDK has no traffic layer', () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        const map = createMockMap();
        renderWithTheme(<MapZoomViewControls map={map} platform={null} defaultLayers={createMockLayers({includeTraffic: false})}/>);

        expect(screen.queryByLabelText('Toggle traffic incidents')).not.toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Toggle traffic conditions'));

        expect(map.addLayer).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
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
            expect(map.addLayer).toHaveBeenCalledWith(layers.vector!.traffic.map);
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
            expect(map.addLayer).toHaveBeenCalledWith(layers.vector!.traffic.map);
            expect(screen.getByLabelText('Toggle traffic conditions')).toHaveAttribute('data-active', 'true');

            act(() => ref.current?.setTrafficEnabled(false));
            expect(map.removeLayer).toHaveBeenCalledWith(layers.vector!.traffic.map);
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
