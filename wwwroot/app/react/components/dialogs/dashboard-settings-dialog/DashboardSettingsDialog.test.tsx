/**
 * DashboardSettingsDialog Component Tests
 */

import React from 'react';
import {screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    DashboardSettingsDialog,
    DashboardSettingsDialogProps,
    DashboardSettingsConfig,
    DashboardBox,
    RefreshOption,
} from './DashboardSettingsDialog';
import {renderWithTheme, createProps} from '../../../__testUtils__';

const mockRefreshOptions: RefreshOption[] = [
    {id: 0, text: 'Disabled'},
    {id: 30, text: '30 seconds'},
    {id: 60, text: '1 minute'},
    {id: 300, text: '5 minutes'},
];

const mockBoxes: Record<string, DashboardBox> = {
    pendingJobs: {
        name: 'pendingJobs',
        title: 'Pending Jobs',
        description: 'Shows all pending jobs',
        visible: true,
    },
    activeJobs: {
        name: 'activeJobs',
        title: 'Active Jobs',
        description: 'Shows active jobs in progress',
        visible: true,
    },
    completedJobs: {
        name: 'completedJobs',
        title: 'Completed Jobs',
        description: 'Shows completed jobs',
        visible: false,
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
    selectedRefreshInterval: mockRefreshOptions[1], // 30 seconds
    selectedDriverLocationRefreshInterval: mockRefreshOptions[2], // 1 minute
    refreshOptions: mockRefreshOptions,
    onClose: jest.fn(),
    onSave: jest.fn(),
};

const createMockProps = (overrides?: Partial<DashboardSettingsDialogProps>) =>
    createProps(defaultProps, overrides);

describe('DashboardSettingsDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders dialog when open is true', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('does not render dialog when open is false', () => {
            const props = createMockProps({open: false});
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('displays title from config', () => {
            const props = createMockProps({
                config: {...mockConfig, title: 'My Dashboard Settings'},
            });
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('My Dashboard Settings')).toBeInTheDocument();
        });

        it('displays subtitle text', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('Configure your dashboard preferences')).toBeInTheDocument();
        });

        it('displays Cancel button', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
        });

        it('displays Save button', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByRole('button', {name: /save/i})).toBeInTheDocument();
        });
    });

    describe('Auto-Refresh Section', () => {
        it('displays Auto-Refresh section when showRefreshInterval is true', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('Auto-Refresh')).toBeInTheDocument();
        });

        it('does not display Auto-Refresh section when showRefreshInterval is false', () => {
            const props = createMockProps({
                config: {...mockConfig, showRefreshInterval: false},
            });
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.queryByText('Auto-Refresh')).not.toBeInTheDocument();
        });

        it('displays Job List refresh option', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('Job List')).toBeInTheDocument();
            expect(screen.getByText('How often the job list refreshes')).toBeInTheDocument();
        });

        it('displays selected refresh interval value', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('30 seconds')).toBeInTheDocument();
        });

        it('displays Driver Locations when showDriverLocationRefresh is true', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('Driver Locations')).toBeInTheDocument();
            expect(screen.getByText('How often the map updates')).toBeInTheDocument();
        });

        it('does not display Driver Locations when showDriverLocationRefresh is false', () => {
            const props = createMockProps({
                config: {...mockConfig, showDriverLocationRefresh: false},
            });
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.queryByText('Driver Locations')).not.toBeInTheDocument();
        });
    });

    describe('Dashboard Panels Section', () => {
        it('displays Dashboard Panels section', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('Dashboard Panels')).toBeInTheDocument();
        });

        it('displays dashboard box titles', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('Pending Jobs')).toBeInTheDocument();
            expect(screen.getByText('Active Jobs')).toBeInTheDocument();
            expect(screen.getByText('Completed Jobs')).toBeInTheDocument();
        });

        it('displays dashboard box descriptions', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('Shows all pending jobs')).toBeInTheDocument();
            expect(screen.getByText('Shows active jobs in progress')).toBeInTheDocument();
            expect(screen.getByText('Shows completed jobs')).toBeInTheDocument();
        });

        it('shows toggle panels message when showDashboards is true', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText(/toggle panels to show or hide/i)).toBeInTheDocument();
        });

        it('shows empty state when showDashboards is false', () => {
            const props = createMockProps({
                config: {...mockConfig, showDashboards: false},
            });
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText(/panel visibility requires a custom layout/i)).toBeInTheDocument();
        });

        it('displays switches for each dashboard box', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            const switches = screen.getAllByRole('switch');
            expect(switches.length).toBeGreaterThanOrEqual(3);
        });

        it('toggles switch state reflects box visibility', () => {
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            // pendingJobs and activeJobs are visible, completedJobs is not
            const switches = screen.getAllByRole('switch');

            // At least some should be checked
            const checkedSwitches = switches.filter(s => (s as HTMLInputElement).checked);
            expect(checkedSwitches.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Toggle Box Visibility', () => {
        it('toggles box visibility when switch is clicked', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            const pendingJobsRow = screen.getByText('Pending Jobs').closest('div[class*="Paper"]') as HTMLElement;
            const toggle = within(pendingJobsRow).getByRole('switch');

            const initialState = (toggle as HTMLInputElement).checked;
            await user.click(toggle);

            expect((toggle as HTMLInputElement).checked).toBe(!initialState);
        });

        it('toggles box visibility when row is clicked', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            // Find the row with Paper styling
            const pendingJobsRow = screen.getByText('Pending Jobs').closest('div[class*="Paper"]') as HTMLElement;
            const toggle = within(pendingJobsRow).getByRole('switch');

            const initialState = (toggle as HTMLInputElement).checked;
            await user.click(pendingJobsRow);

            expect((toggle as HTMLInputElement).checked).toBe(!initialState);
        });
    });

    describe('Refresh Interval Selection', () => {
        it('allows changing job list refresh interval', async () => {
            const user = userEvent.setup();
            const props = createMockProps();
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            // Find the Job List select
            const jobListSection = screen.getByText('Job List').closest('div');
            const select = within(jobListSection!.parentElement!).getByRole('combobox');

            await user.click(select);
            await user.click(screen.getByText('5 minutes'));

            // Verify the selection changed
            expect(screen.getByText('5 minutes')).toBeInTheDocument();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            const closeButton = screen.getByRole('button', {name: ''});
            await user.click(closeButton);

            expect(onClose).toHaveBeenCalled();
        });

        it('calls onClose when Cancel button is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /cancel/i}));

            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Save Functionality', () => {
        it('calls onSave with current settings when Save is clicked', async () => {
            const user = userEvent.setup();
            const onSave = jest.fn();
            const props = createMockProps({onSave});
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /save/i}));

            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    selectedRefreshInterval: expect.any(Object),
                    selectedDriverLocationRefreshInterval: expect.any(Object),
                    boxes: expect.any(Object),
                })
            );
        });

        it('includes updated box visibility in onSave', async () => {
            const user = userEvent.setup();
            const onSave = jest.fn();
            const props = createMockProps({onSave});
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            // Toggle a box
            const pendingJobsRow = screen.getByText('Pending Jobs').closest('div[class*="Paper"]');
            await user.click(pendingJobsRow!);

            await user.click(screen.getByRole('button', {name: /save/i}));

            expect(onSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    boxes: expect.objectContaining({
                        pendingJobs: expect.objectContaining({
                            visible: false, // Was true, now false
                        }),
                    }),
                })
            );
        });
    });

    describe('Default Values', () => {
        it('uses default refresh interval when not provided', () => {
            const props = createMockProps({
                selectedRefreshInterval: undefined,
            });
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('Disabled')).toBeInTheDocument();
        });

        it('uses default driver location interval when not provided', () => {
            const props = createMockProps({
                selectedDriverLocationRefreshInterval: undefined,
            });
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            // Should show "Disabled" for driver location
            const driverSection = screen.getByText('Driver Locations').closest('div');
            expect(within(driverSection!.parentElement!).getByText('Disabled')).toBeInTheDocument();
        });
    });

    describe('Empty Boxes', () => {
        it('renders without error when boxes is empty', () => {
            const props = createMockProps({boxes: {}});
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('Dashboard Panels')).toBeInTheDocument();
        });
    });

    describe('Box Name Fallback', () => {
        it('displays name when title is not provided', () => {
            const boxesWithoutTitle: Record<string, DashboardBox> = {
                myPanel: {
                    name: 'My Panel Name',
                    visible: true,
                },
            };
            const props = createMockProps({boxes: boxesWithoutTitle});
            renderWithTheme(<DashboardSettingsDialog {...props} />);

            expect(screen.getByText('My Panel Name')).toBeInTheDocument();
        });
    });
});
