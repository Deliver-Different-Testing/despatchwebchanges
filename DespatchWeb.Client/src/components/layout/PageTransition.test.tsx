import React from 'react';
import {act, screen} from '@testing-library/react';
import {renderWithProviders} from '../../test/utils';
import {PageTransition, PAGE_TRANSITION_DELAY_MS} from './PageTransition';

describe('PageTransition', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('stays hidden for fast navigations, then announces the switch', () => {
        renderWithProviders(<PageTransition/>);

        expect(screen.queryByRole('status')).not.toBeInTheDocument();

        act(() => {
            jest.advanceTimersByTime(PAGE_TRANSITION_DELAY_MS);
        });

        expect(screen.getByRole('status')).toHaveTextContent('Loading Despatch');
    });

    it('never shows if unmounted before the delay', () => {
        const {unmount} = renderWithProviders(<PageTransition/>);
        unmount();

        act(() => {
            jest.advanceTimersByTime(PAGE_TRANSITION_DELAY_MS * 2);
        });

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
