import React from 'react';
import {act, screen} from '@testing-library/react';
import {renderWithProviders} from '../../test/utils';
import {trackPageLoad} from '../../routes/pageLoadTracker';
import {PageProgress} from './PageProgress';
import {PAGE_TRANSITION_DELAY_MS} from './PageTransition';

describe('PageProgress', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('shows only for loads slower than the delay, and clears when they settle', async () => {
        renderWithProviders(<PageProgress/>);
        let resolve!: () => void;

        let loading!: Promise<void>;
        act(() => {
            loading = trackPageLoad(() => new Promise<void>(r => (resolve = r)));
        });
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(PAGE_TRANSITION_DELAY_MS);
        });
        expect(screen.getByRole('progressbar', {name: 'Loading page'})).toBeInTheDocument();

        await act(async () => {
            resolve();
            await loading;
        });
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('never shows for a load that settles within the delay', async () => {
        renderWithProviders(<PageProgress/>);

        await act(async () => {
            await trackPageLoad(() => Promise.resolve());
            vi.advanceTimersByTime(PAGE_TRANSITION_DELAY_MS * 2);
        });

        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
});
