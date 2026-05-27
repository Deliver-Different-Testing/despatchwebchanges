/**
 * DashboardSettingsDialog Component Tests
 *
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    DashboardBox,
    DashboardSettingsConfig,
    DashboardSettingsDialog,
    DashboardSettingsDialogProps,
    RefreshOption,
} from './DashboardSettingsDialog';
import {createProps, renderWithTheme} from '../../../__testUtils__';

const mockRefreshOptions: RefreshOption[] = [
    {id: 0, text: 'Disabled'},
    {id: 30, text: '30 seconds'},
    {id: 60, text: '1 minute'},
    {id: 300, text: '5 minutes'},
];

const mockBoxes: Record<string, DashboardBox> = {
    pendingJobs: {name: 'pendingJobs', title: 'Pending Jobs', description: 'Shows all pending jobs', visible: true},
    activeJobs: {name: 'activeJobs', title: 'Active Jobs', description: 'Shows active jobs in progress', visible: true},
    completedJobs: {
        name: 'completedJobs',
        title: 'Completed Jobs',
        description: 'Shows completed jobs',
        visible: false
    },
};

const mockConfig: DashboardSettingsConfig = {
    title: 'Dashboard Settings',
    showRefreshInterval: true,
    showDriverLocationRefresh: true,
    showDashboards: true,
};

const defaultProps: DashboardSettingsDialogProps = {
    open: true,
    config: mockConfig,
    boxes: mockBoxes,
    selectedRefreshInterval: mockRefreshOptions[1],
    selectedDriverLocationRefreshInterval: mockRefreshOptions[2],
    refreshOptions: mockRefreshOptions,
    onClose: jest.fn(),
    onSave: jest.fn(),
};

const createMockProps = (overrides?: Partial<DashboardSettingsDialogProps>) =>
    createProps(defaultProps, overrides);

describe('DashboardSettingsDialog', () => {
    // ── Default render (single render for all read-only checks) ─────
    describe('Default render', () => {
        it('renders dialog with all sections, panels, switches and refresh options', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps()} />);

            // Dialog chrome
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Dashboard Settings')).toBeInTheDocument();
            expect(screen.getByText('Configure your dashboard preferences')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            expect(screen.getByRole('button', {name: /save/i})).toBeInTheDocument();

            // Auto-Refresh section
            expect(screen.getByText('Auto-Refresh')).toBeInTheDocument();
            expect(screen.getByText('Job List')).toBeInTheDocument();
            expect(screen.getByText('How often the job list refreshes')).toBeInTheDocument();
            expect(screen.getByText('30 seconds')).toBeInTheDocument();
            expect(screen.getByText('Driver Locations')).toBeInTheDocument();
            expect(screen.getByText('How often the map updates')).toBeInTheDocument();

            // Dashboard Panels section
            expect(screen.getByText('Dashboard Panels')).toBeInTheDocument();
            expect(screen.getByText('Pending Jobs')).toBeInTheDocument();
            expect(screen.getByText('Active Jobs')).toBeInTheDocument();
            expect(screen.getByText('Completed Jobs')).toBeInTheDocument();
            expect(screen.getByText('Shows all pending jobs')).toBeInTheDocument();
            expect(screen.getByText('Shows active jobs in progress')).toBeInTheDocument();
            expect(screen.getByText('Shows completed jobs')).toBeInTheDocument();
            expect(screen.getByText(/toggle panels to show or hide/i)).toBeInTheDocument();

            // Switches
            const switches = screen.getAllByRole('switch');
            expect(switches.length).toBeGreaterThanOrEqual(3);
            const checkedSwitches = switches.filter(s => (s as HTMLInputElement).checked);
            expect(checkedSwitches.length).toBeGreaterThanOrEqual(2);
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
            expect(screen.queryByText('Auto-Refresh')).not.toBeInTheDocument();
        });

        it('hides Driver Locations when showDriverLocationRefresh is false', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({
                config: {
                    ...mockConfig,
                    showDriverLocationRefresh: false
                }
            })} />);
            expect(screen.queryByText('Driver Locations')).not.toBeInTheDocument();
        });

        it('shows empty state when showDashboards is false', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({
                config: {
                    ...mockConfig,
                    showDashboards: false
                }
            })} />);
            expect(screen.getByText(/panel visibility requires a custom layout/i)).toBeInTheDocument();
        });
    });

    // ── Toggle Box Visibility ───────────────────────────────────────
    describe('Toggle Box Visibility', () => {
        it('toggles via switch and via row click', async () => {
            const user = userEvent.setup();
            renderWithTheme(<DashboardSettingsDialog {...createMockProps()} />);

            const pendingJobsRow = screen.getByText('Pending Jobs').closest('div[class*="Paper"]') as HTMLElement;
            const toggle = within(pendingJobsRow).getByRole('switch');

            const initialState = (toggle as HTMLInputElement).checked;
            await user.click(toggle);
            expect((toggle as HTMLInputElement).checked).toBe(!initialState);

            // Toggle back via row click
            await user.click(pendingJobsRow);
            expect((toggle as HTMLInputElement).checked).toBe(initialState);
        });
    });

    // ── Refresh Interval Selection ──────────────────────────────────
    describe('Refresh Interval Selection', () => {
        it('allows changing job list refresh interval', async () => {
            const user = userEvent.setup();
            renderWithTheme(<DashboardSettingsDialog {...createMockProps()} />);

            const jobListSection = screen.getByText('Job List').closest('div');
            const select = within(jobListSection!.parentElement!).getByRole('combobox');

            await user.click(select);
            await user.click(screen.getByText('5 minutes'));
            expect(screen.getByText('5 minutes')).toBeInTheDocument();
        });
    });

    // ── Close / Save ────────────────────────────────────────────────
    describe('Close Functionality', () => {
        it('calls onClose when close button or Cancel is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({onClose})} />);

            await user.click(screen.getByRole('button', {name: ''}));
            expect(onClose).toHaveBeenCalledTimes(1);

            onClose.mockClear();
            await user.click(screen.getByRole('button', {name: /cancel/i}));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Save Functionality', () => {
        it('calls onSave with current settings including toggled box visibility', async () => {
            const user = userEvent.setup();
            const onSave = jest.fn();
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({onSave})} />);

            // Toggle a box first
            const pendingJobsRow = screen.getByText('Pending Jobs').closest('div[class*="Paper"]');
            await user.click(pendingJobsRow!);

            await user.click(screen.getByRole('button', {name: /save/i}));

            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    selectedRefreshInterval: expect.any(Object),
                    selectedDriverLocationRefreshInterval: expect.any(Object),
                    boxes: expect.objectContaining({
                        pendingJobs: expect.objectContaining({visible: false}),
                    }),
                })
            );
        });
    });

    // ── Default Values ──────────────────────────────────────────────
    describe('Default Values', () => {
        it('uses Disabled as default for missing intervals', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({
                selectedRefreshInterval: undefined,
                selectedDriverLocationRefreshInterval: undefined,
            })} />);

            const driverSection = screen.getByText('Driver Locations').closest('div');
            expect(within(driverSection!.parentElement!).getByText('Disabled')).toBeInTheDocument();
        });
    });

    // ── Edge Cases ──────────────────────────────────────────────────
    describe('Edge Cases', () => {
        it('renders without error when boxes is empty', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({boxes: {}})} />);
            expect(screen.getByText('Dashboard Panels')).toBeInTheDocument();
        });

        it('displays name when title is not provided', () => {
            renderWithTheme(<DashboardSettingsDialog {...createMockProps({
                boxes: {myPanel: {name: 'My Panel Name', visible: true}},
            })} />);
            expect(screen.getByText('My Panel Name')).toBeInTheDocument();
        });
    });
});
