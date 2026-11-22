import type {Mock} from 'vitest';
import React, {act} from 'react';
import {render, screen, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import dayjs, {Dayjs} from 'dayjs';
import type {SearchActionDates} from '../../components/common/search-criteria-panel/SearchCriteriaPanel';

// Captures the panel callbacks so tests can drive the search flow. Names are
// `mock`-prefixed so jest's hoisted factories may reference them.
const mockPanel: {
    onSearch?: (dates?: SearchActionDates) => void;
    onCriteriaChange?: (field: string, value: unknown) => void;
    onFromDateChange?: (date: Dayjs) => void;
    onToDateChange?: (date: Dayjs) => void;
    onDownload?: (dates?: SearchActionDates) => void;
    onClientReport?: (dates?: SearchActionDates) => void;
    onCourierSearch?: (text: string) => Promise<unknown[]>;
    onSpeedSearch?: (text: string) => Promise<unknown[]>;
    updateParams: Record<string, Mock>;
    onJobSelect: Record<string, (job: unknown) => void>;
} = {updateParams: {}, onJobSelect: {}};

vi.mock('../../components/common/search-criteria-panel/SearchCriteriaPanel', () => ({
    SearchCriteriaPanel: ({onSearch, onCriteriaChange, onFromDateChange, onToDateChange, onDownload, onClientReport, onCourierSearch, onSpeedSearch}: {
        onSearch: (dates?: SearchActionDates) => void;
        onCriteriaChange: (f: string, v: unknown) => void;
        onFromDateChange: (d: Dayjs) => void;
        onToDateChange: (d: Dayjs) => void;
        onDownload: (dates?: SearchActionDates) => void;
        onClientReport: (dates?: SearchActionDates) => void;
        onCourierSearch?: (text: string) => Promise<unknown[]>;
        onSpeedSearch?: (text: string) => Promise<unknown[]>;
    }) => {
        mockPanel.onCourierSearch = onCourierSearch;
        mockPanel.onSpeedSearch = onSpeedSearch;
        mockPanel.onSearch = onSearch;
        mockPanel.onCriteriaChange = onCriteriaChange;
        mockPanel.onFromDateChange = onFromDateChange;
        mockPanel.onToDateChange = onToDateChange;
        mockPanel.onDownload = onDownload;
        mockPanel.onClientReport = onClientReport;
        return <div data-testid="mock-search-panel" />;
    },
}));

vi.mock('../../components/job-list/JobListPanel', () => ({
    JobListPanel: ({storagePrefix, setUpdateSearchParamsCallback, onJobSelect}: {
        storagePrefix: string;
        setUpdateSearchParamsCallback?: (cb: Mock) => void;
        onJobSelect?: (job: unknown) => void;
    }) => {
        const fn = mockPanel.updateParams[storagePrefix] ?? (mockPanel.updateParams[storagePrefix] = vi.fn());
        setUpdateSearchParamsCallback?.(fn);
        if (onJobSelect) mockPanel.onJobSelect[storagePrefix] = onJobSelect;
        return <div data-testid={`mock-job-list-${storagePrefix}`} />;
    },
}));

vi.mock('../../api/dispatchExecutorApi', async () => ({
    ...(await vi.importActual<typeof import('../../api/dispatchExecutorApi')>('../../api/dispatchExecutorApi')),
    getDispatchJobDetail: vi.fn(() => new Promise(() => {})),
    searchSpeedOptions: vi.fn(),
}));

vi.mock('../../api/courierApi', async () => ({
    ...(await vi.importActual<typeof import('../../api/courierApi')>('../../api/courierApi')),
    searchActiveCouriers: vi.fn(),
}));

vi.mock('../../api/preferencesApi', () => ({
    getPreference: vi.fn().mockResolvedValue(null),
    savePreference: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../components/common/task-history/TaskHistory', () => ({
    TaskHistory: ({jobId}: {jobId: number}) => <div data-testid="mock-task-history" data-job-id={jobId} />,
}));

vi.mock('./components/ScanList', () => ({
    ScanList: () => <div data-testid="mock-scan-list" />,
}));

vi.mock('../../components/common/dispatch-map/DispatchMap', () => ({
    DispatchMap: () => <div data-testid="mock-dispatch-map" />,
}));

vi.mock('./hooks/useScanDetail', () => ({
    useScanDetail: () => ({scans: [], isLoading: false, isError: false, refetch: vi.fn()}),
}));

vi.mock('../../api/jobSearchApi', async () => ({
    ...(await vi.importActual<typeof import('../../api/jobSearchApi')>('../../api/jobSearchApi')),
    fetchDispatchBulkJobDetail: vi.fn(() => new Promise(() => {})),
}));

vi.mock('../../api/jobDetailApi', async () => ({
    ...(await vi.importActual<typeof import('../../api/jobDetailApi')>('../../api/jobDetailApi')),
    getJobLabel: vi.fn(),
}));

vi.mock('../../utils/printPdf', () => ({
    printPdf: vi.fn(),
    openPdf: vi.fn(),
}));

const mockLoadingToast = {update: vi.fn(), dismiss: vi.fn()};
vi.mock('../../services/toastService', async () => ({
    ...(await vi.importActual<typeof import('../../services/toastService')>('../../services/toastService')),
    toastService: {showLoadingToast: vi.fn(() => mockLoadingToast), showPersistentToast: vi.fn()},
}));

import {JobSearchPage} from './JobSearchPage';
import type {JobSearchLayoutBridge} from './JobSearchLayoutBridge';
import {getDispatchJobDetail, searchSpeedOptions} from '../../api/dispatchExecutorApi';
import {searchActiveCouriers} from '../../api/courierApi';
import {MantineTestProvider} from '../../test/utils';
import {setupUser} from '../../test/utils/setupUser';
import {getJobLabel} from '../../api/jobDetailApi';
import {fetchDispatchBulkJobDetail} from '../../api/jobSearchApi';
import {openPdf, printPdf} from '../../utils/printPdf';
import {toastService} from '../../services/toastService';

function renderPage(overrides: Partial<React.ComponentProps<typeof JobSearchPage>> = {}) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <JobSearchPage
                    showToast={vi.fn()}
                    isUsCustomer={false}
                    timeZone="New Zealand Standard Time"
                    {...overrides}
                />
            </MantineTestProvider>
        </QueryClientProvider>,
    );
}

