import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {DeliveriesTable} from './DeliveriesTable';
import type {OverviewTableParentJob, TableSort} from '../OverviewPage.interfaces';


const renderWithTheme = (ui: React.ReactElement) =>
    render(<MantineTestProvider>{ui}</MantineTestProvider>);

function createMockDelivery(overrides: Partial<OverviewTableParentJob> = {}): OverviewTableParentJob {
    return {
        jobId: 1,
        jobName: 'J-001',
        status: 'NEW',
        completion: 25,
        pickup: 'Warehouse A',
        delivery: 'Office B',
        driver: 'John Smith',
        region: 'London',
        childJobs: [],
        expanded: false,
        ...overrides,
    };
}

const defaultProps = {
    deliveries: [] as OverviewTableParentJob[],
    isLoading: false,
    sort: {column: 'jobName', direction: 'asc'} as TableSort,
    onSort: jest.fn(),
    page: 1,
    limit: 20,
    total: 0,
    onPageChange: jest.fn(),
    onLimitChange: jest.fn(),
    onShowMap: jest.fn(),
    onOpenJobDetail: jest.fn(),
    onToggleExpand: jest.fn(),
};

describe('DeliveriesTable', () => {
    describe('Empty state', () => {
        it('shows empty state message when no deliveries', () => {
            renderWithTheme(<DeliveriesTable {...defaultProps} />);

            expect(screen.getByText('No deliveries found')).toBeInTheDocument();
            expect(screen.getByText('Try adjusting your filters or date range.')).toBeInTheDocument();
        });

        it('does not show empty state while loading', () => {
            renderWithTheme(<DeliveriesTable {...defaultProps} isLoading />);

            expect(screen.queryByText('No deliveries found')).not.toBeInTheDocument();
        });
    });

    describe('Table rendering', () => {
        it('renders column headers', () => {
            renderWithTheme(<DeliveriesTable {...defaultProps} />);

            expect(screen.getByText('Job Number')).toBeInTheDocument();
            expect(screen.getByText('Status')).toBeInTheDocument();
            expect(screen.getByText('Completion')).toBeInTheDocument();
            expect(screen.getByText('Pickup')).toBeInTheDocument();
            expect(screen.getByText('Delivery')).toBeInTheDocument();
            expect(screen.getByText('Driver')).toBeInTheDocument();
            expect(screen.getByText('Region')).toBeInTheDocument();
            expect(screen.getByText('Actions')).toBeInTheDocument();
        });

        it('renders delivery data', () => {
            const delivery = createMockDelivery();
            renderWithTheme(
                <DeliveriesTable {...defaultProps} deliveries={[delivery]} total={1} />,
            );

            expect(screen.getByText('J-001')).toBeInTheDocument();
            expect(screen.getByText('NEW')).toBeInTheDocument();
            expect(screen.getByText('25%')).toBeInTheDocument();
            expect(screen.getByText('Warehouse A')).toBeInTheDocument();
            expect(screen.getByText('Office B')).toBeInTheDocument();
            expect(screen.getByText('John Smith')).toBeInTheDocument();
            expect(screen.getByText('London')).toBeInTheDocument();
        });

        it('renders multiple deliveries', () => {
            const deliveries = [
                createMockDelivery({jobId: 1, jobName: 'J-001'}),
                createMockDelivery({jobId: 2, jobName: 'J-002'}),
                createMockDelivery({jobId: 3, jobName: 'J-003'}),
            ];

            renderWithTheme(
                <DeliveriesTable {...defaultProps} deliveries={deliveries} total={3} />,
            );

            expect(screen.getByText('J-001')).toBeInTheDocument();
            expect(screen.getByText('J-002')).toBeInTheDocument();
            expect(screen.getByText('J-003')).toBeInTheDocument();
        });
    });

    describe('Status chip', () => {
        it('renders status with correct text', () => {
            const delivery = createMockDelivery({status: 'DESPATCHED'});
            renderWithTheme(
                <DeliveriesTable {...defaultProps} deliveries={[delivery]} total={1} />,
            );

            expect(screen.getByText('DESPATCHED')).toBeInTheDocument();
        });
    });

    describe('Sorting', () => {
        it('calls onSort when a sortable column header is clicked', () => {
            renderWithTheme(<DeliveriesTable {...defaultProps} />);

            fireEvent.click(screen.getByText('Job Number'));

            expect(defaultProps.onSort).toHaveBeenCalledWith({
                column: 'jobName',
                direction: 'desc', // toggled from current 'asc'
            });
        });

        it('sets direction to asc when clicking a different column', () => {
            renderWithTheme(
                <DeliveriesTable
                    {...defaultProps}
                    sort={{column: 'status', direction: 'asc'}}
                />,
            );

            fireEvent.click(screen.getByText('Job Number'));

            expect(defaultProps.onSort).toHaveBeenCalledWith({
                column: 'jobName',
                direction: 'asc',
            });
        });

        it('does not call onSort for non-sortable columns', () => {
            renderWithTheme(<DeliveriesTable {...defaultProps} />);

            fireEvent.click(screen.getByText('Actions'));

            expect(defaultProps.onSort).not.toHaveBeenCalled();
        });
    });

    describe('Expandable rows', () => {
        it('shows expand button when delivery has child jobs', () => {
            const delivery = createMockDelivery({
                childJobs: [
                    {jobId: 10, jobName: 'J-001-A', status: 'NEW', completion: 0, pickup: 'A', delivery: 'B', driver: 'X', region: 'Y'},
                ],
            });

            renderWithTheme(
                <DeliveriesTable {...defaultProps} deliveries={[delivery]} total={1} />,
            );

            // Find the expand button (collapsed row shows the "Expand child jobs" control)
            const expandButtons = screen.getAllByRole('button', {name: 'Expand child jobs'});
            expect(expandButtons.length).toBeGreaterThanOrEqual(1);
        });

        it('calls onToggleExpand when expand button is clicked', () => {
            const delivery = createMockDelivery({
                childJobs: [
                    {jobId: 10, jobName: 'J-001-A', status: 'NEW', completion: 0, pickup: 'A', delivery: 'B', driver: 'X', region: 'Y'},
                ],
            });

            renderWithTheme(
                <DeliveriesTable {...defaultProps} deliveries={[delivery]} total={1} />,
            );

            const expandButton = screen.getByRole('button', {name: 'Expand child jobs'});
            fireEvent.click(expandButton);

            expect(defaultProps.onToggleExpand).toHaveBeenCalledWith(1);
        });

        it('shows child jobs when expanded', () => {
            const delivery = createMockDelivery({
                expanded: true,
                childJobs: [
                    {jobId: 10, jobName: 'J-001-A', status: 'DESPATCHED', completion: 50, pickup: 'Sub A', delivery: 'Sub B', driver: 'Driver X', region: 'Region Y'},
                ],
            });

            renderWithTheme(
                <DeliveriesTable {...defaultProps} deliveries={[delivery]} total={1} />,
            );

            expect(screen.getByText('J-001-A')).toBeInTheDocument();
        });
    });

    describe('Actions', () => {
        it('calls onShowMap when map button is clicked', () => {
            const delivery = createMockDelivery();
            renderWithTheme(
                <DeliveriesTable {...defaultProps} deliveries={[delivery]} total={1} />,
            );

            const mapButton = screen.getByRole('button', {name: 'Open map'});
            fireEvent.click(mapButton);

            expect(defaultProps.onShowMap).toHaveBeenCalledWith(delivery);
        });

        it('calls onOpenJobDetail when view button is clicked', () => {
            const delivery = createMockDelivery();
            renderWithTheme(
                <DeliveriesTable {...defaultProps} deliveries={[delivery]} total={1} />,
            );

            const viewButton = screen.getByRole('button', {name: 'View job details'});
            fireEvent.click(viewButton);

            expect(defaultProps.onOpenJobDetail).toHaveBeenCalledWith(delivery);
        });
    });

    describe('Pagination', () => {
        it('renders pagination when total > 0', () => {
            renderWithTheme(
                <DeliveriesTable
                    {...defaultProps}
                    deliveries={[createMockDelivery()]}
                    total={50}
                    page={1}
                    limit={20}
                />,
            );

            // MUI TablePagination renders a component="div" with count info
            expect(screen.getByText(/of 50/)).toBeInTheDocument();
        });

        it('does not render pagination when total is 0', () => {
            renderWithTheme(<DeliveriesTable {...defaultProps} total={0} />);

            expect(screen.queryByText(/of \d+/)).not.toBeInTheDocument();
        });
    });

    describe('Loading state', () => {
        it('shows loading overlay when isLoading', () => {
            renderWithTheme(
                <DeliveriesTable {...defaultProps} isLoading deliveries={[createMockDelivery()]} total={1} />,
            );

            // The loading overlay contains a CircularProgress with role="progressbar"
            const progressbar = screen.getAllByRole('progressbar');
            expect(progressbar.length).toBeGreaterThanOrEqual(1);
        });
    });
});
