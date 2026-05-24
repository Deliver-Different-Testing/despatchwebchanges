/** @jest-environment jest-environment-jsdom */
/**
 * JobChangeRequestDialog Tests
 *
 * Covers the per-field typed inputs, dynamic title, dropdown grouping,
 * preselected prop priming, and submission paths.
 */

import React from 'react';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {JobChangeRequestDialog, JobChangeRequestDialogProps} from './JobChangeRequestDialog';
import {renderWithTheme} from '../../../__testUtils__';
import {jobChangeRequestApi} from '../../../services/jobChangeRequestApi';
import {getSpeedList} from '../../../services/jobDetailApi';

jest.mock('../../../services/jobChangeRequestApi', () => ({
    jobChangeRequestApi: {
        create: jest.fn(),
    },
}));

jest.mock('../../../services/jobDetailApi', () => ({
    getSpeedList: jest.fn(),
}));

const mockCreate = jobChangeRequestApi.create as jest.Mock;
const mockGetSpeedList = getSpeedList as jest.Mock;

function renderDialog(overrides: Partial<JobChangeRequestDialogProps> = {}) {
    const defaultProps: JobChangeRequestDialogProps = {
        open: true,
        jobId: 42,
        jobNo: 'JOB-100',
        onClose: jest.fn(),
        onSubmitted: jest.fn(),
        ...overrides,
    };

    const result = renderWithTheme(<JobChangeRequestDialog {...defaultProps} />);
    return {...result, props: defaultProps};
}

