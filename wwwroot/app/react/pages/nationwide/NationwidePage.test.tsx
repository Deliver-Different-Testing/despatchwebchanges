import React from 'react';
import {act, render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

// The job list and map pull in heavy dependencies; stub them and capture the
// props the page hands over, which is what this suite is actually about.
const listProps: Record<string, {
    storagePrefix: string;
    fetchConfig?: {queryKeyFn?: unknown; initialParams?: Record<string, unknown>};
    onJobSelect?: (job: unknown) => void;
}> = {};
jest.mock('../../components/job-list/JobListPanel', () => ({
    JobListPanel: (props: {
        storagePrefix: string;
        fetchConfig?: {queryKeyFn?: unknown; initialParams?: Record<string, unknown>};
        onJobSelect?: (job: unknown) => void;
    }) => {
        listProps[props.storagePrefix] = props;
        return <div data-testid={`mock-job-list-${props.storagePrefix}`}/>;
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

const dispatchDialogProps: {open?: boolean; initialType?: string; existingDestination?: {id: number; text: string}} = {};
jest.mock('../../components/dialogs/dispatch-dialog', () => ({
    DispatchDialog: (props: {open?: boolean; initialType?: string; existingDestination?: {id: number; text: string}}) => {
        Object.assign(dispatchDialogProps, props);
        return <div data-testid="mock-dispatch-dialog"/>;
    },
}));

jest.mock('../../services/dispatchExecutorApi', () => ({
    ...jest.requireActual('../../services/dispatchExecutorApi'),
    getDispatchJobDetail: jest.fn(() => new Promise(() => {})),
}));

import {NationwidePage} from './NationwidePage';
import {MantineTestProvider} from '../../__testUtils__';

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
    });

    it('renders all three job lists, each with its own storage prefix', () => {
        renderPage();

        expect(screen.getByTestId('mock-job-list-nwNewJobList')).toBeInTheDocument();
        expect(screen.getByTestId('mock-job-list-nwPodJobList')).toBeInTheDocument();
        expect(screen.getByTestId('mock-job-list-nwRepriceJobList')).toBeInTheDocument();
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

    it('seeds every list from the persisted date filter', () => {
        renderPage();

        for (const prefix of ['nwNewJobList', 'nwPodJobList', 'nwRepriceJobList']) {
            const params = listProps[prefix].fetchConfig?.initialParams;
            expect(params?.startDate).toBeDefined();
            expect(params?.endDate).toBeDefined();
        }
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
    });
});
