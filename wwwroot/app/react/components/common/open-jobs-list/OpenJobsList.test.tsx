import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {OpenJobsList, OpenJobsListProps} from './OpenJobsList';
import type {IOpenJobResponse} from './OpenJobsList.types';

jest.mock('../../../utils/dateUtils', () => ({
    formatMins: jest.fn((s: string) => s),
}));

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

const baseProps: OpenJobsListProps = {
    openJobs: [],
    isLoading: false,
    viewMode: 'table',
    sort: {column: 'reference', direction: 'asc'},
    onSort: jest.fn(),
    page: 1,
    limit: 5,
    onPageChange: jest.fn(),
    onLimitChange: jest.fn(),
};

const renderList = (props: Partial<OpenJobsListProps> = {}) =>
    render(
        <MantineTestProvider>
            <OpenJobsList {...baseProps} {...props} />
        </MantineTestProvider>,
    );

describe('OpenJobsList', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    /*
     * This is the list body only. Its chrome — card, title, collapse, view toggle —
     * belongs to whatever hosts it, because a BoxShell panel already supplies all of
     * that and would otherwise double up.
     */
    it('renders no chrome of its own', () => {
        renderList({openJobs: [createMockOpenJob()]});

        expect(screen.queryByText('Open Jobs')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /Collapse|Expand open jobs/})).not.toBeInTheDocument();
        expect(screen.queryByRole('radio', {name: 'Cards'})).not.toBeInTheDocument();
    });

    it('renders the empty state when there is nothing to show', () => {
        renderList();

        expect(screen.getByText('No open jobs match your current filter criteria')).toBeInTheDocument();
    });

    it('renders the table rows in table mode', () => {
        renderList({openJobs: [createMockOpenJob(), createMockOpenJob({jobId: 2, reference: 'JOB-002'})]});

        expect(screen.getByText('JOB-001')).toBeInTheDocument();
        expect(screen.getByText('JOB-002')).toBeInTheDocument();
    });

    it('groups by driver in card mode', () => {
        renderList({
            viewMode: 'cards',
            openJobs: [
                createMockOpenJob(),
                createMockOpenJob({jobId: 2, reference: 'JOB-002', driverName: 'Jane Doe'}),
            ],
        });

        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    /*
     * Sort, page and page-size are the host's state: the Overview widget persists
     * them under its own keys and the Dispatch panel under different ones, so the
     * list must report and never own them.
     */
    it('reports a sort change instead of sorting itself', () => {
        const onSort = jest.fn();
        renderList({openJobs: [createMockOpenJob()], onSort});

        fireEvent.click(screen.getByRole('button', {name: /Driver/}));

        expect(onSort).toHaveBeenCalledWith({column: 'driverName', direction: 'asc'});
    });

    it('flips the direction when the active column is re-picked', () => {
        const onSort = jest.fn();
        renderList({
            openJobs: [createMockOpenJob()],
            sort: {column: 'reference', direction: 'asc'},
            onSort,
        });

        fireEvent.click(screen.getByRole('button', {name: /Job Number/}));

        expect(onSort).toHaveBeenCalledWith({column: 'reference', direction: 'desc'});
    });

    it('honours the sort it is given', () => {
        renderList({
            openJobs: [
                createMockOpenJob({jobId: 1, reference: 'JOB-002'}),
                createMockOpenJob({jobId: 2, reference: 'JOB-001'}),
            ],
            sort: {column: 'reference', direction: 'asc'},
        });

        const cells = screen.getAllByRole('cell').filter(c => c.textContent?.startsWith('JOB-'));
        expect(cells.map(c => c.textContent)).toEqual(['JOB-001', 'JOB-002']);
    });

    it('shows only the page it is given', () => {
        renderList({
            openJobs: [
                createMockOpenJob({jobId: 1, reference: 'JOB-001'}),
                createMockOpenJob({jobId: 2, reference: 'JOB-002'}),
            ],
            limit: 1,
            page: 2,
        });

        expect(screen.queryByText('JOB-001')).not.toBeInTheDocument();
        expect(screen.getByText('JOB-002')).toBeInTheDocument();
    });

    it('writes nothing to localStorage', () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem');
        renderList({openJobs: [createMockOpenJob()]});

        expect(setItem).not.toHaveBeenCalled();
        setItem.mockRestore();
    });

    it('selects a job from a table row when a handler is supplied', () => {
        const onSelectJob = jest.fn();
        renderList({openJobs: [createMockOpenJob({jobId: 42})], onSelectJob});

        fireEvent.click(screen.getByRole('button', {name: /Open job JOB-001/}));

        expect(onSelectJob).toHaveBeenCalledWith(42);
    });

    it('leaves rows inert when no select handler is supplied', () => {
        renderList({openJobs: [createMockOpenJob({jobId: 42})]});

        expect(screen.queryByRole('button', {name: /Open job JOB-001/})).not.toBeInTheDocument();
    });
});