describe('JobChangeRequestDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetSpeedList.mockResolvedValue([
            {id: 1, text: 'Standard'},
            {id: 2, text: 'Express'},
            {id: 3, text: 'Same Day'},
        ]);
    });

    it('shows the job number and a field-specific title', () => {
        renderDialog();
        expect(screen.getByText(/JOB-100/)).toBeInTheDocument();
        // Default field is Notes — title should reflect that.
        expect(screen.getByRole('heading', {name: /Request change to Notes/})).toBeInTheDocument();
    });

    it('updates the title when the field changes', async () => {
        const user = userEvent.setup();
        renderDialog();
        await user.click(screen.getByLabelText(/Field/));
        await user.click(screen.getByRole('option', {name: /Agreed Rate/}));
        expect(screen.getByRole('heading', {name: /Request change to Agreed Rate/})).toBeInTheDocument();
    });

    it('validates that a requested value is provided', async () => {
        const user = userEvent.setup();
        renderDialog();
        // Default field is Notes (auto-apply) so the action button reads "Apply".
        await user.click(screen.getByRole('button', {name: /Apply/}));
        expect(screen.getByText(/Enter the requested value/)).toBeInTheDocument();
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('submits Notes (auto-apply) with the typed value', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValueOnce({
            success: true,
            request: {status: 'Applied'},
        });
        renderDialog();
        // Default field is Notes — the value input is "New notes".
        await user.type(screen.getByLabelText(/New notes/i), 'Please leave at reception');
        await user.click(screen.getByRole('button', {name: /Apply/}));
        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledWith({
                jobId: 42,
                fieldName: 'Notes',
                requestedValue: 'Please leave at reception',
                reason: undefined,
            });
        });
        expect(screen.getByText(/Change applied/)).toBeInTheDocument();
    });

    it('renders the Speed dropdown from getSpeedList when Service Speed is picked', async () => {
        const user = userEvent.setup();
        renderDialog();
        await user.click(screen.getByRole('combobox', {name: /Field/}));
        await user.click(screen.getByRole('option', {name: /Service Speed/}));
        await waitFor(() => {
            expect(mockGetSpeedList).toHaveBeenCalled();
        });
        // Scope to the Service Speed combobox (distinct from the Field combobox above).
        const speedSelect = await screen.findByRole('combobox', {name: /Service speed/i});
        await user.click(speedSelect);
        expect(await screen.findByRole('option', {name: 'Express'})).toBeInTheDocument();
    });

    it('PartnerAgreedRate renders a $ adornment and submits the numeric value', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValueOnce({
            success: true,
            request: {status: 'Pending'},
        });
        renderDialog({preselectedFieldName: 'PartnerAgreedRate'});
        const input = screen.getByRole('spinbutton', {name: /Agreed rate/i});
        // userEvent.type on a number input in jsdom doesn't handle the decimal
        // point reliably — use a whole number; the field accepts both at runtime.
        await user.type(input, '185');
        await user.click(screen.getByRole('button', {name: /Submit/}));
        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledWith({
                jobId: 42,
                fieldName: 'PartnerAgreedRate',
                requestedValue: '185',
                reason: undefined,
            });
        });
    });

    it('shows a "re-rates" notice for commercial fields', () => {
        renderDialog({preselectedFieldName: 'Quantity'});
        expect(screen.getByText(/re-rates the job/i)).toBeInTheDocument();
    });

    it('omits the re-rates notice for auto-apply fields', () => {
        renderDialog(); // default Notes
        expect(screen.queryByText(/re-rates the job/i)).not.toBeInTheDocument();
    });

    describe('address fields', () => {
        it('renders structured address inputs and submits a JSON payload', async () => {
            const user = userEvent.setup();
            mockCreate.mockResolvedValueOnce({
                success: true,
                request: {status: 'Pending'},
            });
            renderDialog({preselectedFieldName: 'PickupAddress'});

            await user.type(screen.getByLabelText(/Address line 1/i), '123 Cuba St');
            await user.type(screen.getByLabelText(/Suburb/i), 'Te Aro');
            await user.type(screen.getByLabelText(/City/i), 'Wellington');
            await user.type(screen.getByLabelText(/Postcode/i), '6011');

            await user.click(screen.getByRole('button', {name: /Submit/}));

            await waitFor(() => {
                expect(mockCreate).toHaveBeenCalledTimes(1);
            });
            const call = mockCreate.mock.calls[0][0];
            expect(call.fieldName).toBe('PickupAddress');
            const payload = JSON.parse(call.requestedValue);
            expect(payload.addressLine1).toBe('123 Cuba St');
            expect(payload.addressLine3).toBe('Te Aro');
            expect(payload.addressLine4).toBe('Wellington');
            expect(payload.addressLine6).toBe('6011');
            // fullAddress is derived from the joined non-empty lines.
            expect(payload.fullAddress).toContain('123 Cuba St');
            expect(payload.fullAddress).toContain('Wellington');
        });

        it('rejects submission when all address lines are empty', async () => {
            const user = userEvent.setup();
            renderDialog({preselectedFieldName: 'DeliveryAddress'});
            await user.click(screen.getByRole('button', {name: /Submit/}));
            expect(screen.getByText(/Enter at least one address line/)).toBeInTheDocument();
            expect(mockCreate).not.toHaveBeenCalled();
        });

        it('pre-fills address fields from a serialised preInitialValue', () => {
            renderDialog({
                preselectedFieldName: 'PickupAddress',
                preInitialValue: JSON.stringify({addressLine1: '99 Lambton Quay', addressLine4: 'Wellington'}),
            });
            expect(screen.getByLabelText(/Address line 1/i)).toHaveValue('99 Lambton Quay');
            expect(screen.getByLabelText(/City/i)).toHaveValue('Wellington');
        });
    });

    describe('preselected props', () => {
        it('opens with the preselected field and pre-filled value', () => {
            renderDialog({
                preselectedFieldName: 'PartnerAgreedRate',
                preInitialValue: '123.45',
            });
            expect(screen.getByRole('heading', {name: /Request change to Agreed Rate/})).toBeInTheDocument();
            expect(screen.getByRole('spinbutton', {name: /Agreed rate/i})).toHaveValue(123.45);
        });

        it('re-primes when reopened with different props', () => {
            const {rerender} = renderDialog({
                open: false,
                preselectedFieldName: 'PartnerAgreedRate',
                preInitialValue: '50',
            });
            rerender(
                <JobChangeRequestDialog
                    open={true}
                    jobId={42}
                    jobNo="JOB-100"
                    onClose={jest.fn()}
                    preselectedFieldName="PartnerAgreedRate"
                    preInitialValue="50"
                />,
            );
            expect(screen.getByRole('spinbutton', {name: /Agreed rate/i})).toHaveValue(50);

            rerender(
                <JobChangeRequestDialog
                    open={false}
                    jobId={42}
                    jobNo="JOB-100"
                    onClose={jest.fn()}
                    preselectedFieldName="PartnerAgreedRate"
                    preInitialValue="50"
                />,
            );
            rerender(
                <JobChangeRequestDialog
                    open={true}
                    jobId={42}
                    jobNo="JOB-100"
                    onClose={jest.fn()}
                    preselectedFieldName="Quantity"
                    preInitialValue="7"
                />,
            );
            expect(screen.getByRole('spinbutton', {name: /Quantity/i})).toHaveValue(7);
        });
    });

    describe('field dropdown grouping', () => {
        it('groups fields under "Applies immediately" and "Requires partner approval"', async () => {
            const user = userEvent.setup();
            renderDialog();
            await user.click(screen.getByLabelText(/Field/));
            const listbox = await screen.findByRole('listbox');
            expect(within(listbox).getByText(/Applies immediately/i)).toBeInTheDocument();
            expect(within(listbox).getByText(/Requires partner approval/i)).toBeInTheDocument();
        });
    });

    it('surfaces backend error message', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValueOnce({
            success: false,
            message: 'A pending request for Notes already exists',
        });
        renderDialog();
        await user.type(screen.getByLabelText(/New notes/i), 'x');
        await user.click(screen.getByRole('button', {name: /Apply/}));
        await waitFor(() => {
            expect(screen.getByText(/already exists/)).toBeInTheDocument();
        });
    });
});
