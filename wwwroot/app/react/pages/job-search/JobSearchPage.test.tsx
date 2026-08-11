import React, {act} from 'react';
import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';

// Captures the panel callbacks so tests can drive the search flow. Names are
// `mock`-prefixed so jest's hoisted factories may reference them.
const mockPanel: {
    onSearch?: () => void;
    onCriteriaChange?: (field: string, value: unknown) => void;
    onDownload?: () => void;
    onClientReport?: () => void;
    onBackendFilter?: (column: string, direction: string) => void;
    updateParams: Record<string, jest.Mock>;
} = {updateParams: {}};

jest.mock('../../components/common/search-criteria-panel/SearchCriteriaPanel', () => ({
    SearchCriteriaPanel: ({onSearch, onCriteriaChange, onDownload, onClientReport}: {
        onSearch: () => void;
        onCriteriaChange: (f: string, v: unknown) => void;
        onDownload: () => void;
        onClientReport: () => void;
    }) => {
        mockPanel.onSearch = onSearch;
        mockPanel.onCriteriaChange = onCriteriaChange;
        mockPanel.onDownload = onDownload;
        mockPanel.onClientReport = onClientReport;
        return <div data-testid="mock-search-panel" />;
    },
}));

jest.mock('../../components/job-list/JobListPanel', () => ({
    JobListPanel: ({storagePrefix, setUpdateSearchParamsCallback, onBackendFilter}: {
        storagePrefix: string;
        setUpdateSearchParamsCallback?: (cb: jest.Mock) => void;
        onBackendFilter?: (column: string, direction: string) => void;
    }) => {
        const fn = mockPanel.updateParams[storagePrefix] ?? (mockPanel.updateParams[storagePrefix] = jest.fn());
        setUpdateSearchParamsCallback?.(fn);
        if (onBackendFilter) mockPanel.onBackendFilter = onBackendFilter;
        return <div data-testid={`mock-job-list-${storagePrefix}`} />;
    },
}));

jest.mock('../../components/common/task-history/TaskHistory', () => ({
    TaskHistory: () => <div data-testid="mock-task-history" />,
}));

jest.mock('./components/ScanList', () => ({
    ScanList: () => <div data-testid="mock-scan-list" />,
}));

jest.mock('../../components/common/dispatch-map/DispatchMap', () => ({
    DispatchMap: () => <div data-testid="mock-dispatch-map" />,
}));

jest.mock('./hooks/useScanDetail', () => ({
    useScanDetail: () => ({scans: [], isLoading: false, isError: false, refetch: jest.fn()}),
}));

import {JobSearchPage} from './JobSearchPage';
import {MantineTestProvider} from '../../__testUtils__';

function renderPage(overrides: Partial<React.ComponentProps<typeof JobSearchPage>> = {}) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider><ThemeProvider theme={createTheme()}>
                <JobSearchPage
                    showToast={jest.fn()}
                    isUsCustomer={false}
                    timeZone="New Zealand Standard Time"
                    {...overrides}
                />
            </ThemeProvider></MantineTestProvider>
        </QueryClientProvider>,
    );
}

describe('JobSearchPage', () => {
    beforeEach(() => {
        mockPanel.onSearch = undefined;
        mockPanel.onCriteriaChange = undefined;
        mockPanel.onDownload = undefined;
        mockPanel.onClientReport = undefined;
        mockPanel.onBackendFilter = undefined;
        mockPanel.updateParams = {};
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
        expect(screen.getByText('Live Job Data')).toBeInTheDocument();
        expect(screen.getByText('Bulk Job Data')).toBeInTheDocument();
        expect(screen.getByText('Detail')).toBeInTheDocument();
        expect(screen.getByText('Scan Detail')).toBeInTheDocument();
        expect(screen.getByText('Map')).toBeInTheDocument();
        expect(screen.getByText('Delivery Journey')).toBeInTheDocument();

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
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
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
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        renderPage();
        act(() => {
            mockPanel.onClientReport?.();
        });
        const url = openSpy.mock.calls.at(-1)?.[0] as string;
        expect(url).toMatch(/^\/Job\/ClientJobsReportDownload\?/);
        openSpy.mockRestore();
    });

    it('re-pushes the active sort to the main list on search', () => {
        renderPage();
        act(() => {
            mockPanel.onBackendFilter?.('jobNo', 'desc');
        });
        act(() => {
            mockPanel.onSearch?.();
        });
        const mainCall = mockPanel.updateParams.jobSearchJobList.mock.calls.at(-1)?.[0];
        expect(mainCall).toMatchObject({sortColumn: 'jobNo', sortDirection: 'desc'});
    });
});
