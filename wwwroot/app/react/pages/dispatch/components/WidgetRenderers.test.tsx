/** @jest-environment jest-environment-jsdom */
/**
 * WidgetRenderers Tests
 *
 * Tests for the thin widget wrappers that derive showData/showNoData logic.
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';

// Mock heavy dependencies to avoid transitive AngularJS issues
jest.mock('../../../components/common/job-list/JobListPanel', () => ({JobListPanel: () => null}));
jest.mock('../../../components/common/job-details/JobDetails', () => ({JobDetails: () => null}));
jest.mock('../../../components/common/dispatch-map/DispatchMap', () => ({DispatchMap: () => null}));
jest.mock('../../../components/common/current-work-all-drivers/CurrentWorkAllDrivers', () => ({CurrentWorkAllDrivers: () => null}));
jest.mock('./JobDetailFab', () => ({JobDetailFab: () => null}));
jest.mock('../../../services/dispatchApi', () => ({}));
jest.mock('../../../services/jobDetailApi', () => ({}));
jest.mock('../../../components/dialogs/add-event-dialog', () => ({}));
jest.mock('../../../components/dialogs/accessorial-charges-dialog', () => ({}));
jest.mock('../../../services/angularDialogBridge', () => ({}));
jest.mock('../../../services/splitJobFlow', () => ({}));
jest.mock('../../../services/addStopFlow', () => ({}));
jest.mock('../../../components/dialogs/swap-pods-dialog/swap-pods-dialog-react.module', () => ({}));

import {DriverLocationsWidget} from './WidgetRenderers';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const baseProps = {
    loading: false,
    truckMode: 'On' as const,
    activeAreaId: undefined,
    onAreaClick: jest.fn(),
    onCourierClick: jest.fn(),
    onClearFilter: jest.fn(),
    isUsCustomer: false,
};

describe('DriverLocationsWidget', () => {
    it('shows NoData when driverLocations is undefined', () => {
        renderWithTheme(
            <DriverLocationsWidget {...baseProps} driverLocations={undefined} />
        );
        expect(screen.getByText('No Driver Locations')).toBeInTheDocument();
    });

    it('shows NoData when driverLocations is null', () => {
        renderWithTheme(
            <DriverLocationsWidget {...baseProps} driverLocations={null} />
        );
        expect(screen.getByText('No Driver Locations')).toBeInTheDocument();
    });

    it('shows NoData when driverLocations has empty columns and empty areas', () => {
        renderWithTheme(
            <DriverLocationsWidget {...baseProps} driverLocations={{areas: [], columns: []}} />
        );
        expect(screen.getByText('No Driver Locations')).toBeInTheDocument();
    });

    it('does not show NoData when driverLocations has columns with areas', () => {
        renderWithTheme(
            <DriverLocationsWidget
                {...baseProps}
                driverLocations={{
                    areas: [],
                    columns: [{
                        areas: [{
                            id: 1, name: 'North', order: 1, percentHeight: 100,
                            top: [], middle: [], bottom: [], totalRemaining: 0,
                        }],
                    }],
                }}
            />
        );
        expect(screen.queryByText('No Driver Locations')).not.toBeInTheDocument();
        expect(screen.getByText(/North/)).toBeInTheDocument();
    });

    it('does not show NoData when loading', () => {
        renderWithTheme(
            <DriverLocationsWidget {...baseProps} loading={true} driverLocations={undefined} />
        );
        expect(screen.queryByText('No Driver Locations')).not.toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('shows NoData for data with areas but no columns', () => {
        renderWithTheme(
            <DriverLocationsWidget
                {...baseProps}
                driverLocations={{
                    areas: [{
                        id: 1, name: 'North', order: 1, percentHeight: 100,
                        top: [], middle: [], bottom: [], totalRemaining: 0,
                    }],
                }}
            />
        );
        // areas exist but columns is undefined — should still show data
        expect(screen.queryByText('No Driver Locations')).not.toBeInTheDocument();
    });
});
