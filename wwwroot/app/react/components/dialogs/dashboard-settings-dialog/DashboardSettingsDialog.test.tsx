/**
 * DashboardSettingsDialog Component Tests
 *
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {screen} from '@testing-library/react';
import {
    DashboardSettingsConfig,
    DashboardSettingsDialog,
    DashboardSettingsDialogProps,
    RefreshOption,
} from './DashboardSettingsDialog';
import { createProps, renderWithMantine as renderWithTheme } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';

const mockRefreshOptions: RefreshOption[] = [
    {id: 0, text: 'Disabled'},
    {id: 30, text: '30 seconds'},
    {id: 60, text: '1 minute'},
    {id: 300, text: '5 minutes'},
];

const mockConfig: DashboardSettingsConfig = {
    title: 'Dashboard Settings',
    showRefreshInterval: true,
    showDriverLocationRefresh: true,
};

const defaultProps: DashboardSettingsDialogProps = {
    open: true,
    config: mockConfig,
    selectedRefreshInterval: mockRefreshOptions[1],
    selectedDriverLocationRefreshInterval: mockRefreshOptions[2],
    refreshOptions: mockRefreshOptions,
    onClose: jest.fn(),
    onSave: jest.fn(),
};

const createMockProps = (overrides?: Partial<DashboardSettingsDialogProps>) =>
    createProps(defaultProps, overrides);

describe('DashboardSettingsDialog', () => {
    // ── Dashboard panels — removed; visibility lives in Customize Panels ──
    describe('Dashboard panels', () => {
        it('renders no panels section, panel toggles or moved notice', () => {
            renderWithTheme(
                <DashboardSettingsDialog
                    {...createMockProps({config: {...mockConfig, showJobSearchBetaToggle: true}})}
                />,
            );

            expect(screen.queryByText('Dashboard panels')).not.toBeInTheDocument();
            expect(screen.queryByText(/Panel options have moved/)).not.toBeInTheDocument();
            expect(screen.queryByText(/choose which panels appear/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/panel visibility is only available/i)).not.toBeInTheDocument();
        });
    });

    // ── Section separators ──────────────────────────────────────────
    describe('Section separators', () => {
        it('renders dividers between sections only, never trailing', () => {
            const {unmount} = renderWithTheme(
                <DashboardSettingsDialog
                    {...createMockProps({
                        config: {title: 'Dashboard Settings'},
                    })}
                />,
            );
            expect(screen.queryAllByRole('separator')).toHaveLength(0);
            unmount();

            renderWithTheme(
                <DashboardSettingsDialog
                    {...createMockProps({
                        config: {...mockConfig, showDispatchBetaToggle: true},
                    })}
                />,
            );
            expect(screen.getAllByRole('separator')).toHaveLength(1);
        });
    });

    // ── Default render (single render for all read-only checks) ─────
    describe('Default render', () => {
        it('renders dialog with all sections, switches and refresh options', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps()} />);

            // Dialog chrome
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Dashboard Settings')).toBeInTheDocument();
            expect(screen.getByText('Choose how often your dashboard updates and which features are on')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /save/i})).toBeInTheDocument();

            // Auto-Refresh section
            expect(screen.getByText('Auto-refresh')).toBeInTheDocument();
            expect(screen.getByText('Job list')).toBeInTheDocument();
            expect(screen.getByText('How often the job list checks for new and updated jobs')).toBeInTheDocument();
            expect(screen.getByRole('combobox', {name: 'Job list'})).toHaveValue('30 seconds');
            expect(screen.getByText('Driver locations')).toBeInTheDocument();
            expect(screen.getByText('How often driver positions update on the map')).toBeInTheDocument();
        });
    });

    it('does not render dialog when open is false', () => {
        renderWithTheme(<DashboardSettingsDialog {...createMockProps({open: false})} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('displays custom title from config', () => {
        renderWithTheme(<DashboardSettingsDialog {...createMockProps({
            config: {
                ...mockConfig,
                title: 'My Dashboard Settings'
            }
        })} />);
        expect(screen.getByText('My Dashboard Settings')).toBeInTheDocument();
    });

    // ── Hidden sections ─────────────────────────────────────────────
    describe('Hidden sections', () => {
        it('hides Auto-Refresh when showRefreshInterval is false', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({
                config: {
                    ...mockConfig,
                    showRefreshInterval: false
                }
            })} />);
            expect(screen.queryByText('Auto-refresh')).not.toBeInTheDocument();
        });

        it('hides Driver Locations when showDriverLocationRefresh is false', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({
                config: {
                    ...mockConfig,
                    showDriverLocationRefresh: false
                }
            })} />);
            expect(screen.queryByText('Driver locations')).not.toBeInTheDocument();
        });
    });

    // ── Refresh Interval Selection ──────────────────────────────────
    describe('Refresh Interval Selection', () => {
        it('allows changing job list refresh interval', async () => {
            const user = setupUser();
            renderWithTheme(<DashboardSettingsDialog {...createMockProps()} />);

            const select = screen.getByRole('combobox', {name: 'Job list'});

            await user.click(select);
            await user.click(await screen.findByRole('option', {name: '5 minutes'}));
            // Assert against the combobox itself: once selected, "5 minutes" appears
            // both as the combobox value and (briefly) as the lingering menu option,
            // so a bare getByText('5 minutes') matches multiple elements on slow CI.
            expect(select).toHaveValue('5 minutes');
        });
    });

    // ── Tasks refresh (independent cadence) ─────────────────────────
    describe('Tasks refresh', () => {
        it('is hidden unless showTaskRefresh is set', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps()} />);
            expect(screen.queryByText('Tasks')).not.toBeInTheDocument();
            expect(
                screen.queryByText('How often the Tasks panel checks for new and updated tasks'),
            ).not.toBeInTheDocument();
        });

        it('renders its own dropdown and emits selectedTaskRefreshInterval on save', async () => {
            const user = setupUser();
            const onSave = jest.fn();
            renderWithTheme(
                <DashboardSettingsDialog
                    {...createMockProps({
                        config: {...mockConfig, showTaskRefresh: true},
                        selectedTaskRefreshInterval: mockRefreshOptions[0],
                        onSave,
                    })}
                />,
            );

            expect(screen.getByText('Tasks')).toBeInTheDocument();

            const select = screen.getByRole('combobox', {name: 'Tasks'});
            await user.click(select);
            await user.click(await screen.findByRole('option', {name: '1 minute'}));

            await user.click(screen.getByRole('button', {name: /save/i}));

            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    selectedTaskRefreshInterval: expect.objectContaining({id: 60}),
                }),
            );
        });
    });

    // ── Close / Save ────────────────────────────────────────────────
    describe('Close Functionality', () => {
        it('calls onClose when close button or Cancel is clicked', async () => {
            const user = setupUser();
            const onClose = jest.fn();
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({onClose})} />);

            await user.click(screen.getByRole('button', {name: /close dialog/i}));
            expect(onClose).toHaveBeenCalledTimes(1);

            onClose.mockClear();
            await user.click(screen.getByRole('button', {name: /cancel/i}));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Save Functionality', () => {
        it('calls onSave with the current settings and no boxes', async () => {
            const user = setupUser();
            const onSave = jest.fn();
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({onSave})} />);

            await user.click(screen.getByRole('button', {name: /save/i}));

            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    selectedRefreshInterval: expect.any(Object),
                    selectedDriverLocationRefreshInterval: expect.any(Object),
                })
            );
            expect(onSave.mock.calls[0][0]).not.toHaveProperty('boxes');
        });
    });

    // ── Default Values ──────────────────────────────────────────────
    describe('Default Values', () => {
        it('uses Disabled as default for missing intervals', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({
                selectedRefreshInterval: undefined,
                selectedDriverLocationRefreshInterval: undefined,
            })} />);

            expect(screen.getByRole('combobox', {name: 'Driver locations'})).toHaveValue('Disabled');
        });
    });

    // ── Dispatch version toggle ─────────────────────────────────────
    describe('Dispatch version toggle', () => {
        it('is hidden unless showDispatchBetaToggle is set', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps()} />);
            expect(screen.queryByText('Dispatch version')).not.toBeInTheDocument();
        });

        it('renders the toggle and emits dispatchBetaEnabled on save when enabled', async () => {
            const user = setupUser();
            const onSave = jest.fn();
            renderWithTheme(
                <DashboardSettingsDialog
                    {...createMockProps({
                        config: {...mockConfig, showDispatchBetaToggle: true},
                        dispatchBetaEnabled: false,
                        onSave,
                    })}
                />,
            );

            expect(screen.getByText('Dispatch version')).toBeInTheDocument();

            await user.click(screen.getByRole('switch', {name: 'Use the new Dispatch'}));
            await user.click(screen.getByRole('button', {name: /save/i}));

            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({dispatchBetaEnabled: true}),
            );
        });

        it('omits dispatchBetaEnabled from the result when the toggle is not shown', async () => {
            const user = setupUser();
            const onSave = jest.fn();
            renderWithTheme(
                <DashboardSettingsDialog {...createMockProps({onSave})} />,
            );

            await user.click(screen.getByRole('button', {name: /save/i}));

            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({dispatchBetaEnabled: undefined}),
            );
        });
    });
});
