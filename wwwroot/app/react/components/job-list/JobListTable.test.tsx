/**
 * JobListTable Tests
 *
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {act, screen, waitFor} from '@testing-library/react';
import { renderWithMantine } from '../../__testUtils__';
import { setupUser } from '../../__testUtils__/setupUser';
import {availableColumns, orderColumns} from './jobListColumns';
import {JobListTable} from './JobListTable';
import type {DensityMode, DispatchJob, JobListSort} from '../../interfaces/dispatchJob';
import {AppPage} from '../../interfaces/dispatchJob';
import dayjs from 'dayjs';
import {searchActiveCouriersExtended} from '../../services/courierApi';
import {createMockDispatchJob, STALE_ADDRESS_DEVICE, STALE_ADDRESS_LINES} from '../../__testUtils__/mockData';

jest.mock('../../services/courierApi', () => ({
    searchActiveCouriersExtended: jest.fn(),
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

jest.mock('../../utils/dateUtils', () =>
    require('../../../tests/mocks/dateUtilsMock').nzDateUtilsMock());

const mockedSearch = searchActiveCouriersExtended as jest.Mock;

function createDefaultProps(overrides?: Partial<React.ComponentProps<typeof JobListTable>>) {
    const resolved = {isUsCustomer: false, isJobSearchPage: false, ...overrides};
    return {
        columns: orderColumns(availableColumns(resolved.isUsCustomer, resolved.isJobSearchPage)),
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
    });

    it('renders "No jobs to display" when jobs array is empty', () => {
        renderWithMantine(<JobListTable {...createDefaultProps({jobs: []})}/>);
        expect(screen.getByText('No jobs to display')).toBeInTheDocument();
    });

    // ── Stale delivery address ──────────────────────────────────────
    describe('stale delivery address', () => {
        // UC30028239 - the address was changed upstream on the free-text copy only, so the
        // grid kept showing the previous destination while the driver had the new one.
        it('marks the delivery cell when the free-text address disagrees with the address lines', () => {
            const job = createMockDispatchJob({
                toAddress: STALE_ADDRESS_DEVICE,
                deliveryAddress: {
                    addressLine1: 'ALLEVIA HOSPITAL EPSOM', addressLine2: '15-17', addressLine3: 'GILGIT ROAD',
                    addressLine4: 'GATE 4 - LOADING DOCK', addressLine5: 'Newmarket',
                    addressLine6: 'Auckland', addressLine7: '1050', addressLine8: 'New Zealand',
                    fullAddress: STALE_ADDRESS_LINES,
                } as any,
            });
            const {container} = renderWithMantine(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            expect(container.querySelector('[data-testid="stale-delivery-address"]')).toBeInTheDocument();
        });

        it('leaves the cell unmarked when the two copies agree', () => {
            const {container} = renderWithMantine(<JobListTable {...createDefaultProps()}/>);
            expect(container.querySelector('[data-testid="stale-delivery-address"]')).not.toBeInTheDocument();
        });
    });

    // ── Configurable address format ───────────────────────────────────
    describe('addressFormat', () => {
        it('renders pickup and delivery using the configured format instead of NZ/US defaults', () => {
            renderWithMantine(<JobListTable {...createDefaultProps({
                addressFormat: {
                    pickup: {line1: ['streetNumber', 'streetName'], line2: []},
                    delivery: {line1: ['streetNumber', 'streetName'], line2: []},
                },
            })}/>);

            expect(screen.getByText('10, Queen St')).toBeInTheDocument(); // pickup
            expect(screen.getByText('20, High St')).toBeInTheDocument(); // delivery
        });

        it('takes precedence over isUsCustomer when both are set', () => {
            renderWithMantine(<JobListTable {...createDefaultProps({
                isUsCustomer: true,
                addressFormat: {
                    pickup: {line1: ['cityOrSuburb'], line2: []},
                    delivery: {line1: ['cityOrSuburb'], line2: []},
                },
            })}/>);

            expect(screen.getByText('Auckland CBD')).toBeInTheDocument(); // pickup
            expect(screen.getByText('Newmarket')).toBeInTheDocument(); // delivery
        });

        it('renders line 2 as a dimmed second line when fields are assigned to it', () => {
            renderWithMantine(<JobListTable {...createDefaultProps({
                addressFormat: {
                    pickup: {line1: ['streetNumber', 'streetName'], line2: ['cityOrSuburb']},
                    delivery: undefined,
                },
            })}/>);

            expect(screen.getByText('10, Queen St')).toBeInTheDocument();
            expect(screen.getByText('Auckland CBD')).toBeInTheDocument();
        });

        it('resolves pickup and delivery independently — one side configured, the other legacy', () => {
            renderWithMantine(<JobListTable {...createDefaultProps({
                addressFormat: {
                    pickup: {line1: ['cityOrSuburb'], line2: []},
                    delivery: undefined,
                },
            })}/>);

            expect(screen.getByText('Auckland CBD')).toBeInTheDocument(); // pickup: configured
            expect(screen.getByText('Newmarket, 20, High St')).toBeInTheDocument(); // delivery: NZ legacy
        });

        it('falls back to the NZ/US default when no format is configured', () => {
            renderWithMantine(<JobListTable {...createDefaultProps()}/>);

            expect(screen.getByText('Auckland CBD')).toBeInTheDocument(); // NZ pickup: suburb only
        });
    });

    // ── Table Rendering (single render) ─────────────────────────────
    describe('Table Rendering', () => {
        it('renders table headers, job data, resize handles and correct column visibility', () => {
            renderWithMantine(<JobListTable {...createDefaultProps()}/>);

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

            // No Archived or Ref A columns when not job search page
            expect(screen.queryByText('Archived')).not.toBeInTheDocument();
            expect(screen.queryByText('Ref A')).not.toBeInTheDocument();
            expect(screen.queryByText('PO-4471')).not.toBeInTheDocument();

            // Resize handles
            expect(screen.getByTestId('resize-handle-priority')).toBeInTheDocument();
            expect(screen.getByTestId('resize-handle-date')).toBeInTheDocument();
            expect(screen.getByTestId('resize-handle-jobNo')).toBeInTheDocument();
            expect(screen.getByTestId('resize-handle-courier')).toBeInTheDocument();
            expect(screen.getByTestId('resize-handle-remaining')).toBeInTheDocument();
            expect(screen.queryByTestId('resize-handle-status')).not.toBeInTheDocument();
        });

        it('hides Client column for US customers and shows Archived and Ref A on search page', () => {
            renderWithMantine(<JobListTable {...createDefaultProps({isUsCustomer: true, isJobSearchPage: true})}/>);

            expect(screen.queryByText('Client')).not.toBeInTheDocument();
            expect(screen.getByText('Archived')).toBeInTheDocument();
            expect(screen.getByText('Ref A')).toBeInTheDocument();
            expect(screen.getByText('PO-4471')).toBeInTheDocument();
        });

        it('renders the partner-job icon in the priority column when isPartnerJob is true', async () => {
            const partnerJob = createMockDispatchJob({id: 2, jobNo: 'P001', isPartnerJob: true});
            renderWithMantine(<JobListTable {...createDefaultProps({jobs: [partnerJob]})}/>);

            const row = screen.getByText('P001').closest('tr')!;
            await setupUser().hover(row.querySelector('[data-testid="indicator-partner"]')!);
            expect(await screen.findByText('Partner Job')).toBeInTheDocument();
        });
    });

    // ── Priority-column status dots ──────────────────────────────────
    describe('Priority status dots', () => {
        // Each dot mirrors a top stats-header category. Hovering shows the meaning.
        const cases: Array<{label: string; overrides: Partial<DispatchJob>; tooltip: string}> = [
            {label: 'in-transit (amber)', overrides: {jobNo: 'D-TRANSIT', statusId: 11}, tooltip: 'In Transit'},
            {
                label: 'dispatched → in-transit (amber)',
                overrides: {jobNo: 'D-DISPATCHED', statusId: 1, assignedCourier: {id: 5, text: '5 - R'}},
                tooltip: 'In Transit',
            },
            {label: 'delivered (green)', overrides: {jobNo: 'D-DONE', statusId: 6}, tooltip: 'Done'},
            {
                label: 'active (blue)',
                overrides: {jobNo: 'D-DISPATCH', statusId: 0, assignedCourier: undefined},
                tooltip: 'Active',
            },
            {
                label: 'urgent (red)',
                overrides: {jobNo: 'D-URGENT', statusId: 1, assignedCourier: {id: 5, text: '5 - R'}, booked: dayjs().add(15, 'minute')},
                tooltip: 'Urgent',
            },
        ];

        it.each(cases)('shows a tooltip on the $label dot', async ({overrides, tooltip}) => {
            const job = createMockDispatchJob({id: 1, ...overrides});
            renderWithMantine(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            await setupUser().hover(screen.getByTestId('priority-dot'));
            expect(await screen.findByText(tooltip)).toBeInTheDocument();
        });

        it('does not show an in-transit dot for Warning-status jobs', () => {
            // Warning (7) previously rendered an amber dot; amber now means In Transit only.
            const warningJob = createMockDispatchJob({id: 1, jobNo: 'D-WARN', statusId: 7, assignedCourier: {id: 5, text: '5 - R'}});
            renderWithMantine(<JobListTable {...createDefaultProps({jobs: [warningJob]})}/>);

            expect(screen.queryByTestId('priority-dot')).not.toBeInTheDocument();
        });
    });

    // ── Priority-column header: legend and sort side by side ─────────
    describe('Priority column header', () => {
        it('opens the legend dialog from its info button without sorting', async () => {
            const props = createDefaultProps();
            renderWithMantine(<JobListTable {...props}/>);

            await setupUser().click(screen.getByRole('button', {name: 'Column legend'}));

            // Dialog opened, sorting not triggered
            expect(props.onSortChange).not.toHaveBeenCalled();
            expect(await screen.findByText('Job type')).toBeInTheDocument();
            expect(screen.getByText('Needs attention')).toBeInTheDocument();
        });

        it('offers no sort control — the gutter holds icons, not a value to order by', () => {
            renderWithMantine(<JobListTable {...createDefaultProps()}/>);

            const header = document.querySelector('th[data-column-key="priority"]')!;
            expect(header.querySelector('[data-sort-column]')).toBeNull();
            expect(screen.queryByRole('button', {name: 'Sort by priority'})).not.toBeInTheDocument();
        });
    });

    // ── Row Interaction & Sort ───────────────────────────────────────
    describe('Row Interaction', () => {
        it('fires onJobClick and onContextMenu', async () => {
            const user = setupUser();
            const props = createDefaultProps();
            renderWithMantine(<JobListTable {...props}/>);

            await user.click(screen.getByText('J001'));
            expect(props.onJobClick).toHaveBeenCalledWith(expect.objectContaining({id: 1}), expect.any(Object));

            const row = screen.getByText('J001').closest('tr')!;
            await user.pointer({target: row, keys: '[MouseRight]'});
            expect(props.onContextMenu).toHaveBeenCalled();
        });

        it('fires onSortChange when column header is clicked', async () => {
            const user = setupUser();
            const props = createDefaultProps({isJobSearchPage: true});
            renderWithMantine(<JobListTable {...props}/>);

            await user.click(screen.getByText('Job No'));
            expect(props.onSortChange).toHaveBeenCalledWith('jobNo');

            await user.click(screen.getByText('Ref A'));
            expect(props.onSortChange).toHaveBeenCalledWith('refA');

            await user.click(screen.getByText('Remaining'));
            expect(props.onSortChange).toHaveBeenCalledWith('remaining');
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
            renderWithMantine(<JobListTable {...createDefaultProps({jobs})}/>);

            expect(screen.getByText('JS01 - John Smith')).toBeInTheDocument();
            expect(screen.getByText('NZ123')).toBeInTheDocument();
            expect(screen.getByText('Agent Corp')).toBeInTheDocument();
        });

        it('renders courier name and code separately for US customer', () => {
            const job = createMockDispatchJob({
                assignedCourier: {id: 10, text: 'John Smith'},
                courierData: {courier: 'JS01', courierName: 'John Smith', courierNumber: '101'},
            });
            renderWithMantine(<JobListTable {...createDefaultProps({jobs: [job], isUsCustomer: true})}/>);

            expect(screen.getByText('John Smith')).toBeInTheDocument();
            expect(screen.getByText('JS01')).toBeInTheDocument();
        });

        it('renders the DFRNT partner name when the job was sent to a partner', () => {
            const job = createMockDispatchJob({
                id: 4, jobNo: 'J004',
                sentToPartnerName: 'Acme Couriers',
            });
            renderWithMantine(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            expect(screen.getByText('Acme Couriers')).toBeInTheDocument();
        });
    });

    // ── CourierCell Assign Button ────────────────────────────────────
    describe('CourierCell — Assign Button', () => {
        it('renders the inline courier Assign button on every operational page', () => {
            // Nationwide (Domestic) used to be excluded, leaving its rows with no
            // assignment affordance at all.
            const job = createMockDispatchJob();

            for (const appPage of [AppPage.Dispatch, AppPage.JobSearch, AppPage.Domestic]) {
                const {unmount} = renderWithMantine(
                    <JobListTable {...createDefaultProps({jobs: [job], appPage})}/>
                );
                expect(screen.getByText('Assign')).toBeInTheDocument();
                unmount();
            }
        });

        it('fills its cell — paints the row band and the full column, without growing the row', () => {
            renderWithMantine(<JobListTable {...createDefaultProps({
                jobs: [createMockDispatchJob()],
                appPage: AppPage.Dispatch,
            })}/>);

            const assign = screen.getByRole('button', {name: 'Assign'});
            expect(assign).toHaveAttribute('data-ab-size', 'compact');

            // The chip itself only hugs its label; its wrapper is the hit target
            // that fills the cell.
            const wrapper = assign.parentElement as HTMLElement;
            // Paints the 22px band plus the cell padding above and below it...
            expect(wrapper.style.height).toBe('calc(22px + 2 * var(--jl-cell-py))');
            // ...then gives that padding back, so the row height is unchanged.
            expect(wrapper.style.marginBlock).toBe('calc(-1 * var(--jl-cell-py))');
            expect(wrapper.style.width).toBe('100%');
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
            renderWithMantine(<JobListTable {...createDefaultProps({jobs})}/>);
            expect(screen.queryByText('Assign')).not.toBeInTheDocument();
        });
    });

    // ── CourierCell — Autocomplete Search ────────────────────────────
    describe('CourierCell — Autocomplete Search', () => {
        it('shows autocomplete and calls search on input', async () => {
            const user = setupUser();
            mockedSearch.mockResolvedValue([{id: 1, text: '101 - John Smith'}]);

            renderWithMantine(<JobListTable {...createDefaultProps()}/>);

            await user.click(screen.getByText('Assign'));
            expect(screen.getByPlaceholderText('Search courier...')).toBeInTheDocument();

            await user.click(screen.getByPlaceholderText('Search courier...'));
            await user.paste('John');

            await waitFor(() => {
                expect(mockedSearch).toHaveBeenCalledWith('John', expect.objectContaining({signal: expect.any(AbortSignal)}));
            });
        });

        it('passes dgOnly=true for DG jobs', async () => {
            const user = setupUser();
            mockedSearch.mockResolvedValue([]);

            renderWithMantine(<JobListTable {...createDefaultProps({jobs: [createMockDispatchJob({dgClass: 3})]})}/>);

            await user.click(screen.getByText('Assign'));
            await user.click(screen.getByPlaceholderText('Search courier...'));
            await user.paste('test');

            await waitFor(() => {
                expect(mockedSearch).toHaveBeenCalledWith('test', expect.objectContaining({dgOnly: true}));
            });
        });

        it('closes the search and restores Assign when the click lands outside the cell', async () => {
            const user = setupUser();
            mockedSearch.mockResolvedValue([]);

            renderWithMantine(<JobListTable {...createDefaultProps()}/>);

            await user.click(screen.getByRole('button', {name: 'Assign'}));
            expect(screen.getByPlaceholderText('Search courier...')).toBeInTheDocument();

            await user.click(document.body);

            expect(screen.queryByPlaceholderText('Search courier...')).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Assign'})).toBeInTheDocument();
        });

        it('cancels the search on Escape and puts focus back on Assign', async () => {
            const user = setupUser();
            mockedSearch.mockResolvedValue([]);

            renderWithMantine(<JobListTable {...createDefaultProps()}/>);

            await user.click(screen.getByRole('button', {name: 'Assign'}));
            await user.keyboard('{Escape}');

            const assign = screen.getByRole('button', {name: 'Assign'});
            expect(screen.queryByPlaceholderText('Search courier...')).not.toBeInTheDocument();
            // Escape is a keyboard gesture, so the keyboard must not be stranded.
            expect(assign).toHaveFocus();
        });

        it('fires onJobDispatch when a courier is selected', async () => {
            const user = setupUser();
            mockedSearch.mockResolvedValue([{id: 42, text: '101 - John Smith'}]);

            const props = createDefaultProps();
            renderWithMantine(<JobListTable {...props}/>);

            await user.click(screen.getByText('Assign'));
            await user.click(screen.getByPlaceholderText('Search courier...'));
            await user.paste('John');

            const option = await screen.findByText('101 - John Smith');
            await user.click(option);

            expect(props.onJobDispatch).toHaveBeenCalledWith(expect.objectContaining({id: 1}), 42, '101 - John Smith');
        });
    });

    // ── Dispatch confirmation flash ────────────────────────────────────
    describe('Dispatch confirmation flash', () => {
        it('flashes the row when a job gains a courier, then clears the flash', () => {
            jest.useFakeTimers();
            try {
                const job = createMockDispatchJob({id: 1, jobNo: 'J100', assignedCourier: undefined});
                const {rerender} = renderWithMantine(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

                const row = screen.getByText('J100').closest('tr')!;
                expect(row).not.toHaveAttribute('data-dispatched');

                const dispatchedJob = {...job, assignedCourier: {id: 5, text: '5 - Runner'}};
                act(() => {
                    rerender(<JobListTable {...createDefaultProps({jobs: [dispatchedJob]})}/>);
                });
                expect(row).toHaveAttribute('data-dispatched', 'true');

                act(() => {
                    jest.advanceTimersByTime(1500);
                });
                expect(row).not.toHaveAttribute('data-dispatched');
            } finally {
                jest.useRealTimers();
            }
        });

        it('does not flash a job that already had a courier on first render', () => {
            const job = createMockDispatchJob({id: 1, jobNo: 'J101', assignedCourier: {id: 5, text: '5 - Runner'}});
            renderWithMantine(<JobListTable {...createDefaultProps({jobs: [job]})}/>);

            const row = screen.getByText('J101').closest('tr')!;
            expect(row).not.toHaveAttribute('data-dispatched');
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
            renderWithMantine(<JobListTable {...createDefaultProps({jobs})}/>);

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

            const {container} = renderWithMantine(<JobListTable {...createDefaultProps({jobs: [asapJob]})}/>);

            expect(screen.getByText('ASAP-001')).toBeInTheDocument();
            // No ScheduleIcon (late pickup) or LocalShippingIcon (late delivery)
            expect(container.querySelector('[data-testid="indicator-late-pickup"]')).not.toBeInTheDocument();
            expect(container.querySelector('[data-testid="indicator-late-delivery"]')).not.toBeInTheDocument();
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

            const {container} = renderWithMantine(<JobListTable {...createDefaultProps({jobs: [asapJob]})}/>);

            expect(screen.getByText('ASAP-002')).toBeInTheDocument();
            // No late delivery icon
            expect(container.querySelector('[data-testid="indicator-late-delivery"]')).not.toBeInTheDocument();
            expect(container.querySelector('[data-testid="indicator-late-pickup"]')).not.toBeInTheDocument();
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

            const {container} = renderWithMantine(<JobListTable {...createDefaultProps({jobs: [asapJob]})}/>);

            expect(screen.getByText('ASAP-003')).toBeInTheDocument();
            expect(container.querySelector('[data-testid="indicator-late-pickup"]')).not.toBeInTheDocument();
        });

    });

    // ── Selection & Related Row Highlighting ──────────────────────
    describe('Selection & Related Row Highlighting', () => {
        const selectionJobs = [
            createMockDispatchJob({id: 1, jobNo: 'SEL-001'}),
            createMockDispatchJob({id: 2, jobNo: 'REL-002'}),
            createMockDispatchJob({id: 3, jobNo: 'OTHER-003'}),
        ];

        it('selected row does not show link icon even when in relatedJobIds', () => {
            renderWithMantine(<JobListTable {...createDefaultProps({
                jobs: selectionJobs,
                selectedJobId: 1,
                relatedJobIds: new Set([1, 2]),
            })}/>);

            const selectedRow = screen.getByText('SEL-001').closest('tr')!;
            expect(selectedRow.querySelector('[data-testid="indicator-related"]')).not.toBeInTheDocument();
        });

        it('related (non-selected) row shows link icon in first cell', () => {
            renderWithMantine(<JobListTable {...createDefaultProps({
                jobs: selectionJobs,
                selectedJobId: 1,
                relatedJobIds: new Set([1, 2]),
            })}/>);

            const relatedRow = screen.getByText('REL-002').closest('tr')!;
            expect(relatedRow.querySelector('[data-testid="indicator-related"]')).toBeInTheDocument();
        });

        it('non-selected, non-related rows do not show link icon', () => {
            renderWithMantine(<JobListTable {...createDefaultProps({
                jobs: selectionJobs,
                selectedJobId: 1,
                relatedJobIds: new Set([1, 2]),
            })}/>);

            const otherRow = screen.getByText('OTHER-003').closest('tr')!;
            expect(otherRow.querySelector('[data-testid="indicator-related"]')).not.toBeInTheDocument();
        });

        it('no link icons appear when there are no related jobs', () => {
            const {container} = renderWithMantine(<JobListTable {...createDefaultProps({
                jobs: selectionJobs,
                selectedJobId: 1,
                relatedJobIds: new Set<number>(),
            })}/>);

            expect(container.querySelectorAll('[data-testid="indicator-related"]')).toHaveLength(0);
        });
    });

    // ── Column Resize ───────────────────────────────────────────────
    describe('Column Resize', () => {
        it('does not trigger sort on resize handle mousedown', () => {
            const props = createDefaultProps();
            renderWithMantine(<JobListTable {...props}/>);

            const handle = screen.getByTestId('resize-handle-jobNo');
            handle.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 100}));
            expect(props.onSortChange).not.toHaveBeenCalled();
        });

        it('calls onColumnWidthsChange with updated width after drag', () => {
            const props = createDefaultProps({columnWidths: {jobNo: 130}});
            renderWithMantine(<JobListTable {...props}/>);

            const handle = screen.getByTestId('resize-handle-jobNo');
            handle.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 200}));
            document.dispatchEvent(new MouseEvent('mousemove', {clientX: 250}));
            document.dispatchEvent(new MouseEvent('mouseup', {clientX: 250}));

            expect(props.onColumnWidthsChange).toHaveBeenCalledWith(expect.objectContaining({jobNo: 180}));
        });

        it('enforces minimum column width of 50px', () => {
            const props = createDefaultProps({columnWidths: {jobNo: 80}});
            renderWithMantine(<JobListTable {...props}/>);

            const handle = screen.getByTestId('resize-handle-jobNo');
            handle.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 200}));
            document.dispatchEvent(new MouseEvent('mousemove', {clientX: 50}));
            document.dispatchEvent(new MouseEvent('mouseup', {clientX: 50}));

            expect(props.onColumnWidthsChange).toHaveBeenCalledWith(expect.objectContaining({jobNo: 50}));
        });
    });
});
