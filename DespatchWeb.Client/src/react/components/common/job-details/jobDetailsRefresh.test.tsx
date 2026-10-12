import React from 'react';
import {act, render} from '@testing-library/react';
import {queryClient} from '../../../query/queryClient';
import {refreshJobDetails, useJobDetailsRefreshNonce} from './jobDetailsRefresh';

const Probe = () => <span data-testid="n">{useJobDetailsRefreshNonce()}</span>;

describe('jobDetailsRefresh', () => {
    it('bumps the nonce for subscribers and invalidates photo and price-breakdown queries', async () => {
        const spy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
        const {getByTestId} = render(<Probe/>);
        const before = Number(getByTestId('n').textContent);

        await act(async () => {
            await refreshJobDetails();
        });

        expect(Number(getByTestId('n').textContent)).toBe(before + 1);
        expect(spy).toHaveBeenCalledWith({queryKey: ['jobs', 'photos']});
        expect(spy).toHaveBeenCalledWith({queryKey: ['priceBreakdowns']});
        spy.mockRestore();
    });
});
