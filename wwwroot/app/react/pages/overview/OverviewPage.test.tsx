/** @jest-environment jest-environment-jsdom */
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {OverviewPage} from './OverviewPage';

// ContactID and FirstName are defined in setup.ts as 0 and 'Test'

// Mock child components to isolate OverviewPage logic
jest.mock('./components/FilterPanel', () => ({
    FilterPanel: (props: any) => <div data-testid="filter-panel">FilterPanel</div>,
}));

jest.mock('./components/StatsTabs', () => ({
    StatsTabs: (props: any) => (
        <div data-testid="stats-tabs" onClick={() => props.onTabChange(1)}>
            StatsTabs: active={props.activeTab}
        </div>
    ),
}));

jest.mock('./components/DeliveriesTable', () => ({
    DeliveriesTable: (props: any) => (
        <div data-testid="deliveries-table">
            DeliveriesTable: loading={String(props.isLoading)} total={props.total}
        </div>
    ),
}));

jest.mock('./components/OpenJobsWidget', () => ({
    OpenJobsWidget: (props: any) => (
        <div data-testid="open-jobs-widget">
            OpenJobsWidget: loading={String(props.isLoading)} count={props.openJobs?.length ?? 0}
        </div>
    ),
}));

jest.mock('./components/MapDialog', () => ({
    MapDialog: (props: any) => (
        props.open ? <div data-testid="map-dialog">MapDialog</div> : null
    ),
}));

// Mock hooks
jest.mock('../../hooks/useOverviewApi', () => ({
    useOverviewJobs: jest.fn(),
    useOverviewRegions: jest.fn(),
    useOverviewSpeeds: jest.fn(),
    useOverviewStats: jest.fn(),
    useOverviewOpenJobs: jest.fn(),
    useCourierSearch: jest.fn(),
}));

jest.mock('../../../functions/aiSettings', () => ({
    isAiEnabled: jest.fn(() => false),
}));

import {
    useOverviewJobs,
    useOverviewRegions,
    useOverviewSpeeds,
    useOverviewStats,
    useOverviewOpenJobs,
} from '../../hooks/useOverviewApi';

const mockUseOverviewJobs = useOverviewJobs as jest.MockedFunction<typeof useOverviewJobs>;
const mockUseOverviewRegions = useOverviewRegions as jest.MockedFunction<typeof useOverviewRegions>;
const mockUseOverviewSpeeds = useOverviewSpeeds as jest.MockedFunction<typeof useOverviewSpeeds>;
const mockUseOverviewStats = useOverviewStats as jest.MockedFunction<typeof useOverviewStats>;
const mockUseOverviewOpenJobs = useOverviewOpenJobs as jest.MockedFunction<typeof useOverviewOpenJobs>;

const theme = createTheme();

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {queries: {retry: false, gcTime: 0}},
    });

function renderOverviewPage(overrides: Partial<React.ComponentProps<typeof OverviewPage>> = {}) {
    const queryClient = createTestQueryClient();
    const defaultProps = {
        showToast: {
            showSuccessToast: jest.fn(),
            showWarningToast: jest.fn(),
            showErrorToast: jest.fn(),
            showInfoToast: jest.fn(),
        },
        isUsCustomer: false,
        onOpenJobDetail: jest.fn(),
        setRefreshCallback: jest.fn(),
        ...overrides,
    };

    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <OverviewPage {...defaultProps} />
            </ThemeProvider>
        </QueryClientProvider>,
    );
}

describe('OverviewPage', () => {
    beforeEach(() => {
        localStorage.clear();

        // Default hook return values
        mockUseOverviewJobs.mockReturnValue({
            data: {items: [], total: 0, page: 1, pages: 0},
            isLoading: false,
        } as any);

        mockUseOverviewRegions.mockReturnValue({
            data: [{id: 1, text: 'London'}],
            isLoading: false,
        } as any);

        mockUseOverviewSpeeds.mockReturnValue({
            data: [{id: 1, text: 'Same Day'}],
            isLoading: false,
        } as any);

        mockUseOverviewStats.mockReturnValue({
            data: {active: 10, inactive: 3, completed: 42},
        } as any);

        mockUseOverviewOpenJobs.mockReturnValue({
            data: [],
            isLoading: false,
        } as any);
    });

    describe('Initial render', () => {
        it('renders the Overview header', () => {
            renderOverviewPage();
            expect(screen.getByText('Overview')).toBeInTheDocument();
        });

        it('renders FilterPanel', () => {
            renderOverviewPage();
            expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
        });

        it('renders StatsTabs', () => {
            renderOverviewPage();
            expect(screen.getByTestId('stats-tabs')).toBeInTheDocument();
        });

        it('renders DeliveriesTable', () => {
            renderOverviewPage();
            expect(screen.getByTestId('deliveries-table')).toBeInTheDocument();
        });

        it('renders OpenJobsWidget', () => {
            renderOverviewPage();
            expect(screen.getByTestId('open-jobs-widget')).toBeInTheDocument();
        });

        it('renders search input', () => {
            renderOverviewPage();
            expect(screen.getByPlaceholderText('Search deliveries...')).toBeInTheDocument();
        });
    });

    describe('Collapse behavior', () => {
        it('saves collapse state when toggled', () => {
            renderOverviewPage();

            const collapseButton = screen.getByText('expand_less').closest('button')!;
            fireEvent.click(collapseButton);

            // Verify state was persisted to localStorage
            const saved = JSON.parse(localStorage.getItem('cardCollapseStates') ?? '{}');
            expect(saved.overview).toBe(true);
        });

        it('shows expand_more icon when collapsed from localStorage', () => {
            localStorage.setItem('cardCollapseStates', JSON.stringify({overview: true}));
            renderOverviewPage();

            // When collapsed, the icon should be expand_more
            expect(screen.getByText('expand_more')).toBeInTheDocument();
        });
    });

    describe('setRefreshCallback', () => {
        it('registers refresh callback', () => {
            const setRefreshCallback = jest.fn();
            renderOverviewPage({setRefreshCallback});

            expect(setRefreshCallback).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    describe('Loading states', () => {
        it('passes loading state to DeliveriesTable', () => {
            mockUseOverviewJobs.mockReturnValue({
                data: undefined,
                isLoading: true,
            } as any);

            renderOverviewPage();

            expect(screen.getByTestId('deliveries-table')).toHaveTextContent('loading=true');
        });

        it('passes loading state to OpenJobsWidget', () => {
            mockUseOverviewOpenJobs.mockReturnValue({
                data: [],
                isLoading: true,
            } as any);

            renderOverviewPage();

            expect(screen.getByTestId('open-jobs-widget')).toHaveTextContent('loading=true');
        });
    });

    describe('Query parameters', () => {
        it('passes default query params to jobs hook', () => {
            renderOverviewPage();

            expect(mockUseOverviewJobs).toHaveBeenCalledWith(
                expect.objectContaining({
                    statusGroup: 1,
                    page: 1,
                    limit: 20,
                    orderBy: 'jobName',
                    orderDirection: 'asc',
                }),
            );
        });

        it('restores page limit from localStorage', () => {
            localStorage.setItem('overviewJobLimitDisplay-0', '50');
            renderOverviewPage();

            expect(mockUseOverviewJobs).toHaveBeenCalledWith(
                expect.objectContaining({limit: 50}),
            );
        });
    });
});
