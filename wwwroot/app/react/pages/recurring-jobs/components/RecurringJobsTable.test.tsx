/**
 * RecurringJobsTable Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {fireEvent, screen} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {RecurringJobsTable, RecurringJobsTableProps} from './RecurringJobsTable';
import {PrebookListModel} from '../../../interfaces';
import dayjs from 'dayjs';


const renderWithTheme = (ui: React.ReactElement) => {
    return renderWithMantine(ui);
};

const createMockAddress = (line1: string, line2: string, full: string) => ({
    addressLine1: line1,
    addressLine2: line2,
    addressLine3: '',
    addressLine4: '',
    addressLine5: '',
    addressLine6: '',
    addressLine7: '',
    addressLine8: '',
    fullAddress: full,
});

const createMockJob = (id: number, client: string = 'Test Client'): PrebookListModel => ({
    id,
    booked: dayjs('2024-01-15T10:30:00'),
    nextDueTime: dayjs('2024-01-16T09:00:00'),
    client,
    jobNo: `JOB${id}`,
    clientId: 100 + id,
    courier: 'John Courier',
    speed: 'Standard',
    customJobName: `Job Name ${id}`,
    pickupAddress: createMockAddress('123 Pickup St', 'Floor 1', '123 Pickup St, London'),
    deliveryAddress: createMockAddress('456 Delivery Ave', 'Suite 200', '456 Delivery Ave, Manchester'),
});

const defaultProps: RecurringJobsTableProps = {
    jobs: [],
    isLoading: false,
    totalCount: 0,
    page: 1,
    pageSize: 50,
    sort: {column: 'booked', direction: 'asc'},
    selectedJobId: null,
    isUsCustomer: false,
    onPageChange: jest.fn(),
    onPageSizeChange: jest.fn(),
    onSortChange: jest.fn(),
    onRowClick: jest.fn(),
    onDeleteClick: jest.fn(),
    onContextMenu: jest.fn(),
};

describe('RecurringJobsTable', () => {
    describe('Empty state', () => {
        it('should show empty message when no jobs', () => {
            renderWithTheme(<RecurringJobsTable {...defaultProps} />);

            expect(screen.getByText('No recurring jobs available')).toBeInTheDocument();
        });
    });

    describe('Loading state', () => {
        it('should show loading indicator', () => {
            renderWithTheme(<RecurringJobsTable {...defaultProps} isLoading={true}/>);

            expect(screen.getByText('Loading recurring jobs...')).toBeInTheDocument();
        });
    });

    it('should render all column headers and job data', () => {
        const jobs = [createMockJob(1)];
        renderWithTheme(<RecurringJobsTable {...defaultProps} jobs={jobs} totalCount={1}/>);

        // Column headers
        expect(screen.getByText('Booked')).toBeInTheDocument();
        expect(screen.getByText('Speed')).toBeInTheDocument();
        expect(screen.getByText('Job Name')).toBeInTheDocument();
        expect(screen.getByText('Client')).toBeInTheDocument();
        expect(screen.getByText('From')).toBeInTheDocument();
        expect(screen.getByText('To')).toBeInTheDocument();
        expect(screen.getByText('Next Due')).toBeInTheDocument();
        expect(screen.getByText('Courier')).toBeInTheDocument();

        // Job data - client, speed, custom name, pickup address, delivery address, courier
        expect(screen.getByText('Test Client')).toBeInTheDocument();
        expect(screen.getByText('Standard')).toBeInTheDocument();
        expect(screen.getByText('Job Name 1')).toBeInTheDocument();
        expect(screen.getByText('123 Pickup St')).toBeInTheDocument();
        expect(screen.getByText('456 Delivery Ave')).toBeInTheDocument();
        expect(screen.getByText('John Courier')).toBeInTheDocument();
    });

    describe('Row interactions', () => {
        it('should call onRowClick, onDeleteClick and onContextMenu for row actions', () => {
            const onRowClick = jest.fn();
            const onDeleteClick = jest.fn();
            const onContextMenu = jest.fn();
            const jobs = [createMockJob(1)];
            renderWithTheme(
                <RecurringJobsTable
                    {...defaultProps}
                    jobs={jobs}
                    totalCount={1}
                    onRowClick={onRowClick}
                    onDeleteClick={onDeleteClick}
                    onContextMenu={onContextMenu}
                />
            );

            // Row click
            fireEvent.click(screen.getByText('Test Client').closest('tr')!);
            expect(onRowClick).toHaveBeenCalledTimes(1);
            expect(onRowClick).toHaveBeenCalledWith(jobs[0]);

            // Deactivate button click
            const deactivateButton = screen.getByRole('button', {name: 'Deactivate'});
            fireEvent.click(deactivateButton);
            expect(onDeleteClick).toHaveBeenCalledTimes(1);
            expect(onDeleteClick).toHaveBeenCalledWith(jobs[0]);

            // Context menu
            fireEvent.contextMenu(screen.getByText('Test Client').closest('tr')!);
            expect(onContextMenu).toHaveBeenCalledTimes(1);
        });
    });

    describe('Sorting', () => {
        it('should call onSortChange when clicking sortable column', () => {
            const onSortChange = jest.fn();
            const jobs = [createMockJob(1)];
            renderWithTheme(
                <RecurringJobsTable {...defaultProps} jobs={jobs} totalCount={1} onSortChange={onSortChange}/>
            );

            fireEvent.click(screen.getByText('Client'));

            expect(onSortChange).toHaveBeenCalledWith({column: 'client', direction: 'asc'});
        });

        it('should toggle sort direction on second click', () => {
            const onSortChange = jest.fn();
            const jobs = [createMockJob(1)];
            renderWithTheme(
                <RecurringJobsTable
                    {...defaultProps}
                    jobs={jobs}
                    totalCount={1}
                    onSortChange={onSortChange}
                    sort={{column: 'client', direction: 'asc'}}
                />
            );

            fireEvent.click(screen.getByText('Client'));

            expect(onSortChange).toHaveBeenCalledWith({column: 'client', direction: 'desc'});
        });
    });

    describe('Pagination', () => {
        it('should show pagination controls', () => {
            const jobs = [createMockJob(1)];
            renderWithTheme(
                <RecurringJobsTable {...defaultProps} jobs={jobs} totalCount={100}/>
            );

            expect(screen.getByText(/of 100/)).toBeInTheDocument();
        });

        it('should call onPageSizeChange when changing rows per page', () => {
            const onPageSizeChange = jest.fn();
            const jobs = [createMockJob(1)];
            renderWithTheme(
                <RecurringJobsTable {...defaultProps} jobs={jobs} totalCount={100} onPageSizeChange={onPageSizeChange}/>
            );

            const select = screen.getByRole('combobox');
            fireEvent.mouseDown(select);
            const option25 = screen.getByText('25');
            fireEvent.click(option25);

            expect(onPageSizeChange).toHaveBeenCalledWith(25);
        });
    });

    describe('Selection', () => {
        it('should highlight selected row', () => {
            const jobs = [createMockJob(1), createMockJob(2)];
            renderWithTheme(
                <RecurringJobsTable {...defaultProps} jobs={jobs} totalCount={2} selectedJobId={1}/>
            );

            // DataTable stamps data-selected rather than relying on a generated
            // class, so the assertion checks the state reached the DOM and that the
            // other row did not pick it up.
            const selectedRow = screen.getByText('Job Name 1').closest('tr');
            const otherRow = screen.getByText('Job Name 2').closest('tr');
            expect(selectedRow).toHaveAttribute('data-selected', 'true');
            expect(otherRow).toHaveAttribute('data-selected', 'false');
        });
    });
});
