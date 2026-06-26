import React from 'react';
import {render, screen} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';

const fetchTruckCourierStatusMock = jest.fn();
jest.mock('../../../services/courierApi', () => ({
    fetchTruckCourierStatus: (...args: unknown[]) => fetchTruckCourierStatusMock(...args),
}));

import {TruckLoadingStatusDialog} from './TruckLoadingStatusDialog';

function renderDialog(overrides: Partial<React.ComponentProps<typeof TruckLoadingStatusDialog>> = {}) {
    const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}});
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={createTheme()}>
                <TruckLoadingStatusDialog
                    open
                    courierId={42}
                    courierLabel="101 - Alice"
                    isUsCustomer={false}
                    onClose={jest.fn()}
                    {...overrides}
                />
            </ThemeProvider>
        </QueryClientProvider>,
    );
}

describe('TruckLoadingStatusDialog', () => {
    beforeEach(() => {
        fetchTruckCourierStatusMock.mockReset().mockResolvedValue({
            courierId: 42, courierCode: '101', firstName: 'Alice',
            maxPallets: 10, maxPayLoad: 1000, currentPallets: 3, currentWeight: 250,
            availablePallets: 7, lastUpdated: new Date(),
        });
    });

    it('fetches and shows the courier truck status with computed available weight', async () => {
        renderDialog();
        expect(screen.getByText('Truck Loading Status')).toBeInTheDocument();
        expect(screen.getByText('101 - Alice')).toBeInTheDocument();

        // availableWeight = maxPayLoad(1000) - currentWeight(250) = 750
        expect(await screen.findByText('750')).toBeInTheDocument();
        expect(screen.getByText(/Max Weight \(kg\)/)).toBeInTheDocument();
        expect(fetchTruckCourierStatusMock).toHaveBeenCalledWith(42, expect.anything());
    });

    it('does not fetch when closed', () => {
        renderDialog({open: false});
        expect(fetchTruckCourierStatusMock).not.toHaveBeenCalled();
    });
});