describe('JobSearchPage', () => {
    beforeEach(() => {
        mockPanel.onSearch = undefined;
        mockPanel.onCriteriaChange = undefined;
        mockPanel.onFromDateChange = undefined;
        mockPanel.onToDateChange = undefined;
        mockPanel.onDownload = undefined;
        mockPanel.onClientReport = undefined;
        mockPanel.updateParams = {};
        mockPanel.onJobSelect = {};
    });

    it('anchors the job actions menu in the Job Detail panel header', () => {
        renderPage();
        act(() => {
            mockPanel.onJobSelect.jobSearchJobList?.({id: 7, jobNo: 'J7'});
        });

        // Exactly one trigger, and it lives inside the Detail panel's own header —
        // not floating over the shell where it reads as a Delivery Journey control.
        const triggers = screen.getAllByRole('button', {name: 'Job actions'});
        expect(triggers).toHaveLength(1);

        const detailHeader = screen.getAllByTestId('panel-header')
            .find(header => within(header).queryByText('Detail · J7'));
        expect(detailHeader).toBeDefined();
        expect(detailHeader).toContainElement(triggers[0]);
    });

    describe('Print labels', () => {
        async function printLabelFor(job: Record<string, unknown>, showToast = vi.fn()) {
            const user = setupUser();
            renderPage({showToast});
            act(() => {
                mockPanel.onJobSelect.jobSearchJobList?.({jobNo: 'J7', ...job});
            });
            await user.click(screen.getByRole('button', {name: 'Job actions'}));
            await user.click(screen.getByRole('menuitem', {name: 'Print labels'}));
            return showToast;
        }

        const label = new Blob(['%PDF']);

        beforeEach(() => {
            vi.clearAllMocks();
            (getJobLabel as Mock).mockResolvedValue(label);
            (printPdf as Mock).mockResolvedValue(true);
        });

        it('prints the job label', async () => {
            await printLabelFor({id: 7});
            expect(getJobLabel).toHaveBeenCalledWith(7, false);
            await vi.waitFor(() => expect(printPdf).toHaveBeenCalledWith(label));
            expect(mockLoadingToast.dismiss).toHaveBeenCalled();
        });

        it('asks for a bulk row by its bulk id', async () => {
            await printLabelFor({id: 8, isBulkJob: true});
            expect(getJobLabel).toHaveBeenCalledWith(8, true);
        });

        it('prints the live job behind a bulk row that has one', async () => {
            await printLabelFor({id: 8, isBulkJob: true, linkedJobId: 70});
            expect(getJobLabel).toHaveBeenCalledWith(70, false);
        });

        it('ignores a second click while the label is still loading', async () => {
            (getJobLabel as Mock).mockReturnValue(new Promise(() => {}));
            const user = setupUser();
            renderPage();
            act(() => {
                mockPanel.onJobSelect.jobSearchJobList?.({jobNo: 'J7', id: 7});
            });
            for (let i = 0; i < 2; i++) {
                await user.click(screen.getByRole('button', {name: 'Job actions'}));
                await user.click(screen.getByRole('menuitem', {name: 'Print labels'}));
            }
            expect(getJobLabel).toHaveBeenCalledOnce();
        });

        it('shows the server reason in the loading toast and never prints', async () => {
            (getJobLabel as Mock).mockRejectedValue(new Error("This job's label comes from the courier network."));

            await printLabelFor({id: 7});

            await vi.waitFor(() => expect(mockLoadingToast.update)
                .toHaveBeenCalledWith("This job's label comes from the courier network.", 'error'));
            expect(printPdf).not.toHaveBeenCalled();
        });

        it('keeps an Open label button up when the browser blocks printing', async () => {
            (printPdf as Mock).mockResolvedValue(false);
            (openPdf as Mock).mockReturnValue(true);

            await printLabelFor({id: 7});

            await vi.waitFor(() => expect(toastService.showPersistentToast).toHaveBeenCalledWith(
                'Your browser blocked the label.', expect.objectContaining({label: 'Open label'})));
            (toastService.showPersistentToast as Mock).mock.calls.at(-1)![1].onClick();
            expect(openPdf).toHaveBeenCalledWith(label);
        });

        it('replaces an earlier blocked-label toast rather than stacking them', async () => {
            (printPdf as Mock).mockResolvedValue(false);
            const dismissFirst = vi.fn();
            (toastService.showPersistentToast as Mock).mockReturnValueOnce(dismissFirst);
            const user = setupUser();
            renderPage();
            act(() => {
                mockPanel.onJobSelect.jobSearchJobList?.({jobNo: 'J7', id: 7});
            });
            for (let i = 0; i < 2; i++) {
                await user.click(screen.getByRole('button', {name: 'Job actions'}));
                await user.click(screen.getByRole('menuitem', {name: 'Print labels'}));
                await vi.waitFor(() => expect(toastService.showPersistentToast).toHaveBeenCalledTimes(i + 1));
            }
            expect(dismissFirst).toHaveBeenCalledOnce();
        });

        it('keeps the loading toast up until printing has started', async () => {
            let finishPrint!: (printed: boolean) => void;
            (printPdf as Mock).mockReturnValue(new Promise(resolve => { finishPrint = resolve; }));

            await printLabelFor({id: 7});
            await vi.waitFor(() => expect(printPdf).toHaveBeenCalled());
            expect(mockLoadingToast.dismiss).not.toHaveBeenCalled();

            await act(async () => finishPrint(true));
            expect(mockLoadingToast.dismiss).toHaveBeenCalled();
        });
    });

    it('opens a newly created job in the detail panel via the layout bridge', async () => {
        (getDispatchJobDetail as Mock).mockResolvedValueOnce({id: 42, jobNo: 'J42'});
        let bridge: JobSearchLayoutBridge | undefined;
        renderPage({onLayoutBridgeReady: b => { bridge = b; }});

        await act(async () => {
            bridge!.jobCreated(42);
        });

        expect(getDispatchJobDetail).toHaveBeenCalledWith(42);
        const detailHeader = screen.getAllByTestId('panel-header')
            .find(header => within(header).queryByText('Detail · J42'));
        expect(detailHeader).toBeDefined();
    });

    describe('Delivery journey', () => {
        it("shows a live job's own journey", () => {
            renderPage();
            act(() => mockPanel.onJobSelect.jobSearchJobList?.({id: 7, jobNo: 'J7'}));
            expect(screen.getByTestId('mock-task-history')).toHaveAttribute('data-job-id', '7');
        });

        it('shows the live job behind a bulk row, never the bulk id read as a live job', () => {
            renderPage();
            act(() => mockPanel.onJobSelect.jobSearchBulkList?.({id: 7782, jobNo: 'E901BIO', isBulkJob: true, linkedJobId: 9100}));
            expect(screen.getByTestId('mock-task-history')).toHaveAttribute('data-job-id', '9100');
        });

        it('picks up the live job from the full bulk detail when the list row lacks it', async () => {
            (fetchDispatchBulkJobDetail as Mock).mockResolvedValueOnce(
                {id: 7782, jobNo: 'E901BIO', isBulkJob: true, linkedJobId: 9100});
            renderPage();
            act(() => mockPanel.onJobSelect.jobSearchBulkList?.({id: 7782, jobNo: 'E901BIO', isBulkJob: true}));
            expect(await screen.findByTestId('mock-task-history')).toHaveAttribute('data-job-id', '9100');
        });

        it('explains that a bulk row that has not gone live has no journey yet', () => {
            renderPage();
            act(() => mockPanel.onJobSelect.jobSearchBulkList?.({id: 7782, jobNo: 'E901BIO', isBulkJob: true}));
            expect(screen.queryByTestId('mock-task-history')).not.toBeInTheDocument();
            expect(screen.getByText(/hasn't gone live yet/i)).toBeInTheDocument();
        });
    });

    it('renders the default layout: panels, lists, map, box headers, and empty placeholders', () => {
        renderPage();

        // Panels and lists
        expect(screen.getByTestId('mock-search-panel')).toBeInTheDocument();
        expect(screen.getByTestId('mock-job-list-jobSearchJobList')).toBeInTheDocument();
        expect(screen.getByTestId('mock-job-list-jobSearchBulkList')).toBeInTheDocument();
        expect(screen.getByTestId('mock-dispatch-map')).toBeInTheDocument();

        // Box headers
        expect(screen.getByText('Filters')).toBeInTheDocument();
        expect(screen.getByText('Live job data')).toBeInTheDocument();
        expect(screen.getByText('Bulk job data')).toBeInTheDocument();
        expect(screen.getByText('Detail')).toBeInTheDocument();
        expect(screen.getByText('Scan detail')).toBeInTheDocument();
        expect(screen.getByText('Map')).toBeInTheDocument();
        expect(screen.getByText('Delivery journey')).toBeInTheDocument();

        // Empty-state placeholders
        expect(screen.getByText(/select a job from the list/i)).toBeInTheDocument();
        expect(screen.getByText(/select a job to see its delivery journey/i)).toBeInTheDocument();
    });

    it('disables the bulk list when searching by a specific job id', () => {
        renderPage();
        act(() => {
            mockPanel.onCriteriaChange?.('jobId', 12345);
        });
        act(() => {
            mockPanel.onSearch?.();
        });

        const mainCall = mockPanel.updateParams.jobSearchJobList.mock.calls.at(-1)?.[0];
        const bulkCall = mockPanel.updateParams.jobSearchBulkList.mock.calls.at(-1)?.[0];
        expect(mainCall).toMatchObject({jobId: 12345, disabled: false});
        expect(bulkCall).toMatchObject({disabled: true});
    });

    it('disables the main list when searching by a specific bulk job id', () => {
        renderPage();
        act(() => {
            mockPanel.onCriteriaChange?.('bulkJobId', 999);
        });
        act(() => {
            mockPanel.onSearch?.();
        });

        const mainCall = mockPanel.updateParams.jobSearchJobList.mock.calls.at(-1)?.[0];
        const bulkCall = mockPanel.updateParams.jobSearchBulkList.mock.calls.at(-1)?.[0];
        expect(mainCall).toMatchObject({disabled: true});
        expect(bulkCall).toMatchObject({bulkJobId: 999, disabled: false});
    });

    it('downloads via the real PodSearchDownload endpoint in a new tab', () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        renderPage();
        act(() => {
            mockPanel.onDownload?.();
        });
        const url = openSpy.mock.calls.at(-1)?.[0] as string;
        expect(url).toMatch(/^\/Job\/PodSearchDownload\?/);
        expect(openSpy.mock.calls.at(-1)?.[1]).toBe('_blank');
        openSpy.mockRestore();
    });

    it('opens the client jobs report via the real ClientJobsReportDownload endpoint', () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        renderPage();
        act(() => {
            mockPanel.onClientReport?.();
        });
        const url = openSpy.mock.calls.at(-1)?.[0] as string;
        expect(url).toMatch(/^\/Job\/ClientJobsReportDownload\?/);
        openSpy.mockRestore();
    });

    // The panel keeps the custom From/To locally and flushes them in the same click
    // that fires the search, so a handler reading committed state sees the previous
    // range — the "first search ignores my dates, the second one works" report.
    describe('dates flushed in the same tick as the action', () => {
        const from = dayjs('2026-08-12');
        const to = dayjs('2026-08-20');

        function flushDatesAnd(action: (dates: {fromDate: Dayjs; toDate: Dayjs}) => void) {
            act(() => {
                mockPanel.onFromDateChange?.(from);
                mockPanel.onToDateChange?.(to);
                action({fromDate: from, toDate: to});
            });
        }

        it('searches both lists with the just-flushed dates, not the previous range', () => {
            renderPage();
            flushDatesAnd(dates => mockPanel.onSearch?.(dates));

            const mainCall = mockPanel.updateParams.jobSearchJobList.mock.calls.at(-1)?.[0];
            const bulkCall = mockPanel.updateParams.jobSearchBulkList.mock.calls.at(-1)?.[0];
            for (const call of [mainCall, bulkCall]) {
                expect(call.startDate.format('YYYY-MM-DD')).toBe('2026-08-12');
                expect(call.endDate.format('YYYY-MM-DD')).toBe('2026-08-20');
            }
        });

        it('exports the just-flushed dates on download and client report', () => {
            const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
            renderPage();

            flushDatesAnd(dates => mockPanel.onDownload?.(dates));
            const downloadUrl = openSpy.mock.calls.at(-1)?.[0] as string;
            expect(downloadUrl).toContain('2026-08-12');
            expect(downloadUrl).toContain('2026-08-20');

            flushDatesAnd(dates => mockPanel.onClientReport?.(dates));
            const reportUrl = openSpy.mock.calls.at(-1)?.[0] as string;
            expect(reportUrl).toContain('2026-08-12');
            expect(reportUrl).toContain('2026-08-20');

            openSpy.mockRestore();
        });
    });
});

