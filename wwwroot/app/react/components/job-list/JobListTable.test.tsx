/**
 * JobListTable Tests
 *
 * Covers table rendering, column display, row styling,
 * and the inline CourierCell (assign button, autocomplete, AI suggestions).
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {renderWithTheme} from '../../__testUtils__';
import {JobListTable} from './JobListTable';
import type {DispatchJob, JobListSort, DensityMode} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';
import dayjs from 'dayjs';

// Mock API modules
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

import {searchActiveCouriersExtended} from '../../services/courierApi';
import {suggestCouriers} from '../../services/aiAssistantApi';
import {isAiEnabled} from '../../../functions/aiSettings';

const mockedSearch = searchActiveCouriersExtended as jest.Mock;
const mockedSuggestCouriers = suggestCouriers as jest.Mock;
const mockedIsAiEnabled = isAiEnabled as jest.Mock;

// ── Mock Data Factory ────────────────────────────────────────────────

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

// ── Default Props ────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────

describe('JobListTable', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedSearch.mockResolvedValue([]);
        mockedSuggestCouriers.mockResolvedValue({couriers: [], summary: '', usage: {inputTokens: 0, outputTokens: 0}});
        mockedIsAiEnabled.mockReturnValue(false);
    });

    describe('Empty State', () => {
        it('renders "No jobs to display" when jobs array is empty', () => {
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: []})}/>);

            expect(screen.getByText('No jobs to display')).toBeInTheDocument();
        });
    });

    describe('Table Rendering', () => {
        it('renders table headers', () => {
            renderWithTheme(<JobListTable {...createDefaultProps()}/>);

            expect(screen.getByText('Date')).toBeInTheDocument();
            expect(screen.getByText('Time')).toBeInTheDocument();
            expect(screen.getByText('Speed')).toBeInTheDocument();
            expect(screen.getByText('Job No')).toBeInTheDocument();
            expect(screen.getByText('Courier')).toBeInTheDocument();
            expect(screen.getByText('Status')).toBeInTheDocument();
        });

        it('renders job number in row', () => {
            renderWithTheme(<JobListTable {...createDefaultProps()}/>);

            expect(screen.getByText('J001')).toBeInTheDocument();
        });

        it('renders job status chip', () => {
            renderWithTheme(<JobListTable {...createDefaultProps()}/>);

            expect(screen.getByText('New')).toBeInTheDocument();
        });

        it('renders speed value', () => {
            renderWithTheme(<JobListTable {...createDefaultProps()}/>);

            expect(screen.getByText('Standard')).toBeInTheDocument();
        });

        it('hides Client column for US customers', () => {
            renderWithTheme(<JobListTable {...createDefaultProps({isUsCustomer: true})}/>);

            expect(screen.queryByText('Client')).not.toBeInTheDocument();
        });

        it('shows Client column for NZ customers', () => {
            renderWithTheme(<JobListTable {...createDefaultProps({isUsCustomer: false})}/>);

            expect(screen.getByText('Client')).toBeInTheDocument();
        });

        it('hides Archived column when not job search page', () => {
            renderWithTheme(<JobListTable {...createDefaultProps({isJobSearchPage: false})}/>);

            expect(screen.queryByText('Archived')).not.toBeInTheDocument();
        });

        it('shows Archived column on job search page', () => {
            renderWithTheme(<JobListTable {...createDefaultProps({isJobSearchPage: true})}/>);

            expect(screen.getByText('Archived')).toBeInTheDocument();
        });
    });

    describe('Row Interaction', () => {
        it('fires onJobClick when row is clicked', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListTable {...props}/>);

            await user.click(screen.getByText('J001'));

            expect(props.onJobClick).toHaveBeenCalledWith(
                expect.objectContaining({id: 1}),
                expect.any(Object),
            );
        });

        it('fires onContextMenu on right-click', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListTable {...props}/>);

            const row = screen.getByText('J001').closest('tr')!;
            await user.pointer({target: row, keys: '[MouseRight]'});

            expect(props.onContextMenu).toHaveBeenCalled();
        });
    });

    describe('Sort', () => {
        it('fires onSortChange when column header is clicked', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListTable {...props}/>);

            await user.click(screen.getByText('Job No'));

            expect(props.onSortChange).toHaveBeenCalledWith('jobNo');
        });
    });

    describe('Courier Column — Assigned Courier', () => {
        it('renders courier name for assigned job (NZ)', () => {
            const job = createMockDispatchJob({
                assignedCourier: {id: 10, text: 'John Smith'},
                courierData: {courier: 'JS01', courierName: 'John Smith', courierNumber: '101'},
            });
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            expect(screen.getByText('JS01 - John Smith')).toBeInTheDocument();
        });

        it('renders courier name and code for US customer', () => {
            const job = createMockDispatchJob({
                assignedCourier: {id: 10, text: 'John Smith'},
                courierData: {courier: 'JS01', courierName: 'John Smith', courierNumber: '101'},
            });
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job], isUsCustomer: true})}/>);

            expect(screen.getByText('John Smith')).toBeInTheDocument();
            expect(screen.getByText('JS01')).toBeInTheDocument();
        });

        it('renders flight number for flight-assigned jobs', () => {
            const job = createMockDispatchJob({
                assignedFlight: {
                    flightNumber: 'NZ123',
                    departureTimeZone: 'Pacific/Auckland',
                    arrivalTimeZone: 'Australia/Sydney',
                    notes: '',
                },
            });
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            expect(screen.getByText('NZ123')).toBeInTheDocument();
        });

        it('renders agent name for agent-assigned jobs', () => {
            const job = createMockDispatchJob({
                assignedAgent: {
                    agentId: 5,
                    agentName: 'Agent Corp',
                    agentRate: 100,
                    agentRanking: 'A',
                    agentNotes: '',
                },
            });
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            expect(screen.getByText('Agent Corp')).toBeInTheDocument();
        });
    });

    describe('CourierCell — Assign Button', () => {
        it('renders Assign button for unassigned job on Dispatch page', () => {
            const job = createMockDispatchJob(); // no assignedCourier
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job], appPage: AppPage.Dispatch})}/>);

            expect(screen.getByText('Assign')).toBeInTheDocument();
        });

        it('renders Assign button on JobSearch page', () => {
            const job = createMockDispatchJob();
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job], appPage: AppPage.JobSearch})}/>);

            expect(screen.getByText('Assign')).toBeInTheDocument();
        });

        it('does not render Assign button on Domestic page', () => {
            const job = createMockDispatchJob();
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job], appPage: AppPage.Domestic})}/>);

            expect(screen.queryByText('Assign')).not.toBeInTheDocument();
        });

        it('does not render Assign button for flight-assigned jobs', () => {
            const job = createMockDispatchJob({
                assignedFlight: {
                    flightNumber: 'NZ999',
                    departureTimeZone: 'Pacific/Auckland',
                    arrivalTimeZone: 'Australia/Sydney',
                    notes: '',
                },
            });
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            expect(screen.queryByText('Assign')).not.toBeInTheDocument();
        });

        it('does not render Assign button for agent-assigned jobs', () => {
            const job = createMockDispatchJob({
                assignedAgent: {
                    agentId: 5,
                    agentName: 'Agent Corp',
                    agentRate: 100,
                    agentRanking: 'A',
                    agentNotes: '',
                },
            });
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            expect(screen.queryByText('Assign')).not.toBeInTheDocument();
        });
    });

    describe('CourierCell — Autocomplete Search', () => {
        it('shows autocomplete when Assign is clicked', async () => {
            const user = userEvent.setup();
            const job = createMockDispatchJob();
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            await user.click(screen.getByText('Assign'));

            expect(screen.getByPlaceholderText('Search courier...')).toBeInTheDocument();
        });

        it('calls searchActiveCouriersExtended on text input', async () => {
            const user = userEvent.setup();
            mockedSearch.mockResolvedValue([{id: 1, text: '101 - John Smith'}]);

            const job = createMockDispatchJob();
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            await user.click(screen.getByText('Assign'));
            const input = screen.getByPlaceholderText('Search courier...');
            await user.type(input, 'John');

            await waitFor(() => {
                expect(mockedSearch).toHaveBeenCalledWith('John', expect.objectContaining({signal: expect.any(AbortSignal)}));
            });
        });

        it('passes dgOnly=true for DG jobs', async () => {
            const user = userEvent.setup();
            mockedSearch.mockResolvedValue([]);

            const job = createMockDispatchJob({dgClass: 3});
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            await user.click(screen.getByText('Assign'));
            const input = screen.getByPlaceholderText('Search courier...');
            await user.type(input, 'test');

            await waitFor(() => {
                expect(mockedSearch).toHaveBeenCalledWith('test', expect.objectContaining({dgOnly: true}));
            });
        });

        it('fires onJobDispatch when a courier is selected', async () => {
            const user = userEvent.setup();
            mockedSearch.mockResolvedValue([{id: 42, text: '101 - John Smith'}]);

            const job = createMockDispatchJob();
            const props = createDefaultProps({jobs: [job]});
            renderWithTheme(<JobListTable {...props}/>);

            await user.click(screen.getByText('Assign'));
            const input = screen.getByPlaceholderText('Search courier...');
            await user.type(input, 'John');

            // Wait for results to appear
            const option = await screen.findByText('101 - John Smith');
            await user.click(option);

            expect(props.onJobDispatch).toHaveBeenCalledWith(
                expect.objectContaining({id: 1}),
                42,
                '101 - John Smith',
            );
        });
    });

    describe('CourierCell — AI Suggestions', () => {
        it('fetches AI suggestions when Assign is clicked and AI is enabled', async () => {
            const user = userEvent.setup();
            mockedIsAiEnabled.mockReturnValue(true);
            mockedSuggestCouriers.mockResolvedValue({
                couriers: [{courierId: 99, code: 'AI01', firstName: 'AI Courier'}],
                summary: '',
                usage: {inputTokens: 0, outputTokens: 0},
            });

            const job = createMockDispatchJob();
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            await user.click(screen.getByText('Assign'));

            await waitFor(() => {
                expect(mockedSuggestCouriers).toHaveBeenCalledWith(1);
            });
        });

        it('does not fetch AI suggestions when AI is disabled', async () => {
            const user = userEvent.setup();
            mockedIsAiEnabled.mockReturnValue(false);

            const job = createMockDispatchJob();
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            await user.click(screen.getByText('Assign'));

            // Give time for any async calls
            await waitFor(() => {
                expect(mockedSuggestCouriers).not.toHaveBeenCalled();
            });
        });

        it('displays AI suggestions in dropdown when search is empty', async () => {
            const user = userEvent.setup();
            mockedIsAiEnabled.mockReturnValue(true);
            mockedSuggestCouriers.mockResolvedValue({
                couriers: [{courierId: 99, code: 'AI01', firstName: 'AI Courier'}],
                summary: '',
                usage: {inputTokens: 0, outputTokens: 0},
            });

            const job = createMockDispatchJob();
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            await user.click(screen.getByText('Assign'));

            // AI suggestion should appear in the dropdown
            expect(await screen.findByText('AI01 - AI Courier')).toBeInTheDocument();
        });
    });

    describe('Multiple Jobs', () => {
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
    });

    describe('Column Resize Handles', () => {
        it('renders resize handles on all header cells except the last', () => {
            renderWithTheme(<JobListTable {...createDefaultProps()}/>);

            // NZ customer, not job search: visible columns are all except client-hideForUs(false) and isArchived
            // Columns: priority, date, time, speed, vehicle, jobNo, client, pickup, delivery, courier, remaining, status
            // Last column = status → no handle
            expect(screen.getByTestId('resize-handle-priority')).toBeInTheDocument();
            expect(screen.getByTestId('resize-handle-date')).toBeInTheDocument();
            expect(screen.getByTestId('resize-handle-jobNo')).toBeInTheDocument();
            expect(screen.getByTestId('resize-handle-courier')).toBeInTheDocument();
            expect(screen.getByTestId('resize-handle-remaining')).toBeInTheDocument();
            // Last column (status) should NOT have a resize handle
            expect(screen.queryByTestId('resize-handle-status')).not.toBeInTheDocument();
        });

        it('does not trigger sort when resize handle is mousedown\'d', async () => {
            const props = createDefaultProps();
            renderWithTheme(<JobListTable {...props}/>);

            const handle = screen.getByTestId('resize-handle-jobNo');
            // mousedown on the handle should NOT trigger sort (stopPropagation)
            handle.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 100}));

            expect(props.onSortChange).not.toHaveBeenCalled();
        });

        it('calls onColumnWidthsChange with updated width after drag', () => {
            const props = createDefaultProps({
                columnWidths: {jobNo: 130},
            });
            renderWithTheme(<JobListTable {...props}/>);

            const handle = screen.getByTestId('resize-handle-jobNo');

            // Simulate mousedown
            handle.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 200}));

            // Simulate mousemove (drag 50px to the right)
            document.dispatchEvent(new MouseEvent('mousemove', {clientX: 250}));

            // Simulate mouseup
            document.dispatchEvent(new MouseEvent('mouseup', {clientX: 250}));

            expect(props.onColumnWidthsChange).toHaveBeenCalledWith(
                expect.objectContaining({jobNo: 180}),
            );
        });

        it('enforces minimum column width of 50px', () => {
            const props = createDefaultProps({
                columnWidths: {jobNo: 80},
            });
            renderWithTheme(<JobListTable {...props}/>);

            const handle = screen.getByTestId('resize-handle-jobNo');

            // Simulate mousedown
            handle.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 200}));

            // Drag far to the left (beyond minimum)
            document.dispatchEvent(new MouseEvent('mousemove', {clientX: 50}));
            document.dispatchEvent(new MouseEvent('mouseup', {clientX: 50}));

            expect(props.onColumnWidthsChange).toHaveBeenCalledWith(
                expect.objectContaining({jobNo: 50}),
            );
        });
    });
});
