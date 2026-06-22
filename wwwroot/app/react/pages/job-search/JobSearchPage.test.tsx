import React, {act} from 'react';
import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';

// Captures the panel callbacks so tests can drive the search flow. Names are
// `mock`-prefixed so jest's hoisted factories may reference them.
const mockPanel: {
    onSearch?: () => void;
    onCriteriaChange?: (field: string, value: unknown) => void;
    updateParams: Record<string, jest.Mock>;
} = {updateParams: {}};

jest.mock('../../components/common/search-criteria-panel/SearchCriteriaPanel', () => ({
    SearchCriteriaPanel: ({onSearch, onCriteriaChange}: {onSearch: () => void; onCriteriaChange: (f: string, v: unknown) => void}) => {
        mockPanel.onSearch = onSearch;
        mockPanel.onCriteriaChange = onCriteriaChange;
        return <div data-testid="mock-search-panel" />;
    },
}));

jest.mock('../../components/job-list/JobListPanel', () => ({
    JobListPanel: ({storagePrefix, setUpdateSearchParamsCallback}: {storagePrefix: string; setUpdateSearchParamsCallback?: (cb: jest.Mock) => void}) => {
        const fn = mockPanel.updateParams[storagePrefix] ?? (mockPanel.updateParams[storagePrefix] = jest.fn());
        setUpdateSearchParamsCallback?.(fn);
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

function renderPage(overrides: Partial<React.ComponentProps<typeof JobSearchPage>> = {}) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={createTheme()}>
                <JobSearchPage
                    showToast={jest.fn()}
                    isUsCustomer={false}
                    timeZone="New Zealand Standard Time"
                    {...overrides}
                />
            </ThemeProvider>
        </QueryClientProvider>,
    );
}

describe('JobSearchPage', () => {
    beforeEach(() => {
        mockPanel.onSearch = undefined;
        mockPanel.onCriteriaChange = undefined;
        mockPanel.updateParams = {};
    });

    it('renders the search criteria panel, main job list, and bulk job list', () => {
        renderPage();
        expect(screen.getByTestId('mock-search-panel')).toBeInTheDocument();
        expect(screen.getByTestId('mock-job-list-jobSearchJobList')).toBeInTheDocument();
        expect(screen.getByTestId('mock-job-list-jobSearchBulkList')).toBeInTheDocument();
    });

    it('shows placeholder text for the job detail and delivery journey when no job is selected', () => {
        renderPage();
        expect(screen.getByText(/select a job from the list/i)).toBeInTheDocument();
        expect(screen.getByText(/select a job to see its delivery journey/i)).toBeInTheDocument();
    });

    it('renders the DispatchMap in the map box', () => {
        renderPage();
        expect(screen.getByTestId('mock-dispatch-map')).toBeInTheDocument();
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

    it('renders each default-layout box header with its title', () => {
        renderPage();
        expect(screen.getByText('Filters')).toBeInTheDocument();
        expect(screen.getByText('Live Job Data')).toBeInTheDocument();
        expect(screen.getByText('Bulk Job Data')).toBeInTheDocument();
        expect(screen.getByText('Detail')).toBeInTheDocument();
        expect(screen.getByText('Scan Detail')).toBeInTheDocument();
        expect(screen.getByText('Map')).toBeInTheDocument();
        expect(screen.getByText('Delivery Journey')).toBeInTheDocument();
    });
});
