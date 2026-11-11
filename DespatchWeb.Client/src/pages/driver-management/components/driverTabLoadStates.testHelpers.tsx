import {fireEvent, screen} from '@testing-library/react';

type SetupMocks = (data?: undefined, isLoading?: boolean, isError?: boolean) => void;

export function itShowsLoadingIndicator(setupMocks: SetupMocks, renderWithProviders: () => unknown) {
    it('should show loading indicator when isLoading is true', () => {
        setupMocks(undefined, true);
        renderWithProviders();

        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });
}

export function itShowsRetryableErrorState(
    setupMocks: SetupMocks,
    renderWithProviders: () => unknown,
    refetch: () => void,
    errorTitle: string,
) {
    it('should show a retryable error state when the load fails', () => {
        setupMocks(undefined, false, true);
        renderWithProviders();

        expect(screen.getByText(errorTitle)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
        expect(refetch).toHaveBeenCalled();
    });
}
