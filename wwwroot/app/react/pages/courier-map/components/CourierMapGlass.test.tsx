import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {DriversPanel} from './DriversPanel';
import {MapControls} from './MapControls';
import {MapZoomViewControls} from '../../../components/common/dispatch-map/MapZoomViewControls';
import {MapControlButtons} from '../../../components/common/dispatch-map/MapControlButtons';
import type {DriversPanelProps, MapControlsProps} from '../CourierMapPage.types';

jest.mock('../../../theme/glass.module.css', () => ({__esModule: true, default: {glass: 'glass-mock', panel: 'panel-mock'}}));

const panelProps = {
    drivers: [],
    totalActiveDrivers: 0,
    isLoading: false,
    searchInputValue: '',
    searchTerm: '',
    onSearchChange: jest.fn(),
    onDriverClick: jest.fn(),
    isPanelHidden: false,
    onTogglePanel: jest.fn(),
    fleetOptions: [],
    isFleetOptionsLoading: false,
    selectedFleetIds: [],
    onSelectedFleetIdsChange: jest.fn(),
} as unknown as DriversPanelProps;

const controlsProps = {
    onFitAll: jest.fn(),
    onRefresh: jest.fn(),
    isLoading: false,
    displaySettings: {},
    onDisplaySettingsChange: jest.fn(),
} as unknown as MapControlsProps;

describe('Courier Map liquid glass', () => {
    afterEach(() => localStorage.clear());

    it('leaves the drivers card and map controls plain while Liquid Glass is off (the default)', () => {
        renderWithMantine(<><DriversPanel {...panelProps}/><MapControls {...controlsProps}/></>);
        expect(screen.getByRole('button', {name: 'Toggle drivers panel'}).parentElement).not.toHaveClass('glass-mock');
        expect(screen.getByRole('button', {name: 'Refresh data'}).closest('.mantine-Paper-root')).not.toHaveClass('glass-mock');
    });

    it('frosts the zoom/view rail and the dispatch rail only when on', () => {
        const rails = () => renderWithMantine(
            <>
                <MapZoomViewControls map={null} platform={null} defaultLayers={null}/>
                <MapControlButtons
                    controlState={{autoZoomEnabled: false, couriersOnlyEnabled: false, urgentArmyOnlyEnabled: false, couriersLargeViewEnabled: false}}
                    onToggleAutoZoom={jest.fn()}
                    onToggleCouriersOnly={jest.fn()}
                    onToggleUrgentArmyOnly={jest.fn()}
                    onToggleCouriersLargeView={jest.fn()}
                />
            </>,
        );
        const railOf = (name: string) => screen.getByRole('button', {name}).closest('.mantine-Paper-root');

        const off = rails();
        expect(railOf('Zoom in')).not.toHaveClass('glass-mock');
        expect(railOf('Toggle Auto Zoom')).not.toHaveClass('glass-mock');
        off.unmount();

        localStorage.setItem('dd-liquid-glass', 'on');
        rails();
        expect(railOf('Zoom in')).toHaveClass('glass-mock', 'panel-mock');
        expect(railOf('Toggle Auto Zoom')).toHaveClass('glass-mock', 'panel-mock');
    });

    it('frosts the drivers card and map controls when on, but not the driver list', () => {
        localStorage.setItem('dd-liquid-glass', 'on');
        renderWithMantine(<><DriversPanel {...panelProps}/><MapControls {...controlsProps}/></>);

        expect(screen.getByRole('button', {name: 'Toggle drivers panel'}).parentElement).toHaveClass('glass-mock', 'panel-mock');
        expect(screen.getByRole('button', {name: 'Refresh data'}).closest('.mantine-Paper-root')).toHaveClass('glass-mock', 'panel-mock');
        const list = screen.getByText('No active drivers').closest('[style*="overflow-y"]') as HTMLElement;
        expect(list).toBeTruthy();
        expect(list).not.toHaveClass('glass-mock');
        expect(list.style.backgroundColor).toBe('var(--mantine-color-body)');
    });
});