describe('JobSearchPage error feedback', () => {
    // These three paths used to fail with nothing but a console.error, so an
    // operator saw a spinner stop or an empty dropdown and no explanation.
    const suppress = () => vi.spyOn(console, 'error').mockImplementation(() => {});

    beforeEach(() => {
        mockPanel.onCourierSearch = undefined;
        mockPanel.onSpeedSearch = undefined;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('toasts when the full job detail fails to load', async () => {
        suppress();
        (getDispatchJobDetail as Mock).mockRejectedValue(new Error('boom'));
        const showToast = vi.fn();
        renderPage({showToast});

        await act(async () => {
            mockPanel.onJobSelect['jobSearchJobList']?.({id: 5, jobNo: 'JOB-5'});
        });

        expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/job detail/i), 'error');
    });

    it('toasts when the courier search fails', async () => {
        suppress();
        (searchActiveCouriers as Mock).mockRejectedValue(new Error('boom'));
        const showToast = vi.fn();
        renderPage({showToast});

        await act(async () => {
            await mockPanel.onCourierSearch?.('abc');
        });

        expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/courier/i), 'error');
    });

    it('toasts when the speed search fails', async () => {
        suppress();
        (searchSpeedOptions as Mock).mockRejectedValue(new Error('boom'));
        const showToast = vi.fn();
        renderPage({showToast});

        await act(async () => {
            await mockPanel.onSpeedSearch?.('abc');
        });

        expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/service|speed/i), 'error');
    });
});
