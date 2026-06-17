import React from 'react';
import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';

jest.mock('../../components/common/search-criteria-panel/SearchCriteriaPanel', () => ({
    SearchCriteriaPanel: () => <div data-testid="mock-search-panel" />,
}));

jest.mock('../../components/job-list/JobListPanel', () => ({
    JobListPanel: ({storagePrefix}: {storagePrefix?: string}) => (
        <div data-testid={`mock-job-list-${storagePrefix}`} />
    ),
}));

jest.mock('../../components/common/task-history/TaskHistory', () => ({
    TaskHistory: () => <div data-testid="mock-task-history" />,
}));

jest.mock('./components/ScanList', () => ({
    ScanList: () => <div data-testid="mock-scan-list" />,
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

    it('shows a placeholder for the map box (Phase 3 will wire DispatchMap)', () => {
        renderPage();
        expect(screen.getByText(/map integration will land in phase 3/i)).toBeInTheDocument();
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
