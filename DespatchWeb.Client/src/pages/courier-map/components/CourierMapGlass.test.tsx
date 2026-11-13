import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithMantine} from '../../../test/utils';
import {DriversPanel} from './DriversPanel';
import {MapControls} from './MapControls';
import {MapZoomViewControls} from '../../../components/common/dispatch-map/MapZoomViewControls';
import {MapControlButtons} from '../../../components/common/dispatch-map/MapControlButtons';
import type {DriversPanelProps, MapControlsProps} from '../CourierMapPage.types';

vi.mock('../../../hooks/glassSupport', async () => ({
    ...(await vi.importActual<typeof import('../../../hooks/glassSupport')>('../../../hooks/glassSupport')),
    isLiquidGlassSupported: () => true,
}));

const panelProps = {
    drivers: [],
    totalActiveDrivers: 0,
    isLoading: false,
    searchInputValue: '',
    searchTerm: '',
    onSearchChange: vi.fn(),
    onDriverClick: vi.fn(),
    isPanelHidden: false,
    onTogglePanel: vi.fn(),
    fleetOptions: [],
    isFleetOptionsLoading: false,
    selectedFleetIds: [],
    onSelectedFleetIdsChange: vi.fn(),
} as unknown as DriversPanelProps;

const controlsProps = {
    onFitAll: vi.fn(),
    onRefresh: vi.fn(),
    isLoading: false,
    displaySettings: {},
    onDisplaySettingsChange: vi.fn(),
} as unknown as MapControlsProps;

describe('Courier map liquid glass', () => {
    it('frosts the zoom/view rail and the dispatch rail', () => {
        renderWithMantine(
            <>
                <MapZoomViewControls map={null} platform={null} defaultLayers={null}/>
                <MapControlButtons
                    controlState={{autoZoomEnabled: false, couriersOnlyEnabled: false, urgentArmyOnlyEnabled: false, couriersLargeViewEnabled: false}}
                    onToggleAutoZoom={vi.fn()}
                    onToggleCouriersOnly={vi.fn()}
                    onToggleUrgentArmyOnly={vi.fn()}
                    onToggleCouriersLargeView={vi.fn()}
                />
            </>,
        );
        const railOf = (name: string) => screen.getByRole('button', {name}).closest('.mantine-Paper-root');

        expect(railOf('Zoom in')).toHaveClass('dfrnt-glass', 'dfrnt-glass-panel');
        expect(railOf('Toggle auto zoom')).toHaveClass('dfrnt-glass', 'dfrnt-glass-panel');
    });

    it('frosts the drivers card and map controls, but not the driver list', () => {
        renderWithMantine(<><DriversPanel {...panelProps}/><MapControls {...controlsProps}/></>);

        expect(screen.getByRole('button', {name: 'Toggle drivers panel'}).parentElement).toHaveClass('dfrnt-glass', 'dfrnt-glass-panel');
        expect(screen.getByRole('button', {name: 'Refresh data'}).closest('.mantine-Paper-root')).toHaveClass('dfrnt-glass', 'dfrnt-glass-panel');
        const list = screen.getByText('No active drivers').closest('[style*="overflow-y"]') as HTMLElement;
        expect(list).toBeTruthy();
        expect(list).not.toHaveClass('dfrnt-glass');
        expect(list.style.backgroundColor).toBe('var(--mantine-color-body)');
    });
});
