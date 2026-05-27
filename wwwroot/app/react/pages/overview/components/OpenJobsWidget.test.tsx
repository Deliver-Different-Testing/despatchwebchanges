import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {OpenJobsWidget} from './OpenJobsWidget';
import type {IOpenJobResponse} from '../OverviewPage.interfaces';

// Mock formatMins
jest.mock('../../../utils/dateUtils', () => ({
    formatMins: jest.fn((s: string) => s),
}));

const theme = createTheme();

// ContactID is defined as 0 in setup.ts — the localStorage keys will use that
const VIEW_MODE_KEY = 'openJobsViewMode_0';
const LIMIT_KEY = 'openJobsTableViewLimit0';

const renderWithTheme = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

function createMockOpenJob(overrides: Partial<IOpenJobResponse> = {}): IOpenJobResponse {
    return {
        jobId: 1,
        reference: 'JOB-001',
        status: 'New',
        pickupTime: '2024-01-15T10:00:00',
        pickupName: 'Warehouse A',
        pickupAddress: '123 Main St',
        deliveryTime: '2024-01-15T14:00:00',
        deliveryName: 'Office B',
        deliveryAddress: '456 High St',
        driverName: 'John Smith',
        completedToday: 5,
        lastCompleted: '13:00',
        quantity: 2,
        packageType: 'Parcel',
        mileage: 15,
        _pickUpTimeStr: '15 Jan 2024 10:00',
        _deliveryTimeStr: '15 Jan 2024 14:00',
        ...overrides,
    };
}

describe('OpenJobsWidget', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('Header', () => {
        it('renders Open Jobs title', () => {
            renderWithTheme(<OpenJobsWidget openJobs={[]} isLoading={false} />);
            expect(screen.getByText('Open Jobs')).toBeInTheDocument();
        });

        it('renders view mode toggle', () => {
            renderWithTheme(<OpenJobsWidget openJobs={[]} isLoading={false} />);
            expect(screen.getByRole('switch')).toBeInTheDocument();
        });
    });

    describe('Empty state', () => {
        it('shows empty state when no open jobs', () => {
            renderWithTheme(<OpenJobsWidget openJobs={[]} isLoading={false} />);
            expect(screen.getByText('No open jobs match your current filter criteria')).toBeInTheDocument();
        });

        it('does not show empty state while loading', () => {
            renderWithTheme(<OpenJobsWidget openJobs={[]} isLoading />);
            expect(screen.queryByText('No open jobs match your current filter criteria')).not.toBeInTheDocument();
        });
    });

    describe('Card view (default)', () => {
        it('groups jobs by driver', () => {
            const jobs = [
                createMockOpenJob({jobId: 1, reference: 'JOB-001', driverName: 'John'}),
                createMockOpenJob({jobId: 2, reference: 'JOB-002', driverName: 'John'}),
                createMockOpenJob({jobId: 3, reference: 'JOB-003', driverName: 'Jane'}),
            ];

            renderWithTheme(<OpenJobsWidget openJobs={jobs} isLoading={false} />);

            expect(screen.getByText('John')).toBeInTheDocument();
            expect(screen.getByText('Jane')).toBeInTheDocument();
            expect(screen.getByText('(2 open jobs)')).toBeInTheDocument();
            expect(screen.getByText('(1 open jobs)')).toBeInTheDocument();
        });

        it('shows completed today count', () => {
            const jobs = [createMockOpenJob({completedToday: 5})];
            renderWithTheme(<OpenJobsWidget openJobs={jobs} isLoading={false} />);
            expect(screen.getByText('5 completed today')).toBeInTheDocument();
        });

        it('expands driver card to show jobs when clicked', () => {
            const jobs = [createMockOpenJob()];
            renderWithTheme(<OpenJobsWidget openJobs={jobs} isLoading={false} />);

            // Click on driver header to expand
            fireEvent.click(screen.getByText('John Smith'));

            // Job details should be visible
            expect(screen.getByText('JOB-001')).toBeInTheDocument();
        });
    });

    describe('Table view', () => {
        it('shows table when toggled to table view', () => {
            const jobs = [createMockOpenJob()];
            renderWithTheme(<OpenJobsWidget openJobs={jobs} isLoading={false} />);

            // Toggle to table view
            const toggle = screen.getByRole('switch');
            fireEvent.click(toggle);

            // Table headers should appear
            expect(screen.getByText('Job Number')).toBeInTheDocument();
            expect(screen.getByText('Driver')).toBeInTheDocument();
            expect(screen.getByText('Status')).toBeInTheDocument();
        });

        it('renders job data in table rows', () => {
            localStorage.setItem(VIEW_MODE_KEY, 'table');

            const jobs = [createMockOpenJob()];
            renderWithTheme(<OpenJobsWidget openJobs={jobs} isLoading={false} />);

            expect(screen.getByText('JOB-001')).toBeInTheDocument();
            expect(screen.getByText('John Smith')).toBeInTheDocument();
        });

        it('renders pagination in table view', () => {
            localStorage.setItem(VIEW_MODE_KEY, 'table');

            const jobs = Array.from({length: 8}, (_, i) =>
                createMockOpenJob({jobId: i + 1, reference: `JOB-${i + 1}`}),
            );

            renderWithTheme(<OpenJobsWidget openJobs={jobs} isLoading={false} />);

            // Default limit is 5, so pagination should show
            expect(screen.getByText(/1.+5 of 8/)).toBeInTheDocument();
        });
    });

    describe('Collapse behavior', () => {
        it('saves collapsed state to localStorage when toggled', () => {
            renderWithTheme(<OpenJobsWidget openJobs={[]} isLoading={false} />);

            // The collapse button is the IconButton in the toolbar
            const collapseButton = screen.getByText('expand_less').closest('button')!;
            fireEvent.click(collapseButton);

            // Verify state was persisted
            const saved = JSON.parse(localStorage.getItem('cardCollapseStates') ?? '{}');
            expect(saved.openJobs).toBe(true);
        });
    });

    describe('LocalStorage persistence', () => {
        it('saves view mode to localStorage', () => {
            renderWithTheme(<OpenJobsWidget openJobs={[]} isLoading={false} />);

            const toggle = screen.getByRole('switch');
            fireEvent.click(toggle);

            expect(localStorage.getItem(VIEW_MODE_KEY)).toBe('table');
        });

        it('restores view mode from localStorage', () => {
            localStorage.setItem(VIEW_MODE_KEY, 'table');

            const jobs = [createMockOpenJob()];
            renderWithTheme(<OpenJobsWidget openJobs={jobs} isLoading={false} />);

            // Table headers should be visible since we restored table mode
            expect(screen.getByText('Job Number')).toBeInTheDocument();
        });
    });
});
