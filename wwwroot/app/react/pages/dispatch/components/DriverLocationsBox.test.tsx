import React from 'react';
import {render, screen} from '@testing-library/react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import dayjs from 'dayjs';

const fetchDriverLocationsMock = jest.fn();
jest.mock('../../../services/courierApi', () => ({
    fetchDriverLocations: (...args: unknown[]) => fetchDriverLocationsMock(...args),
}));

// Stub the presentational component, surfacing the props the box drives.
jest.mock('../../../components/common/driver-locations', () => ({
    DriverLocations: ({showNoData, showData, activeAreaId, truckMode, onAreaClick}: any) => (
        <div>
            {showNoData && <div data-testid="dl-no-data" />}
            {showData && <div data-testid="dl-data" />}
            <div data-testid="dl-active">{activeAreaId ?? ''}</div>
            <div data-testid="dl-truck-mode">{truckMode}</div>
            <button onClick={() => onAreaClick?.({id: 7})}>pick-area</button>
        </div>
    ),
}));

import {DriverLocationsBox} from './DriverLocationsBox';

// Shared fast userEvent instance (see setupUser).
const userEvent = setupUser();

// ContactID defaults to 0 and legacy AppPage.Dispatch === 1 in tests.
function renderBox(overrides: Partial<React.ComponentProps<typeof DriverLocationsBox>> = {}) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={createTheme()}>
                <DriverLocationsBox
                    isUsCustomer={false}
                    despatchViewIds={[]}
                    startDate={dayjs('2025-02-01')}
                    endDate={dayjs('2025-02-01')}
                    truckMode="On"
                    {...overrides}
                />
            </ThemeProvider>
        </QueryClientProvider>,
    );
}

describe('DriverLocationsBox', () => {
    beforeEach(() => {
        fetchDriverLocationsMock.mockReset();
        fetchDriverLocationsMock.mockResolvedValue({areas: [{id: 7}]});
    });

    it('shows the no-data state and skips the fetch when no views are selected', () => {
        renderBox({despatchViewIds: []});
        expect(screen.getByTestId('dl-no-data')).toBeInTheDocument();
        expect(fetchDriverLocationsMock).not.toHaveBeenCalled();
    });

    it('fetches for the selected view ids and shows data when areas come back', async () => {
        renderBox({despatchViewIds: [11]});

        expect(await screen.findByTestId('dl-data')).toBeInTheDocument();
        expect(fetchDriverLocationsMock).toHaveBeenCalledWith(
            expect.objectContaining({despatchViewIds: [11]}),
            expect.anything(),
        );
    });

    it('forwards the truck mode to the presentational component', async () => {
        renderBox({despatchViewIds: [11], truckMode: 'Only'});

        await screen.findByTestId('dl-data');
        expect(screen.getByTestId('dl-truck-mode')).toHaveTextContent('Only');
    });

    it('reports the clicked area id and reflects the active area', async () => {
        const onAreaSelect = jest.fn();

        renderBox({despatchViewIds: [11], onAreaSelect, activeAreaId: 7});

        await screen.findByTestId('dl-data');
        await userEvent.click(screen.getByRole('button', {name: 'pick-area'}));

        expect(onAreaSelect).toHaveBeenCalledWith(7);
        expect(screen.getByTestId('dl-active')).toHaveTextContent('7');
    });
});
