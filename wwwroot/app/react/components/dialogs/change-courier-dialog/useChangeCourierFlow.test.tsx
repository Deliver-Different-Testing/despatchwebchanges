/**
 * useChangeCourierFlow tests
 *
 * The shared entry-point flow: check eligibility → open the change dialog,
 * or show the "already invoiced / settled" acknowledge popup instead.
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import {setupUser} from '../../../__testUtils__/setupUser';
import {renderWithMantine} from '../../../__testUtils__';
import {useChangeCourierFlow} from './useChangeCourierFlow';
import {changeArchivedJobCourier, getCourierChangeEligibility} from '../../../services/jobListApi';

jest.mock('../../../services/jobListApi', () => ({
    getCourierChangeEligibility: jest.fn(),
    changeArchivedJobCourier: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../services/jobDetailApi', () => ({
    autocompleteSearch: jest.fn().mockResolvedValue([]),
}));

const mockedEligibility = getCourierChangeEligibility as jest.Mock;
const mockedChange = changeArchivedJobCourier as jest.Mock;

const userEvent = setupUser();

const showToast = jest.fn();
const onChanged = jest.fn();

const Harness: React.FC = () => {
    const {openChangeCourier, changeCourierDialogs} = useChangeCourierFlow({showToast, onChanged});
    return (
        <>
            <button onClick={() => void openChangeCourier({id: 42, jobNo: 'JOB-042'})}>trigger</button>
            {changeCourierDialogs}
        </>
    );
};

describe('useChangeCourierFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('opens the change dialog with the current courier when the job is eligible', async () => {
        mockedEligibility.mockResolvedValue({
            canChange: true, reason: null, currentCourierId: 10, currentCourierName: 'Olive Old',
        });
        renderWithMantine(<Harness/>);

        await userEvent.click(screen.getByRole('button', {name: 'trigger'}));

        expect(await screen.findByText('Change Paid Courier')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Olive Old')).toBeInTheDocument();
        expect(mockedEligibility).toHaveBeenCalledWith(42);
    });

    it('shows the invoiced popup instead of the dialog when blocked by invoicing', async () => {
        mockedEligibility.mockResolvedValue({canChange: false, reason: 'invoiced'});
        renderWithMantine(<Harness/>);

        await userEvent.click(screen.getByRole('button', {name: 'trigger'}));

        expect(await screen.findByText(/already been invoiced and the courier can no longer be changed/i))
            .toBeInTheDocument();
        expect(screen.queryByText('Change Paid Courier')).not.toBeInTheDocument();
        // Acknowledge-only: OK dismisses
        await userEvent.click(screen.getByRole('button', {name: /ok/i}));
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('shows the settled popup when the courier has been paid', async () => {
        mockedEligibility.mockResolvedValue({canChange: false, reason: 'settled'});
        renderWithMantine(<Harness/>);

        await userEvent.click(screen.getByRole('button', {name: 'trigger'}));

        expect(await screen.findByText(/already been paid in a settlement run/i)).toBeInTheDocument();
    });

    it('toasts an error when the eligibility check fails', async () => {
        mockedEligibility.mockRejectedValue(new Error('network'));
        renderWithMantine(<Harness/>);

        await userEvent.click(screen.getByRole('button', {name: 'trigger'}));

        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error');
        });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('saves through changeArchivedJobCourier and notifies onChanged', async () => {
        mockedEligibility.mockResolvedValue({
            canChange: true, reason: null, currentCourierId: 10, currentCourierName: 'Olive Old',
        });
        const {autocompleteSearch} = jest.requireMock('../../../services/jobDetailApi');
        autocompleteSearch.mockResolvedValue([{id: 101, text: 'Nina New'}]);

        renderWithMantine(<Harness/>);
        await userEvent.click(screen.getByRole('button', {name: 'trigger'}));
        await screen.findByText('Change Paid Courier');

        const search = screen.getByPlaceholderText(/Search courier/);
        await userEvent.type(search, 'Nina');
        await userEvent.click(await screen.findByRole('option', {name: /Nina New/}));
        await userEvent.click(screen.getByRole('button', {name: /^save$/i}));
        await userEvent.click(await screen.findByRole('button', {name: /confirm change/i}));

        await waitFor(() => {
            expect(mockedChange).toHaveBeenCalledWith(42, 101);
            expect(onChanged).toHaveBeenCalledWith(42);
        });
    });
});
