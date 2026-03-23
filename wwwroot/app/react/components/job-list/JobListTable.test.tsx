/** @jest-environment jest-environment-jsdom */
/**
 * JobListTable Tests
 */

import React from 'react';
import {act, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {renderWithTheme} from '../../__testUtils__';
import {JobListTable} from './JobListTable';
import type {DensityMode, DispatchJob, JobListSort} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';
import dayjs from 'dayjs';
import {searchActiveCouriersExtended} from '../../services/courierApi';
import {suggestCouriers} from '../../services/aiAssistantApi';
import {isAiEnabled} from '../../../functions/aiSettings';

jest.mock('../../services/courierApi', () => ({
    searchActiveCouriersExtended: jest.fn(),
}));
jest.mock('../../services/aiAssistantApi', () => ({
    suggestCouriers: jest.fn(),
}));
jest.mock('../../../functions/aiSettings', () => ({
    isAiEnabled: jest.fn().mockReturnValue(false),
}));
jest.mock('../../utils/dateUtils', () => ({
    formatMins: jest.fn((d: any) => d?.format?.('HH:mm') || ''),
    formatShortDate: jest.fn((d: any) => d?.format?.('DD/MMM') || ''),
    getIanaTimezone: jest.fn(() => 'Pacific/Auckland'),
    getTenantTimezone: jest.fn(() => 'New Zealand Standard Time'),
    getTimezoneAbbreviation: jest.fn(() => 'NZST'),
}));

const mockedSearch = searchActiveCouriersExtended as jest.Mock;
const mockedSuggestCouriers = suggestCouriers as jest.Mock;
const mockedIsAiEnabled = isAiEnabled as jest.Mock;

function createMockDispatchJob(overrides?: Partial<DispatchJob>): DispatchJob {
    return {
        angularId: 'job-1',
        id: 1,
        jobNo: 'J001',
        hasBeenRead: true,
        showCourierSearch: false,
        isParentOrSingle: true,
        parentId: 0,
        isFlightJob: false,
        isAgentJob: false,
        isBulkJob: false,
        isArchived: false,
        statusId: 0,
        statusName: 'New',
        status: 'New',
        booked: dayjs('2025-03-15T09:00:00'),
        time: dayjs('2025-03-15T17:00:00'),
        remain: 120,
        courierSearchLoading: false,
        pickupAddress: {
            addressLine1: '', addressLine2: '', addressLine3: '10',
            addressLine4: 'Queen St', addressLine5: 'Auckland CBD',
            addressLine6: 'Auckland', addressLine7: '1010', addressLine8: '',
            fullAddress: '10 Queen St, Auckland',
        } as any,
        deliveryAddress: {
            addressLine1: '', addressLine2: '', addressLine3: '20',
            addressLine4: 'High St', addressLine5: 'Newmarket',
            addressLine6: 'Auckland', addressLine7: '1023', addressLine8: '',
            fullAddress: '20 High St, Auckland',
        } as any,
        speed: 'Standard',
        vehicle: {id: 1, text: 'Car'},
        client: 'Test Client',
        pickUpTimeZone: {id: 1, text: 'NZST'},
        deliveryTimeZone: {id: 1, text: 'NZST'},
        ...overrides,
    } as DispatchJob;
}

function createDefaultProps(overrides?: Partial<React.ComponentProps<typeof JobListTable>>) {
    return {
        jobs: [createMockDispatchJob()],
        selectedJobId: null,
        relatedJobIds: new Set<number>(),
        onJobClick: jest.fn(),
        onContextMenu: jest.fn(),
        onJobDispatch: jest.fn(),
        onColumnWidthsChange: jest.fn(),
        sortState: {column: null, direction: null} as JobListSort,
        onSortChange: jest.fn(),
        densityMode: 'dense' as DensityMode,
        columnWidths: {},
        isUsCustomer: false,
        appPage: AppPage.Dispatch,
        isJobSearchPage: false,
        ...overrides,
    };
}

describe('JobListTable', () => {
    beforeEach(() => {
        mockedSearch.mockResolvedValue([]);
        mockedSuggestCouriers.mockResolvedValue({couriers: [], summary: '', usage: {inputTokens: 0, outputTokens: 0}});
        mockedIsAiEnabled.mockReturnValue(false);
    });

    it('renders empty state, headers, job data, resize handles, and column visibility', () => {
        // Empty state
        const {unmount: u1} = renderWithTheme(<JobListTable {...createDefaultProps({jobs: []})}/>);
        expect(screen.getByText('No jobs to display')).toBeInTheDocument();
        u1();

        // Full render with data
        const {unmount: u2} = renderWithTheme(<JobListTable {...createDefaultProps()}/>);
        // Headers
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Time')).toBeInTheDocument();
        expect(screen.getByText('Speed')).toBeInTheDocument();
        expect(screen.getByText('Job No')).toBeInTheDocument();
        expect(screen.getByText('Courier')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Client')).toBeInTheDocument();
        // Job data
        expect(screen.getByText('J001')).toBeInTheDocument();
        expect(screen.getByText('New')).toBeInTheDocument();
        expect(screen.getByText('Standard')).toBeInTheDocument();
        // No Archived column when not job search page
        expect(screen.queryByText('Archived')).not.toBeInTheDocument();
        // Resize handles
        expect(screen.getByTestId('resize-handle-priority')).toBeInTheDocument();
        expect(screen.getByTestId('resize-handle-date')).toBeInTheDocument();
        expect(screen.getByTestId('resize-handle-jobNo')).toBeInTheDocument();
        expect(screen.getByTestId('resize-handle-courier')).toBeInTheDocument();
        expect(screen.getByTestId('resize-handle-remaining')).toBeInTheDocument();
        expect(screen.queryByTestId('resize-handle-status')).not.toBeInTheDocument();
        u2();

        // US customer hides Client, job search page shows Archived
        renderWithTheme(<JobListTable {...createDefaultProps({isUsCustomer: true, isJobSearchPage: true})}/>);
        expect(screen.queryByText('Client')).not.toBeInTheDocument();
        expect(screen.getByText('Archived')).toBeInTheDocument();
    });

    it('fires onJobClick, onContextMenu, and onSortChange on interaction', async () => {
        const user = userEvent.setup();
        const props = createDefaultProps();
        renderWithTheme(<JobListTable {...props}/>);

        await user.click(screen.getByText('J001'));
        expect(props.onJobClick).toHaveBeenCalledWith(expect.objectContaining({id: 1}), expect.any(Object));

        const row = screen.getByText('J001').closest('tr')!;
        await user.pointer({target: row, keys: '[MouseRight]'});
        expect(props.onContextMenu).toHaveBeenCalled();

        await user.click(screen.getByText('Job No'));
        expect(props.onSortChange).toHaveBeenCalledWith('jobNo');
    });

    it('renders courier name, flight number, agent name, and US-specific format', () => {
        const jobs = [
            createMockDispatchJob({
                id: 1, jobNo: 'J001',
                assignedCourier: {id: 10, text: 'John Smith'},
                courierData: {courier: 'JS01', courierName: 'John Smith', courierNumber: '101'},
            }),
            createMockDispatchJob({
                id: 2, jobNo: 'J002',
                assignedFlight: {
                    flightNumber: 'NZ123',
                    departureTimeZone: 'Pacific/Auckland',
                    arrivalTimeZone: 'Australia/Sydney',
                    notes: ''
                },
            }),
            createMockDispatchJob({
                id: 3, jobNo: 'J003',
                assignedAgent: {
                    agentId: 5, agentName: 'Agent Corp',
                    agentRate: 100, agentRanking: 'A', agentNotes: ''
                },
            }),
        ];
        const {unmount} = renderWithTheme(<JobListTable {...createDefaultProps({jobs})}/>);
        expect(screen.getByText('JS01 - John Smith')).toBeInTheDocument();
        expect(screen.getByText('NZ123')).toBeInTheDocument();
        expect(screen.getByText('Agent Corp')).toBeInTheDocument();
        unmount();

        // US customer format
        const usJob = createMockDispatchJob({
            assignedCourier: {id: 10, text: 'John Smith'},
            courierData: {courier: 'JS01', courierName: 'John Smith', courierNumber: '101'},
        });
        renderWithTheme(<JobListTable {...createDefaultProps({jobs: [usJob], isUsCustomer: true})}/>);
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('JS01')).toBeInTheDocument();
    });

    it('shows Assign button on Dispatch/JobSearch but not Domestic, and not for flight/agent jobs', () => {
        const job = createMockDispatchJob();

        // Dispatch page
        const {unmount: u1} = renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job], appPage: AppPage.Dispatch})}/>);
        expect(screen.getByText('Assign')).toBeInTheDocument();
        u1();

        // JobSearch page
        const {unmount: u2} = renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job], appPage: AppPage.JobSearch})}/>);
        expect(screen.getByText('Assign')).toBeInTheDocument();
        u2();

        // Domestic page
        const {unmount: u3} = renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job], appPage: AppPage.Domestic})}/>);
        expect(screen.queryByText('Assign')).not.toBeInTheDocument();
        u3();

        // Flight/agent assigned jobs
        const flightAgentJobs = [
            createMockDispatchJob({
                id: 1, jobNo: 'J001',
                assignedFlight: {flightNumber: 'NZ999', departureTimeZone: 'Pacific/Auckland', arrivalTimeZone: 'Australia/Sydney', notes: ''},
            }),
            createMockDispatchJob({
                id: 2, jobNo: 'J002',
                assignedAgent: {agentId: 5, agentName: 'Agent Corp', agentRate: 100, agentRanking: 'A', agentNotes: ''},
            }),
        ];
        renderWithTheme(<JobListTable {...createDefaultProps({jobs: flightAgentJobs})}/>);
        expect(screen.queryByText('Assign')).not.toBeInTheDocument();
    });

    describe('Courier Autocomplete Search', () => {
        beforeEach(() => { jest.useFakeTimers(); });
        afterEach(() => { jest.useRealTimers(); });

        it('shows autocomplete, calls search, passes dgOnly for DG jobs, and dispatches on selection', async () => {
            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            mockedSearch.mockResolvedValue([{id: 42, text: '101 - John Smith'}]);

            const props = createDefaultProps();
            renderWithTheme(<JobListTable {...props}/>);

            await user.click(screen.getByText('Assign'));
            expect(screen.getByPlaceholderText('Search courier...')).toBeInTheDocument();

            await user.click(screen.getByPlaceholderText('Search courier...'));
            await user.paste('John');

            // Flush 300ms courier search debounce
            await act(async () => { jest.advanceTimersByTime(300); });

            await waitFor(() => {
                expect(mockedSearch).toHaveBeenCalledWith('John', expect.objectContaining({signal: expect.any(AbortSignal)}));
            });

            const option = await screen.findByText('101 - John Smith');
            await user.click(option);
            expect(props.onJobDispatch).toHaveBeenCalledWith(expect.objectContaining({id: 1}), 42, '101 - John Smith');
        });

        it('passes dgOnly=true for DG jobs', async () => {
            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            mockedSearch.mockResolvedValue([]);

            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [createMockDispatchJob({dgClass: 3})]})}/>);

            await user.click(screen.getByText('Assign'));
            await user.click(screen.getByPlaceholderText('Search courier...'));
            await user.paste('test');

            // Flush 300ms courier search debounce
            await act(async () => { jest.advanceTimersByTime(300); });

            await waitFor(() => {
                expect(mockedSearch).toHaveBeenCalledWith('test', expect.objectContaining({dgOnly: true}));
            });
        });
    });

    it('fetches and displays AI suggestions when enabled, skips when disabled', async () => {
        const user = userEvent.setup();
        mockedIsAiEnabled.mockReturnValue(true);
        mockedSuggestCouriers.mockResolvedValue({
            couriers: [{courierId: 99, code: 'AI01', firstName: 'AI Courier'}],
            summary: '',
            usage: {inputTokens: 0, outputTokens: 0},
        });

        const {unmount} = renderWithTheme(<JobListTable {...createDefaultProps()}/>);
        await user.click(screen.getByText('Assign'));

        await waitFor(() => {
            expect(mockedSuggestCouriers).toHaveBeenCalledWith(1);
        });
        expect(await screen.findByText('AI01 - AI Courier')).toBeInTheDocument();
        unmount();

        // Disabled
        mockedIsAiEnabled.mockReturnValue(false);
        mockedSuggestCouriers.mockClear();
        renderWithTheme(<JobListTable {...createDefaultProps()}/>);
        await user.click(screen.getByText('Assign'));

        await waitFor(() => {
            expect(mockedSuggestCouriers).not.toHaveBeenCalled();
        });
    });

    it('renders multiple rows', () => {
        const jobs = [
            createMockDispatchJob({id: 1, jobNo: 'J001'}),
            createMockDispatchJob({id: 2, jobNo: 'J002'}),
            createMockDispatchJob({id: 3, jobNo: 'J003'}),
        ];
        renderWithTheme(<JobListTable {...createDefaultProps({jobs})}/>);

        expect(screen.getByText('J001')).toBeInTheDocument();
        expect(screen.getByText('J002')).toBeInTheDocument();
        expect(screen.getByText('J003')).toBeInTheDocument();
    });

    it('handles column resize: no sort on handle click, updates width on drag, enforces 50px minimum', () => {
        const props = createDefaultProps({columnWidths: {jobNo: 130}});
        const {unmount: u1} = renderWithTheme(<JobListTable {...props}/>);

        const handle = screen.getByTestId('resize-handle-jobNo');

        // No sort on resize handle mousedown
        handle.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 100}));
        expect(props.onSortChange).not.toHaveBeenCalled();

        // Drag updates width
        handle.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 200}));
        document.dispatchEvent(new MouseEvent('mousemove', {clientX: 250}));
        document.dispatchEvent(new MouseEvent('mouseup', {clientX: 250}));
        expect(props.onColumnWidthsChange).toHaveBeenCalledWith(expect.objectContaining({jobNo: 180}));
        u1();

        // Minimum width enforcement
        const props2 = createDefaultProps({columnWidths: {jobNo: 80}});
        renderWithTheme(<JobListTable {...props2}/>);
        const handle2 = screen.getByTestId('resize-handle-jobNo');
        handle2.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 200}));
        document.dispatchEvent(new MouseEvent('mousemove', {clientX: 50}));
        document.dispatchEvent(new MouseEvent('mouseup', {clientX: 50}));
        expect(props2.onColumnWidthsChange).toHaveBeenCalledWith(expect.objectContaining({jobNo: 50}));
    });
});
