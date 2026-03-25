/** @jest-environment jest-environment-jsdom */
/**
 * JobListTable Tests
 *
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
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
// Mock @tanstack/react-virtual so rows render in jsdom (zero-height containers)
jest.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: ({count}: {count: number}) => ({
        getVirtualItems: () =>
            Array.from({length: count}, (_, i) => ({
                index: i,
                start: i * 34,
                end: (i + 1) * 34,
                size: 34,
                key: i,
            })),
        getTotalSize: () => count * 34,
        measureElement: () => {},
    }),
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
        multiSelectedIds: new Set<number>(),
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

    it('renders "No jobs to display" when jobs array is empty', () => {
        renderWithTheme(<JobListTable {...createDefaultProps({jobs: []})}/>);
        expect(screen.getByText('No jobs to display')).toBeInTheDocument();
    });

    // ── Table Rendering (single render) ─────────────────────────────
    describe('Table Rendering', () => {
        it('renders table headers, job data, resize handles and correct column visibility', () => {
            renderWithTheme(<JobListTable {...createDefaultProps()}/>);

            // Headers
            expect(screen.getByText('Date')).toBeInTheDocument();
            expect(screen.getByText('Time')).toBeInTheDocument();
            expect(screen.getByText('Speed')).toBeInTheDocument();
            expect(screen.getByText('Job No')).toBeInTheDocument();
            expect(screen.getByText('Courier')).toBeInTheDocument();
            expect(screen.getByText('Status')).toBeInTheDocument();
            expect(screen.getByText('Client')).toBeInTheDocument(); // NZ customer

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
        });

        it('hides Client column for US customers and shows Archived on search page', () => {
            renderWithTheme(<JobListTable {...createDefaultProps({isUsCustomer: true, isJobSearchPage: true})}/>);

            expect(screen.queryByText('Client')).not.toBeInTheDocument();
            expect(screen.getByText('Archived')).toBeInTheDocument();
        });
    });

    // ── Row Interaction & Sort ───────────────────────────────────────
    describe('Row Interaction', () => {
        it('fires onJobClick and onContextMenu', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListTable {...props}/>);

            await user.click(screen.getByText('J001'));
            expect(props.onJobClick).toHaveBeenCalledWith(expect.objectContaining({id: 1}), expect.any(Object));

            const row = screen.getByText('J001').closest('tr')!;
            await user.pointer({target: row, keys: '[MouseRight]'});
            expect(props.onContextMenu).toHaveBeenCalled();
        });

        it('fires onSortChange when column header is clicked', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithTheme(<JobListTable {...props}/>);

            await user.click(screen.getByText('Job No'));
            expect(props.onSortChange).toHaveBeenCalledWith('jobNo');
        });
    });

    // ── Courier Column (consolidated) ───────────────────────────────
    describe('Courier Column', () => {
        it('renders courier name, flight number and agent name for assigned jobs', () => {
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
                        agentId: 5,
                        agentName: 'Agent Corp',
                        agentRate: 100,
                        agentRanking: 'A',
                        agentNotes: ''
                    },
                }),
            ];
            renderWithTheme(<JobListTable {...createDefaultProps({jobs})}/>);

            expect(screen.getByText('JS01 - John Smith')).toBeInTheDocument();
            expect(screen.getByText('NZ123')).toBeInTheDocument();
            expect(screen.getByText('Agent Corp')).toBeInTheDocument();
        });

        it('renders courier name and code separately for US customer', () => {
            const job = createMockDispatchJob({
                assignedCourier: {id: 10, text: 'John Smith'},
                courierData: {courier: 'JS01', courierName: 'John Smith', courierNumber: '101'},
            });
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job], isUsCustomer: true})}/>);

            expect(screen.getByText('John Smith')).toBeInTheDocument();
            expect(screen.getByText('JS01')).toBeInTheDocument();
        });
    });

    // ── CourierCell Assign Button ────────────────────────────────────
    describe('CourierCell — Assign Button', () => {
        it('renders Assign button on Dispatch and JobSearch pages but not Domestic', () => {
            const job = createMockDispatchJob();

            // Dispatch page
            const {unmount: u1} = renderWithTheme(<JobListTable {...createDefaultProps({
                jobs: [job],
                appPage: AppPage.Dispatch
            })}/>);
            expect(screen.getByText('Assign')).toBeInTheDocument();
            u1();

            // JobSearch page
            const {unmount: u2} = renderWithTheme(<JobListTable {...createDefaultProps({
                jobs: [job],
                appPage: AppPage.JobSearch
            })}/>);
            expect(screen.getByText('Assign')).toBeInTheDocument();
            u2();

            // Domestic page
            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [job], appPage: AppPage.Domestic})}/>);
            expect(screen.queryByText('Assign')).not.toBeInTheDocument();
        });

        it('does not render Assign button for flight or agent assigned jobs', () => {
            const jobs = [
                createMockDispatchJob({
                    id: 1, jobNo: 'J001',
                    assignedFlight: {
                        flightNumber: 'NZ999',
                        departureTimeZone: 'Pacific/Auckland',
                        arrivalTimeZone: 'Australia/Sydney',
                        notes: ''
                    },
                }),
                createMockDispatchJob({
                    id: 2, jobNo: 'J002',
                    assignedAgent: {
                        agentId: 5,
                        agentName: 'Agent Corp',
                        agentRate: 100,
                        agentRanking: 'A',
                        agentNotes: ''
                    },
                }),
            ];
            renderWithTheme(<JobListTable {...createDefaultProps({jobs})}/>);
            expect(screen.queryByText('Assign')).not.toBeInTheDocument();
        });
    });

    // ── CourierCell — Autocomplete Search ────────────────────────────
    describe('CourierCell — Autocomplete Search', () => {
        it('shows autocomplete and calls search on input', async () => {
            const user = userEvent.setup();
            mockedSearch.mockResolvedValue([{id: 1, text: '101 - John Smith'}]);

            renderWithTheme(<JobListTable {...createDefaultProps()}/>);

            await user.click(screen.getByText('Assign'));
            expect(screen.getByPlaceholderText('Search courier...')).toBeInTheDocument();

            await user.click(screen.getByPlaceholderText('Search courier...'));
            await user.paste('John');

            await waitFor(() => {
                expect(mockedSearch).toHaveBeenCalledWith('John', expect.objectContaining({signal: expect.any(AbortSignal)}));
            });
        });

        it('passes dgOnly=true for DG jobs', async () => {
            const user = userEvent.setup();
            mockedSearch.mockResolvedValue([]);

            renderWithTheme(<JobListTable {...createDefaultProps({jobs: [createMockDispatchJob({dgClass: 3})]})}/>);

            await user.click(screen.getByText('Assign'));
            await user.click(screen.getByPlaceholderText('Search courier...'));
            await user.paste('test');

            await waitFor(() => {
                expect(mockedSearch).toHaveBeenCalledWith('test', expect.objectContaining({dgOnly: true}));
            });
        });

        it('fires onJobDispatch when a courier is selected', async () => {
            const user = userEvent.setup();
            mockedSearch.mockResolvedValue([{id: 42, text: '101 - John Smith'}]);

            const props = createDefaultProps();
            renderWithTheme(<JobListTable {...props}/>);

            await user.click(screen.getByText('Assign'));
            await user.click(screen.getByPlaceholderText('Search courier...'));
            await user.paste('John');

            const option = await screen.findByText('101 - John Smith');
            await user.click(option);

            expect(props.onJobDispatch).toHaveBeenCalledWith(expect.objectContaining({id: 1}), 42, '101 - John Smith');
        });
    });

    // ── CourierCell — AI Suggestions ─────────────────────────────────
    describe('CourierCell — AI Suggestions', () => {
        it('fetches and displays AI suggestions when enabled', async () => {
            const user = userEvent.setup();
            mockedIsAiEnabled.mockReturnValue(true);
            mockedSuggestCouriers.mockResolvedValue({
                couriers: [{courierId: 99, code: 'AI01', firstName: 'AI Courier'}],
                summary: '',
                usage: {inputTokens: 0, outputTokens: 0},
            });

            renderWithTheme(<JobListTable {...createDefaultProps()}/>);

            await user.click(screen.getByText('Assign'));

            await waitFor(() => {
                expect(mockedSuggestCouriers).toHaveBeenCalledWith(1);
            });
            expect(await screen.findByText('AI01 - AI Courier')).toBeInTheDocument();
        });

        it('does not fetch AI suggestions when disabled', async () => {
            const user = userEvent.setup();
            mockedIsAiEnabled.mockReturnValue(false);

            renderWithTheme(<JobListTable {...createDefaultProps()}/>);
            await user.click(screen.getByText('Assign'));

            await waitFor(() => {
                expect(mockedSuggestCouriers).not.toHaveBeenCalled();
            });
        });
    });

    // ── Multiple Jobs ───────────────────────────────────────────────
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

    // ── ASAP Job Late Detection ────────────────────────────────────────
    describe('ASAP Job Late Detection', () => {
        it('does not show late pickup icon for ASAP jobs with null time in pre-pickup status', () => {
            const asapJob = createMockDispatchJob({
                id: 1,
                jobNo: 'ASAP-001',
                statusId: 1, // Dispatched — pre-pickup status
                time: null as any, // ASAP job has no delivery time
                booked: dayjs().subtract(2, 'hour'), // overdue by booked time
                assignedCourier: {id: 10, text: '10 - Runner'},
                alertLatePickup: 0, // alerts enabled
            });

            const {container} = renderWithTheme(<JobListTable {...createDefaultProps({jobs: [asapJob]})}/>);

            expect(screen.getByText('ASAP-001')).toBeInTheDocument();
            // No ScheduleIcon (late pickup) or LocalShippingIcon (late delivery)
            expect(container.querySelector('[data-testid="ScheduleIcon"]')).not.toBeInTheDocument();
            expect(container.querySelector('[data-testid="LocalShippingIcon"]')).not.toBeInTheDocument();
        });

        it('does not show late delivery icon for ASAP jobs with null time in transit', () => {
            const asapJob = createMockDispatchJob({
                id: 1,
                jobNo: 'ASAP-002',
                statusId: 11, // InTransit
                time: null as any,
                booked: dayjs().subtract(3, 'hour'),
                assignedCourier: {id: 10, text: '10 - Runner'},
                alertLateDelivery: 0, // alerts enabled
            });

            const {container} = renderWithTheme(<JobListTable {...createDefaultProps({jobs: [asapJob]})}/>);

            expect(screen.getByText('ASAP-002')).toBeInTheDocument();
            // No late delivery icon
            expect(container.querySelector('[data-testid="LocalShippingIcon"]')).not.toBeInTheDocument();
            expect(container.querySelector('[data-testid="ScheduleIcon"]')).not.toBeInTheDocument();
        });

        it('does not show late pickup icon for ASAP jobs in Accepted status', () => {
            const asapJob = createMockDispatchJob({
                id: 1,
                jobNo: 'ASAP-003',
                statusId: 2, // Accepted — pre-pickup status
                time: null as any,
                booked: dayjs().subtract(1, 'hour'),
                assignedCourier: {id: 10, text: '10 - Runner'},
                alertLatePickup: null as any, // null = default (alerts enabled)
            });

            const {container} = renderWithTheme(<JobListTable {...createDefaultProps({jobs: [asapJob]})}/>);

            expect(screen.getByText('ASAP-003')).toBeInTheDocument();
            expect(container.querySelector('[data-testid="ScheduleIcon"]')).not.toBeInTheDocument();
        });

        it('still shows late pickup icon for timed jobs that are overdue', () => {
            const lateTimedJob = createMockDispatchJob({
                id: 1,
                jobNo: 'TIMED-LATE',
                statusId: 1, // Dispatched
                time: dayjs().subtract(1, 'hour'), // delivery time is in the past
                booked: dayjs().subtract(2, 'hour'),
                assignedCourier: {id: 10, text: '10 - Runner'},
                alertLatePickup: 0,
            });

            const {container} = renderWithTheme(<JobListTable {...createDefaultProps({jobs: [lateTimedJob]})}/>);

            expect(screen.getByText('TIMED-LATE')).toBeInTheDocument();

            // ScheduleIcon SVG should render for a late timed job
            expect(container.querySelector('[data-testid="ScheduleIcon"]')).toBeInTheDocument();
        });
    });

    // ── Column Resize ───────────────────────────────────────────────
    describe('Column Resize', () => {
        it('does not trigger sort on resize handle mousedown', () => {
            const props = createDefaultProps();
            renderWithTheme(<JobListTable {...props}/>);

            const handle = screen.getByTestId('resize-handle-jobNo');
            handle.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 100}));
            expect(props.onSortChange).not.toHaveBeenCalled();
        });

        it('calls onColumnWidthsChange with updated width after drag', () => {
            const props = createDefaultProps({columnWidths: {jobNo: 130}});
            renderWithTheme(<JobListTable {...props}/>);

            const handle = screen.getByTestId('resize-handle-jobNo');
            handle.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 200}));
            document.dispatchEvent(new MouseEvent('mousemove', {clientX: 250}));
            document.dispatchEvent(new MouseEvent('mouseup', {clientX: 250}));

            expect(props.onColumnWidthsChange).toHaveBeenCalledWith(expect.objectContaining({jobNo: 180}));
        });

        it('enforces minimum column width of 50px', () => {
            const props = createDefaultProps({columnWidths: {jobNo: 80}});
            renderWithTheme(<JobListTable {...props}/>);

            const handle = screen.getByTestId('resize-handle-jobNo');
            handle.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 200}));
            document.dispatchEvent(new MouseEvent('mousemove', {clientX: 50}));
            document.dispatchEvent(new MouseEvent('mouseup', {clientX: 50}));

            expect(props.onColumnWidthsChange).toHaveBeenCalledWith(expect.objectContaining({jobNo: 50}));
        });
    });
});
