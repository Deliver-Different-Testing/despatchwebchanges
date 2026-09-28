/** @jest-environment jest-environment-jsdom */
import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {MapDialog} from './MapDialog';
import {overviewApi} from '../../../services/overviewApi';
import {configApi} from '../../../services/configApi';
import type {OverviewTableParentJob} from '../OverviewPage.interfaces';

jest.mock('../../../services/overviewApi', () => ({
    overviewApi: {
        getParentJobMap: jest.fn(),
    },
}));

jest.mock('../../../services/configApi', () => ({
    configApi: {
        getHereMapsKey: jest.fn(),
    },
}));

jest.mock('../../../components/common/here-map/HereMap', () => ({
    HereMap: ({mapId}: {mapId: string}) => <div data-testid={mapId}>HereMap Mock</div>,
}));

const theme = createTheme();
const mockOverviewApi = overviewApi as jest.Mocked<typeof overviewApi>;
const mockConfigApi = configApi as jest.Mocked<typeof configApi>;

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {queries: {retry: false, gcTime: 0}},
    });

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>{ui}</ThemeProvider>
        </QueryClientProvider>,
    );
};

function createMockDelivery(overrides: Partial<OverviewTableParentJob> = {}): OverviewTableParentJob {
    return {
        jobId: 100,
        jobName: 'J-100',
        status: 'NEW',
        completion: 25,
        pickup: 'Warehouse A',
        delivery: 'Office B',
        driver: 'John',
        region: 'London',
        childJobs: [],
        ...overrides,
    };
}

const mockMapConfig = {
    center: {lat: 51.5, lng: -0.1},
    zoom: 12,
    job: null,
    selectedJobIndex: 0,
    courierLocation: null,
};

describe('MapDialog', () => {
    describe('when closed', () => {
        it('renders nothing when not open', () => {
            renderWithProviders(
                <MapDialog open={false} onClose={jest.fn()} delivery={null} />,
            );

            expect(screen.queryByText('Map')).not.toBeInTheDocument();
        });
    });

    describe('when open', () => {
        it('renders dialog with job name in title', async () => {
            mockConfigApi.getHereMapsKey.mockResolvedValueOnce('test-api-key');
            mockOverviewApi.getParentJobMap.mockResolvedValueOnce(mockMapConfig);

            const delivery = createMockDelivery();

            renderWithProviders(
                <MapDialog open onClose={jest.fn()} delivery={delivery} />,
            );

            expect(screen.getByText('J-100 Map')).toBeInTheDocument();
        });

        it('shows loading state while fetching map data', () => {
            mockConfigApi.getHereMapsKey.mockReturnValue(new Promise(() => {})); // Never resolves
            mockOverviewApi.getParentJobMap.mockReturnValue(new Promise(() => {}));

            renderWithProviders(
                <MapDialog open onClose={jest.fn()} delivery={createMockDelivery()} />,
            );

            expect(screen.getByText('Loading map data...')).toBeInTheDocument();
        });

        it('renders HereMap when data is loaded', async () => {
            mockConfigApi.getHereMapsKey.mockResolvedValueOnce('test-api-key');
            mockOverviewApi.getParentJobMap.mockResolvedValueOnce(mockMapConfig);

            renderWithProviders(
                <MapDialog open onClose={jest.fn()} delivery={createMockDelivery()} />,
            );

            expect(await screen.findByTestId('overviewMapContainer')).toBeInTheDocument();
        });

        it('calls onClose when close button is clicked', () => {
            mockConfigApi.getHereMapsKey.mockResolvedValueOnce('test-api-key');
            mockOverviewApi.getParentJobMap.mockResolvedValueOnce(mockMapConfig);

            const onClose = jest.fn();
            renderWithProviders(
                <MapDialog open onClose={onClose} delivery={createMockDelivery()} />,
            );

            const dialog = screen.getByRole('dialog');
            const closeButton = within(dialog).getAllByRole('button')[0];
            fireEvent.click(closeButton);

            expect(onClose).toHaveBeenCalled();
        });

        it('renders timeline with Origin node', async () => {
            mockConfigApi.getHereMapsKey.mockResolvedValueOnce('test-api-key');
            mockOverviewApi.getParentJobMap.mockResolvedValueOnce(mockMapConfig);

            renderWithProviders(
                <MapDialog open onClose={jest.fn()} delivery={createMockDelivery()} />,
            );

            expect(await screen.findByText('Origin')).toBeInTheDocument();

            expect(screen.getByText('Delivery Route')).toBeInTheDocument();
        });

        it('renders timeline with child job stops', async () => {
            mockConfigApi.getHereMapsKey.mockResolvedValueOnce('test-api-key');
            mockOverviewApi.getParentJobMap.mockResolvedValueOnce(mockMapConfig);

            const delivery = createMockDelivery({
                childJobs: [
                    {jobId: 10, jobName: 'J-100-A', status: 'NEW', completion: 0, pickup: 'A', delivery: 'B', driver: 'X', region: 'Y'},
                    {jobId: 11, jobName: 'J-100-B', status: 'NEW', completion: 0, pickup: 'C', delivery: 'D', driver: 'X', region: 'Y'},
                ],
            });

            renderWithProviders(
                <MapDialog open onClose={jest.fn()} delivery={delivery} />,
            );

            expect(await screen.findByText('Stop 1')).toBeInTheDocument();

            expect(screen.getByText('Stop 2')).toBeInTheDocument();
            expect(screen.getByText('Destination')).toBeInTheDocument();
        });

        it('allows clicking timeline nodes to switch selected job', async () => {
            mockConfigApi.getHereMapsKey.mockResolvedValueOnce('test-api-key');
            mockOverviewApi.getParentJobMap.mockResolvedValueOnce(mockMapConfig);

            const delivery = createMockDelivery({
                childJobs: [
                    {jobId: 10, jobName: 'J-100-A', status: 'NEW', completion: 0, pickup: 'A', delivery: 'B', driver: 'X', region: 'Y'},
                ],
            });

            renderWithProviders(
                <MapDialog open onClose={jest.fn()} delivery={delivery} />,
            );

            expect(await screen.findByText('Stop 1')).toBeInTheDocument();

            // Click Stop 1 — should not crash
            fireEvent.click(screen.getByText('Stop 1'));

            // Click Destination
            fireEvent.click(screen.getByText('Destination'));
        });
    });

    describe('API fetching', () => {
        it('does not fetch when dialog is closed', () => {
            renderWithProviders(
                <MapDialog open={false} onClose={jest.fn()} delivery={createMockDelivery()} />,
            );

            expect(mockConfigApi.getHereMapsKey).not.toHaveBeenCalled();
            expect(mockOverviewApi.getParentJobMap).not.toHaveBeenCalled();
        });

        it('does not fetch map data when delivery is null', () => {
            mockConfigApi.getHereMapsKey.mockResolvedValueOnce('test-api-key');

            renderWithProviders(
                <MapDialog open onClose={jest.fn()} delivery={null} />,
            );

            expect(mockOverviewApi.getParentJobMap).not.toHaveBeenCalled();
        });
    });
});
