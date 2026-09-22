import React from 'react';
import dayjs from 'dayjs';
import {act, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

// The job list and map pull in heavy dependencies; stub them and capture the
// props the page hands over, which is what this suite is actually about.
const listProps: Record<string, {
    storagePrefix: string;
    fetchConfig?: {queryKeyFn?: unknown; initialParams?: Record<string, unknown>; refetchInterval?: number | false};
    onJobSelect?: (job: unknown) => void;
    topSlot?: React.ReactNode;
}> = {};
// What each list was pushed via setUpdateSearchParamsCallback, keyed by storagePrefix.
const listParamPushes: Record<string, Record<string, unknown>[]> = {};
jest.mock('../../components/job-list/JobListPanel', () => ({
    JobListPanel: (props: {
        storagePrefix: string;
        fetchConfig?: {queryKeyFn?: unknown; initialParams?: Record<string, unknown>; refetchInterval?: number | false};
        onJobSelect?: (job: unknown) => void;
        topSlot?: React.ReactNode;
        setUpdateSearchParamsCallback?: (cb: (params: Record<string, unknown>) => void) => void;
    }) => {
        listProps[props.storagePrefix] = props;
        listParamPushes[props.storagePrefix] ??= [];
        props.setUpdateSearchParamsCallback?.((params) => {
            listParamPushes[props.storagePrefix].push(params);
        });
        return (
            <div data-testid={`mock-job-list-${props.storagePrefix}`}>
                {props.storagePrefix === 'nwNewJobList' ? props.topSlot : null}
            </div>
        );
    },
}));

const mapProps: {mapZoom?: number; jobs?: unknown[]; preferenceScope?: string} = {};
jest.mock('../../components/common/dispatch-map/DispatchMap', () => ({
    DispatchMap: (props: {mapZoom?: number; jobs?: unknown[]; preferenceScope?: string}) => {
        Object.assign(mapProps, props);
        return <div data-testid="mock-dispatch-map"/>;
    },
}));

/*
 * FlightAgentDataTable transitively imports island modules that call
 * `window.angular.module(...)` at import time, which does not exist under Jest.
 * Mocking it also lets this suite assert the props the page threads through.
 */
const widgetProps: Record<string, unknown> = {};
jest.mock('../../components/common/flight-agent-data-table', () => ({
    FlightAgentDataTable: (props: Record<string, unknown>) => {
        Object.assign(widgetProps, props);
        return <div data-testid="mock-flight-agent-widget"/>;
    },
}));

/*
 * Dialog island modules register an AngularJS module at import time, so they are
 * mocked here the same way DispatchPage.test mocks its own.
 */
jest.mock('../../components/dialogs/flight-agent-confirmation-dialog/flight-agent-confirmation-dialog-react.module', () => ({
    openFlightConfirmationDialog: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../components/dialogs/auto-complete-dialog/auto-complete-dialog-react.module', () => ({
    openAutoCompleteDialog: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../components/dialogs/recovery-agent-management-dialog', () => ({
    openRecoveryAgentManagementDialog: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../components/dialogs/add-event-dialog', () => ({
    openAddEventDialog: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('../../components/dialogs/edit-address-dialog/edit-address-dialog-react.module', () => ({
    openEditAddressDialog: jest.fn().mockResolvedValue(null),
}));

const dispatchDialogProps: {
    open?: boolean;
    initialType?: string;
    existingDestination?: {id: number; text: string};
    onDispatchCourier?: (confirmation: {type: string; destination: {id: number; text: string}}) => Promise<void>;
} = {};
jest.mock('../../components/dialogs/dispatch-dialog', () => ({
    DispatchDialog: (props: typeof dispatchDialogProps) => {
        Object.assign(dispatchDialogProps, props);
        return <div data-testid="mock-dispatch-dialog"/>;
    },
}));

jest.mock('../../services/dispatchExecutorApi', () => ({
    ...jest.requireActual('../../services/dispatchExecutorApi'),
    getDispatchJobDetail: jest.fn(() => new Promise(() => {})),
}));

const executeDispatchConfirmationMock = jest.fn().mockResolvedValue({message: 'ok', severity: 'success'});
jest.mock('../../components/dialogs/dispatch-dialog/executeDispatch', () => ({
    executeDispatchConfirmation: (...args: unknown[]) => executeDispatchConfirmationMock(...args),
}));

const serverViews = [
    {id: 11, name: 'Auckland', centerLatitude: -36.85, centerLongitude: 174.76, selected: false},
    {id: 22, name: 'Airport', centerLatitude: -37.0, centerLongitude: 174.79, selected: false},
];
const fetchPageViewsMock = jest.fn().mockResolvedValue(serverViews);
jest.mock('../../services/dispatchViewsApi', () => ({
    fetchPageViews: (...a: unknown[]) => fetchPageViewsMock(...a),
}));

import {NationwidePage} from './NationwidePage';
import {MantineTestProvider} from '../../__testUtils__';
import {AppPage as LegacyAppPage} from '../../../enums/app-pages.enum';
import {queryClient} from '../../query/queryClient';
import {setupUser} from '../../__testUtils__/setupUser';
import {openAddEventDialog} from '../../components/dialogs/add-event-dialog';

function renderPage(overrides: Partial<React.ComponentProps<typeof NationwidePage>> = {}) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <NationwidePage
                    showToast={jest.fn()}
                    isUsCustomer={false}
                    timeZone="New Zealand Standard Time"
                    {...overrides}
                />
            </MantineTestProvider>
        </QueryClientProvider>,
    );
}

describe('NationwidePage', () => {
    beforeEach(() => {
        localStorage.clear();
        (window as unknown as {ContactID: number}).ContactID = 0;
        for (const key of Object.keys(listProps)) delete listProps[key];
        for (const key of Object.keys(listParamPushes)) delete listParamPushes[key];
        executeDispatchConfirmationMock.mockClear();
    });

    it('renders all three job lists, each with its own storage prefix', () => {
        renderPage();

        expect(screen.getByTestId('mock-job-list-nwNewJobList')).toBeInTheDocument();
        expect(screen.getByTestId('mock-job-list-nwPodJobList')).toBeInTheDocument();
        expect(screen.getByTestId('mock-job-list-nwRepriceJobList')).toBeInTheDocument();
    });

    it('does not give the job lists an inline views rail -- selection is app-bar only, matching AngularJS', () => {
        renderPage();

        expect(listProps['nwNewJobList'].topSlot).toBeUndefined();
        expect(listProps['nwPodJobList'].topSlot).toBeUndefined();
        expect(listProps['nwRepriceJobList'].topSlot).toBeUndefined();
    });

    it('gives each list a distinct query key so they page independently', () => {
        renderPage();

        const keyFor = (prefix: string) => {
            const fn = listProps[prefix].fetchConfig?.queryKeyFn as (p: unknown) => readonly unknown[];
            return fn({});
        };

        const keys = ['nwNewJobList', 'nwPodJobList', 'nwRepriceJobList'].map(keyFor);
        expect(new Set(keys.map(k => JSON.stringify(k))).size).toBe(3);
        expect(keys[0]).toContain('newJobs');
        expect(keys[1]).toContain('podJobs');
        expect(keys[2]).toContain('repriceJobs');
    });

    it('has no auto-refresh by default (no V1 cadence stored)', () => {
        renderPage();
        for (const prefix of ['nwNewJobList', 'nwPodJobList', 'nwRepriceJobList']) {
            expect(listProps[prefix].fetchConfig?.refetchInterval).toBe(false);
        }
    });

    it('carries forward a cadence the operator already saved on the classic V1 page', () => {
        localStorage.setItem('refreshInterval-2-0', '30');
        renderPage();
        for (const prefix of ['nwNewJobList', 'nwPodJobList', 'nwRepriceJobList']) {
            expect(listProps[prefix].fetchConfig?.refetchInterval).toBe(30000);
        }
    });

    it('seeds every list from the persisted date filter', () => {
        renderPage();

        for (const prefix of ['nwNewJobList', 'nwPodJobList', 'nwRepriceJobList']) {
            const params = listProps[prefix].fetchConfig?.initialParams;
            expect(params?.startDate).toBeDefined();
            expect(params?.endDate).toBeDefined();
        }
    });

    describe('date filter timezone conversion', () => {
        it('does not fail to load the date filter when the page timezone is a Windows ID, not IANA', () => {
            localStorage.setItem('dateFilter-2-0', JSON.stringify({startDate: 0, endDate: 0, useTime: false}));
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            renderPage({timeZone: 'Eastern Standard Time'});

            expect(consoleErrorSpy).not.toHaveBeenCalledWith(
                'Error loading date filter from storage:',
                expect.anything(),
            );
        });
    });

    it('renders the map scoped to its own preferences', () => {
        renderPage();

        expect(screen.getByTestId('mock-dispatch-map')).toBeInTheDocument();
        expect(mapProps.preferenceScope).toBe('nationwide');
    });

    it('opens the map at the tenant default with no job selected', () => {
        renderPage();

        expect(mapProps.jobs).toEqual([]);
        expect(mapProps.mapZoom).toBe(7);
    });

    it('prompts for a job selection in the detail panel', () => {
        renderPage();
        expect(screen.getByText(/select a job from one of the lists/i)).toBeInTheDocument();
    });

    describe('flight/agent widget', () => {
        it('renders the widget', () => {
            renderPage();
            expect(screen.getByTestId('mock-flight-agent-widget')).toBeInTheDocument();
        });

        it('starts in flight mode with no job selected', () => {
            renderPage();

            expect(widgetProps.isDeliveryJobType).toBe(false);
            expect(widgetProps.showNoJobSelectedMessage).toBe(true);
            expect(widgetProps.currentJob).toBeNull();
        });

        it('hands the widget the shared formatting helpers', () => {
            // These come from lib/flightFormatting, which the AngularJS page
            // also delegates to -- the two cannot format differently.
            renderPage();

            expect((widgetProps.formatMinutesToTime as (m: number) => string)(150)).toBe('2h 30m');
            expect((widgetProps.formatAirportCodeForDropdown as (t: string) => string)('AKL Auckland'))
                .toBe('AKL ');
        });

        it('never sets the dead V1 not-delivery-job flag', () => {
            // Bound in V1's template but never assigned by the derivation.
            renderPage();
            expect(widgetProps.showNotDeliveryJobMessage).toBe(false);
        });
    });

    describe('agent assignment hand-off', () => {
        it('does not open the dispatch dialog until an agent is picked', () => {
            renderPage();
            expect(screen.queryByTestId('mock-dispatch-dialog')).not.toBeInTheDocument();
        });

        const selectAJob = async () => {
            await act(async () => {
                listProps['nwNewJobList'].onJobSelect?.({
                    id: 5, jobNo: 'JOB-5', isAgentJob: true, relatedJobs: [],
                });
            });
        };

        it('opens pre-set to Agent with the picked agent filled in', async () => {
            // V1 opened the shared dispatch modal on the Agent tab with the
            // agent already selected, rather than making the operator find it
            // again. The modal performs the assignment.
            renderPage();
            await selectAJob();

            const onAddAgent = widgetProps.onAddAgentToJob as (a: unknown) => Promise<void>;
            await act(async () => {
                await onAddAgent({agentId: 7, agentName: 'Acme Air'});
            });

            expect(screen.getByTestId('mock-dispatch-dialog')).toBeInTheDocument();
            expect(dispatchDialogProps.initialType).toBe('Agent');
            expect(dispatchDialogProps.existingDestination).toEqual({id: 7, text: 'Acme Air'});
        });

        it('blocks courier dispatch for US customers, matching V1\'s restriction', async () => {
            // V1's handleJobDispatch() refused courier dispatch for isUsCustomer
            // with a warning toast (nationwide.controller.ts). The shared
            // DispatchDialog has no such gate, so this page must apply it itself.
            const showToast = jest.fn();
            renderPage({isUsCustomer: true, showToast});
            await selectAJob();

            const onAddAgent = widgetProps.onAddAgentToJob as (a: unknown) => Promise<void>;
            await act(async () => {
                await onAddAgent({agentId: 7, agentName: 'Acme Air'});
            });

            act(() => {
                void dispatchDialogProps.onDispatchCourier!({
                    type: 'Courier',
                    destination: {id: 3, text: 'Fast Courier'},
                });
            });

            await waitFor(() => expect(showToast).toHaveBeenCalledWith(
                'Courier dispatch is not supported for US customers',
                'warning',
            ));
            expect(executeDispatchConfirmationMock).not.toHaveBeenCalled();
        });

        it('still allows courier dispatch for non-US customers', async () => {
            const showToast = jest.fn();
            renderPage({isUsCustomer: false, showToast});
            await selectAJob();

            const onAddAgent = widgetProps.onAddAgentToJob as (a: unknown) => Promise<void>;
            await act(async () => {
                await onAddAgent({agentId: 7, agentName: 'Acme Air'});
            });

            act(() => {
                void dispatchDialogProps.onDispatchCourier!({
                    type: 'Courier',
                    destination: {id: 3, text: 'Fast Courier'},
                });
            });

            await waitFor(() => expect(executeDispatchConfirmationMock).toHaveBeenCalled());
            expect(executeDispatchConfirmationMock).toHaveBeenCalledWith(
                expect.objectContaining({id: 5, jobNo: 'JOB-5'}),
                expect.objectContaining({type: 'Courier'}),
            );
        });
    });

    describe('job actions menu', () => {
        const selectAJob = async () => {
            await act(async () => {
                listProps['nwNewJobList'].onJobSelect?.({
                    id: 5, jobNo: 'JOB-5', isAgentJob: true, relatedJobs: [],
                });
            });
        };

        it('is not shown until a job is selected', () => {
            renderPage();
            expect(screen.queryByRole('button', {name: 'Job actions'})).not.toBeInTheDocument();
        });

        it('opens the Add Task dialog for the selected job', async () => {
            const user = setupUser();
            renderPage();
            await selectAJob();

            await user.click(screen.getByRole('button', {name: 'Job actions'}));
            await user.click(screen.getByRole('menuitem', {name: 'Add Task'}));

            expect(openAddEventDialog).toHaveBeenCalledWith(expect.objectContaining({
                job: expect.objectContaining({id: 5, jobNo: 'JOB-5'}),
            }));
        });
    });

    describe('dashboard views filter', () => {
        const SELECTED_VIEWS_KEY = 'selectedViews-NW-0';

        it('loads the Nationwide (AppPage.Domestic) page views', () => {
            renderPage();
            expect(fetchPageViewsMock).toHaveBeenCalledWith(LegacyAppPage.Domestic);
        });

        it('selects the first view on a first visit and persists it under the legacy V1 key', async () => {
            renderPage();

            // All three lists -- selection is app-bar only, no per-list rail -- get scoped.
            for (const prefix of ['nwNewJobList', 'nwPodJobList', 'nwRepriceJobList']) {
                await waitFor(() => expect(listParamPushes[prefix]).toContainEqual({despatchViewIds: [11], page: 0}));
            }
            expect(JSON.parse(localStorage.getItem(SELECTED_VIEWS_KEY)!)).toEqual([
                expect.objectContaining({id: 11, selected: true}),
            ]);
        });

        it('restores a previously stored selection instead of auto-selecting', async () => {
            localStorage.setItem(SELECTED_VIEWS_KEY, JSON.stringify([{id: 22, selected: true}]));
            renderPage();

            // Matches the stored selection already, so no push is needed --
            // the initial fetch is scoped to it directly.
            await waitFor(() => expect(listProps['nwNewJobList'].fetchConfig?.initialParams).toEqual(
                expect.objectContaining({despatchViewIds: [22]}),
            ));
        });

        it('toggles a view (driven by the host toolbar) and pushes the new selection into every list', async () => {
            const onLayoutBridgeReady = jest.fn();
            renderPage({onLayoutBridgeReady});
            const bridge = onLayoutBridgeReady.mock.calls[0][0];
            await waitFor(() => expect(listParamPushes['nwNewJobList']).toContainEqual({despatchViewIds: [11], page: 0}));

            await act(async () => bridge.setViewSelection([11, 22]));

            for (const prefix of ['nwNewJobList', 'nwPodJobList', 'nwRepriceJobList']) {
                expect(listParamPushes[prefix]).toContainEqual({despatchViewIds: [11, 22], page: 0});
            }
        });

        it('clears the selection (driven by the host toolbar) and keeps it cleared in storage', async () => {
            const onLayoutBridgeReady = jest.fn();
            renderPage({onLayoutBridgeReady});
            const bridge = onLayoutBridgeReady.mock.calls[0][0];
            await waitFor(() => expect(listParamPushes['nwNewJobList']).toContainEqual({despatchViewIds: [11], page: 0}));

            await act(async () => bridge.setViewSelection([]));

            expect(localStorage.getItem(SELECTED_VIEWS_KEY)).toBe('[]');
            expect(listParamPushes['nwNewJobList']).toContainEqual({despatchViewIds: [], page: 0});
        });
    });

    describe('host toolbar bridge', () => {
        it('exposes a layout bridge to the host on mount', () => {
            const onLayoutBridgeReady = jest.fn();
            renderPage({onLayoutBridgeReady});
            expect(onLayoutBridgeReady).toHaveBeenCalledWith(
                expect.objectContaining({
                    setCurrentLayoutName: expect.any(Function),
                    reloadFromStorage: expect.any(Function),
                    promptSaveLayout: expect.any(Function),
                    promptDeleteLayout: expect.any(Function),
                    promptRenameLayout: expect.any(Function),
                    importLegacyLayouts: expect.any(Function),
                    resetCurrentLayout: expect.any(Function),
                    registerViewsListener: expect.any(Function),
                    setViewSelection: expect.any(Function),
                    updateRefreshIntervalMs: expect.any(Function),
                    updateFilters: expect.any(Function),
                }),
            );
        });

        it('mirrors the view list and selection to the host toolbar, in both directions', async () => {
            const onLayoutBridgeReady = jest.fn();
            renderPage({onLayoutBridgeReady});
            const bridge = onLayoutBridgeReady.mock.calls[0][0];

            const listener = jest.fn();
            bridge.registerViewsListener(listener);
            // Still loading -- the toolbar keeps its spinner rather than
            // flashing "No views available".
            expect(listener).not.toHaveBeenCalled();

            // React -> host: the loaded list arrives with the resolved selection.
            // (The listener may first fire with the pre-auto-select state, so
            // wait for the settled call rather than just "called".)
            await waitFor(() => expect(listener).toHaveBeenLastCalledWith([
                expect.objectContaining({id: 11, name: 'Auckland', selected: true}),
                expect.objectContaining({id: 22, name: 'Airport', selected: false}),
            ]));

            // Host -> React: the toolbar's Views menu drives the lists' scope.
            await act(async () => bridge.setViewSelection([22]));
            expect(listener).toHaveBeenLastCalledWith([
                expect.objectContaining({id: 11, name: 'Auckland', selected: false}),
                expect.objectContaining({id: 22, name: 'Airport', selected: true}),
            ]);
        });

        it('applies a refresh interval pushed from the host settings dialog', () => {
            const onLayoutBridgeReady = jest.fn();
            renderPage({onLayoutBridgeReady});
            const bridge = onLayoutBridgeReady.mock.calls[0][0];

            act(() => { bridge.updateRefreshIntervalMs(30_000); });

            for (const prefix of ['nwNewJobList', 'nwPodJobList', 'nwRepriceJobList']) {
                expect(listProps[prefix].fetchConfig?.refetchInterval).toBe(30_000);
            }
        });

        it('applies a date filter pushed from the host toolbar to every list', () => {
            // V1 wired date-filter-data/on-date-filter-refresh into the toolbar
            // (nationwide.template.html); nwV2 must do the same via the bridge.
            const onLayoutBridgeReady = jest.fn();
            renderPage({onLayoutBridgeReady});
            const bridge = onLayoutBridgeReady.mock.calls[0][0];

            const startDate = dayjs('2026-03-01');
            const endDate = dayjs('2026-03-02');
            act(() => { bridge.updateFilters({startDate, endDate, useTime: true}); });

            for (const prefix of ['nwNewJobList', 'nwPodJobList', 'nwRepriceJobList']) {
                expect(listProps[prefix].fetchConfig?.initialParams).toEqual(expect.objectContaining({
                    startDate, endDate, useTime: true,
                }));
            }
        });
    });

    describe('per-box manual refresh', () => {
        it('refreshes only the affected list, leaving non-list boxes as no-ops', async () => {
            const user = setupUser();
            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
            renderPage();

            for (const button of screen.getAllByRole('button', {name: 'Refresh'})) {
                await user.click(button);
            }

            const nationwideCalls = invalidateSpy.mock.calls
                .map(([opts]) => (opts as {queryKey?: unknown[]})?.queryKey)
                .filter((key): key is unknown[] => Array.isArray(key) && key[0] === 'nationwide');

            expect(nationwideCalls).toEqual(expect.arrayContaining([
                ['nationwide', 'newJobs'],
                ['nationwide', 'podJobs'],
                ['nationwide', 'repriceJobs'],
            ]));
            // One call per list box -- Map/Job Detail/Tasks/Available are no-ops.
            expect(nationwideCalls).toHaveLength(3);

            invalidateSpy.mockRestore();
        });
    });
});
