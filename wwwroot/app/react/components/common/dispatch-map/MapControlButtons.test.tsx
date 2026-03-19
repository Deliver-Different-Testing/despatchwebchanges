/** @jest-environment jest-environment-jsdom */
/**
 * MapControlButtons Component Tests
 *
 * Tests for the map control buttons component.
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {MapControlButtons} from './MapControlButtons';
import type {MapControlButtonsProps, MapControlState} from './DispatchMap.types';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

const createDefaultControlState = (overrides?: Partial<MapControlState>): MapControlState => ({
    autoZoomEnabled: true,
    couriersOnlyEnabled: false,
    urgentArmyOnlyEnabled: false,
    couriersLargeViewEnabled: false,
    ...overrides,
});

const createDefaultProps = (overrides?: Partial<MapControlButtonsProps>): MapControlButtonsProps => ({
    controlState: createDefaultControlState(),
    onToggleAutoZoom: jest.fn(),
    onToggleCouriersOnly: jest.fn(),
    onToggleUrgentArmyOnly: jest.fn(),
    onToggleCouriersLargeView: jest.fn(),
    ...overrides,
});

describe('MapControlButtons Component', () => {
    describe('Rendering', () => {
        it('renders all four control buttons', () => {
            const props = createDefaultProps();
            renderWithTheme(<MapControlButtons {...props} />);

            expect(screen.getByLabelText('Toggle Auto Zoom')).toBeInTheDocument();
            expect(screen.getByLabelText('Toggle Couriers Only')).toBeInTheDocument();
            expect(screen.getByLabelText('Toggle Urgent Army Filter')).toBeInTheDocument();
            expect(screen.getByLabelText('Toggle Couriers Large View')).toBeInTheDocument();
        });

        it('renders buttons with correct tooltips when inactive', async () => {
            const props = createDefaultProps({
                controlState: createDefaultControlState({
                    autoZoomEnabled: false,
                    couriersOnlyEnabled: false,
                    urgentArmyOnlyEnabled: false,
                    couriersLargeViewEnabled: false,
                }),
            });
            renderWithTheme(<MapControlButtons {...props} />);

            // Buttons should exist
            expect(screen.getByLabelText('Toggle Auto Zoom')).toBeInTheDocument();
            expect(screen.getByLabelText('Toggle Couriers Only')).toBeInTheDocument();
            expect(screen.getByLabelText('Toggle Urgent Army Filter')).toBeInTheDocument();
            expect(screen.getByLabelText('Toggle Couriers Large View')).toBeInTheDocument();
        });
    });

    describe('Button Click Handlers', () => {
        it('calls onToggleAutoZoom when auto zoom button is clicked', () => {
            const onToggleAutoZoom = jest.fn();
            const props = createDefaultProps({onToggleAutoZoom});
            renderWithTheme(<MapControlButtons {...props} />);

            fireEvent.click(screen.getByLabelText('Toggle Auto Zoom'));

            expect(onToggleAutoZoom).toHaveBeenCalledTimes(1);
        });

        it('calls onToggleCouriersOnly when couriers only button is clicked', () => {
            const onToggleCouriersOnly = jest.fn();
            const props = createDefaultProps({onToggleCouriersOnly});
            renderWithTheme(<MapControlButtons {...props} />);

            fireEvent.click(screen.getByLabelText('Toggle Couriers Only'));

            expect(onToggleCouriersOnly).toHaveBeenCalledTimes(1);
        });

        it('calls onToggleUrgentArmyOnly when urgent army button is clicked', () => {
            const onToggleUrgentArmyOnly = jest.fn();
            const props = createDefaultProps({onToggleUrgentArmyOnly});
            renderWithTheme(<MapControlButtons {...props} />);

            fireEvent.click(screen.getByLabelText('Toggle Urgent Army Filter'));

            expect(onToggleUrgentArmyOnly).toHaveBeenCalledTimes(1);
        });

        it('calls onToggleCouriersLargeView when large view button is clicked', () => {
            const onToggleCouriersLargeView = jest.fn();
            const props = createDefaultProps({onToggleCouriersLargeView});
            renderWithTheme(<MapControlButtons {...props} />);

            fireEvent.click(screen.getByLabelText('Toggle Couriers Large View'));

            expect(onToggleCouriersLargeView).toHaveBeenCalledTimes(1);
        });
    });

    describe('Disabled State', () => {
        it('disables couriers only button when large view is enabled', () => {
            const props = createDefaultProps({
                controlState: createDefaultControlState({couriersLargeViewEnabled: true}),
            });
            renderWithTheme(<MapControlButtons {...props} />);

            const button = screen.getByLabelText('Toggle Couriers Only');
            expect(button).toBeDisabled();
        });

        it('disables urgent army button when large view is enabled', () => {
            const props = createDefaultProps({
                controlState: createDefaultControlState({couriersLargeViewEnabled: true}),
            });
            renderWithTheme(<MapControlButtons {...props} />);

            const button = screen.getByLabelText('Toggle Urgent Army Filter');
            expect(button).toBeDisabled();
        });

        it('does not disable auto zoom button when large view is enabled', () => {
            const props = createDefaultProps({
                controlState: createDefaultControlState({couriersLargeViewEnabled: true}),
            });
            renderWithTheme(<MapControlButtons {...props} />);

            const button = screen.getByLabelText('Toggle Auto Zoom');
            expect(button).not.toBeDisabled();
        });

        it('does not disable large view button when large view is enabled', () => {
            const props = createDefaultProps({
                controlState: createDefaultControlState({couriersLargeViewEnabled: true}),
            });
            renderWithTheme(<MapControlButtons {...props} />);

            const button = screen.getByLabelText('Toggle Couriers Large View');
            expect(button).not.toBeDisabled();
        });
    });

    describe('Active State Visual Feedback', () => {
        it('renders auto zoom button with active state when enabled', () => {
            const props = createDefaultProps({
                controlState: createDefaultControlState({autoZoomEnabled: true}),
            });
            renderWithTheme(<MapControlButtons {...props} />);

            const button = screen.getByLabelText('Toggle Auto Zoom');
            expect(button).toHaveAttribute('data-active', 'true');
        });

        it('renders auto zoom button with inactive state when disabled', () => {
            const props = createDefaultProps({
                controlState: createDefaultControlState({autoZoomEnabled: false}),
            });
            renderWithTheme(<MapControlButtons {...props} />);

            const button = screen.getByLabelText('Toggle Auto Zoom');
            expect(button).toHaveAttribute('data-active', 'false');
        });

        it('renders couriers only button with active state when enabled', () => {
            const props = createDefaultProps({
                controlState: createDefaultControlState({couriersOnlyEnabled: true}),
            });
            renderWithTheme(<MapControlButtons {...props} />);

            const button = screen.getByLabelText('Toggle Couriers Only');
            expect(button).toHaveAttribute('data-active', 'true');
        });

        it('renders urgent army button with active state when enabled', () => {
            const props = createDefaultProps({
                controlState: createDefaultControlState({urgentArmyOnlyEnabled: true}),
            });
            renderWithTheme(<MapControlButtons {...props} />);

            const button = screen.getByLabelText('Toggle Urgent Army Filter');
            expect(button).toHaveAttribute('data-active', 'true');
        });

        it('renders large view button with active state when enabled', () => {
            const props = createDefaultProps({
                controlState: createDefaultControlState({couriersLargeViewEnabled: true}),
            });
            renderWithTheme(<MapControlButtons {...props} />);

            const button = screen.getByLabelText('Toggle Couriers Large View');
            expect(button).toHaveAttribute('data-active', 'true');
        });
    });

    describe('Icon Display', () => {
        it('displays correct icon for auto zoom based on state', () => {
            const {rerender} = renderWithTheme(
                <MapControlButtons
                    {...createDefaultProps({
                        controlState: createDefaultControlState({autoZoomEnabled: true}),
                    })}
                />
            );

            // When enabled, should show fit_screen icon
            expect(screen.getByText('fit_screen')).toBeInTheDocument();

            rerender(
                <ThemeProvider theme={theme}>
                    <MapControlButtons
                        {...createDefaultProps({
                            controlState: createDefaultControlState({autoZoomEnabled: false}),
                        })}
                    />
                </ThemeProvider>
            );

            // When disabled, should show zoom_out_map icon
            expect(screen.getByText('zoom_out_map')).toBeInTheDocument();
        });

        it('displays correct icon for couriers only based on state', () => {
            const {rerender} = renderWithTheme(
                <MapControlButtons
                    {...createDefaultProps({
                        controlState: createDefaultControlState({couriersOnlyEnabled: true}),
                    })}
                />
            );

            expect(screen.getByText('local_shipping')).toBeInTheDocument();

            rerender(
                <ThemeProvider theme={theme}>
                    <MapControlButtons
                        {...createDefaultProps({
                            controlState: createDefaultControlState({couriersOnlyEnabled: false}),
                        })}
                    />
                </ThemeProvider>
            );

            expect(screen.getByText('map')).toBeInTheDocument();
        });

        it('displays correct icon for urgent army based on state', () => {
            const {rerender} = renderWithTheme(
                <MapControlButtons
                    {...createDefaultProps({
                        controlState: createDefaultControlState({urgentArmyOnlyEnabled: true}),
                    })}
                />
            );

            expect(screen.getByText('emergency')).toBeInTheDocument();

            rerender(
                <ThemeProvider theme={theme}>
                    <MapControlButtons
                        {...createDefaultProps({
                            controlState: createDefaultControlState({urgentArmyOnlyEnabled: false}),
                        })}
                    />
                </ThemeProvider>
            );

            expect(screen.getByText('visibility_off')).toBeInTheDocument();
        });

        it('displays correct icon for large view based on state', () => {
            const {rerender} = renderWithTheme(
                <MapControlButtons
                    {...createDefaultProps({
                        controlState: createDefaultControlState({couriersLargeViewEnabled: true}),
                    })}
                />
            );

            expect(screen.getByText('fullscreen')).toBeInTheDocument();

            rerender(
                <ThemeProvider theme={theme}>
                    <MapControlButtons
                        {...createDefaultProps({
                            controlState: createDefaultControlState({couriersLargeViewEnabled: false}),
                        })}
                    />
                </ThemeProvider>
            );

            expect(screen.getByText('fullscreen_exit')).toBeInTheDocument();
        });
    });
});
