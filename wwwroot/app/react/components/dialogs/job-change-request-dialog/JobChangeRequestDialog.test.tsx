/**
 * JobChangeRequestDialog Tests
 *
 * Covers the per-field typed inputs, dynamic title, dropdown grouping,
 * preselected prop priming, and submission paths.
 */

import React from 'react';
import {screen, waitFor, within} from '@testing-library/react';
import {JobChangeRequestDialog, JobChangeRequestDialogProps} from './JobChangeRequestDialog';
import { renderWithMantine as renderWithTheme } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';
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
        const user = setupUser();
        renderDialog();
        await user.click(screen.getByLabelText(/Field/));
        await user.click(screen.getByRole('option', {name: /Agreed Rate/}));
        expect(screen.getByRole('heading', {name: /Request change to Agreed Rate/})).toBeInTheDocument();
    });

    it('validates that a requested value is provided', async () => {
        const user = setupUser();
        renderDialog();
        // Default field is Notes (auto-apply) so the action button reads "Apply".
        await user.click(screen.getByRole('button', {name: /Apply/}));
        expect(screen.getByText(/Enter the requested value/)).toBeInTheDocument();
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('submits Notes (auto-apply) with the typed value and surfaces the result via a toast', async () => {
        const user = setupUser();
        mockCreate.mockResolvedValueOnce({
            success: true,
            request: {status: 'Applied'},
        });
        const onClose = jest.fn();
        renderDialog({onClose});
        // Default field is Notes — the value input is "New notes".
        await user.click(screen.getByLabelText(/New notes/i));
        await user.paste('Please leave at reception');
        await user.click(screen.getByRole('button', {name: /Apply/}));
        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledWith({
                jobId: 42,
                fieldName: 'Notes',
                requestedValue: 'Please leave at reception',
                reason: undefined,
                pairingId: undefined,
            });
        });
        // Dialog closes synchronously on submit — the dispatcher isn't blocked
        // while the request is in flight.
        expect(onClose).toHaveBeenCalled();
        // The result lands as a toast (standalone toastService mounts to document.body).
        expect(await screen.findByText(/Change applied/)).toBeInTheDocument();
    });

    it('renders the Speed dropdown from getSpeedList when Service Speed is picked', async () => {
        const user = setupUser();
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
        const user = setupUser();
        mockCreate.mockResolvedValueOnce({
            success: true,
            request: {status: 'Pending'},
        });
        renderDialog({preselectedFieldName: 'PartnerAgreedRate'});
        // Mantine's `NumberInput` is a formatted text input (react-number-format),
        // so it has no spinbutton role and its value reads back as a string.
        const input = screen.getByRole('textbox', {name: /Agreed rate/i});
        await user.click(input);
        await user.paste('185');
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
            const user = setupUser();
            mockCreate.mockResolvedValueOnce({
                success: true,
                request: {status: 'Pending'},
            });
            renderDialog({preselectedFieldName: 'PickupAddress'});

            await user.click(screen.getByLabelText(/Address line 1/i));
            await user.paste('123 Cuba St');
            await user.click(screen.getByLabelText(/Suburb/i));
            await user.paste('Te Aro');
            await user.click(screen.getByLabelText(/City/i));
            await user.paste('Wellington');
            await user.click(screen.getByLabelText(/Postcode/i));
            await user.paste('6011');

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
            const user = setupUser();
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
            expect(screen.getByRole('textbox', {name: /Agreed rate/i})).toHaveValue('123.45');
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
            expect(screen.getByRole('textbox', {name: /Agreed rate/i})).toHaveValue('50');

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
            expect(screen.getByRole('textbox', {name: /Quantity/i})).toHaveValue('7');
        });
    });

    describe('field dropdown grouping', () => {
        it('groups fields under "Applies immediately" and "Requires partner approval"', async () => {
            const user = setupUser();
            renderDialog();
            await user.click(screen.getByLabelText(/Field/));
            const listbox = await screen.findByRole('listbox');
            expect(within(listbox).getByText(/Applies immediately/i)).toBeInTheDocument();
            expect(within(listbox).getByText(/Requires partner approval/i)).toBeInTheDocument();
        });
    });

    describe('lockedField mode (second leg of edit → confirm flow)', () => {
        it('renders the field + value as a read-only summary instead of the picker / input', () => {
            renderDialog({
                preselectedFieldName: 'PartnerAgreedRate',
                preInitialValue: '185.50',
                lockedField: true,
            });

            // The field combobox and numeric value input must NOT be present.
            expect(screen.queryByLabelText(/Field/i)).not.toBeInTheDocument();
            expect(screen.queryByRole('textbox', {name: /Agreed rate/i})).not.toBeInTheDocument();

            // The header switches to confirmation copy.
            expect(screen.getByRole('heading', {name: /Confirm Agreed Rate change/})).toBeInTheDocument();

            // The summary surfaces the new value formatted as currency.
            expect(screen.getByText(/\$185\.50/)).toBeInTheDocument();
        });

        it('keeps the reason textarea editable and submits with the locked value', async () => {
            const user = setupUser();
            mockCreate.mockResolvedValueOnce({
                success: true,
                request: {status: 'Pending'},
            });
            renderDialog({
                preselectedFieldName: 'PartnerAgreedRate',
                preInitialValue: '185.50',
                lockedField: true,
            });

            const reasonField = screen.getByLabelText(/Reason/);
            await user.click(reasonField);
            await user.paste('Customer requested a rate review after holiday surcharge');

            await user.click(screen.getByRole('button', {name: /Submit/}));

            await waitFor(() => {
                expect(mockCreate).toHaveBeenCalledWith({
                    jobId: 42,
                    fieldName: 'PartnerAgreedRate',
                    requestedValue: '185.50',
                    reason: 'Customer requested a rate review after holiday surcharge',
                });
            });
        });

        it('renders addresses as a parsed single-line summary', () => {
            renderDialog({
                preselectedFieldName: 'PickupAddress',
                preInitialValue: JSON.stringify({
                    addressLine1: '99 Lambton Quay',
                    addressLine4: 'Wellington',
                    fullAddress: '99 Lambton Quay, Wellington',
                }),
                lockedField: true,
            });

            expect(screen.queryByLabelText(/Address line 1/i)).not.toBeInTheDocument();
            expect(screen.getByText(/99 Lambton Quay, Wellington/)).toBeInTheDocument();
        });
    });

    describe('partner name substitution', () => {
        it('uses the partner name in the subtitle and reason helper text', () => {
            renderDialog({preselectedFieldName: 'Quantity', partnerName: 'Acme Couriers'});
            // Subtitle in the header sits next to the job number.
            expect(screen.getByText(/Requires Acme Couriers to approve/)).toBeInTheDocument();
            // Reason field helper text.
            expect(screen.getByText(/Visible to Acme Couriers during approval/)).toBeInTheDocument();
        });

        it('names the partner in the commercial re-rates alert', () => {
            renderDialog({preselectedFieldName: 'PartnerAgreedRate', partnerName: 'Acme Couriers'});
            expect(screen.getByText(/Acme Couriers will see the new price/)).toBeInTheDocument();
        });

        it('uses the partner name in the locked-field confirmation subtitle', () => {
            renderDialog({
                preselectedFieldName: 'PartnerAgreedRate',
                preInitialValue: '185.50',
                lockedField: true,
                partnerName: 'Acme Couriers',
            });
            expect(screen.getByText(/Add a reason for Acme Couriers/)).toBeInTheDocument();
        });

        it('falls back to "the partner" when no name is supplied', () => {
            renderDialog({preselectedFieldName: 'Quantity'});
            expect(screen.getByText(/Requires the partner to approve/)).toBeInTheDocument();
            expect(screen.getByText(/Visible to the partner during approval/)).toBeInTheDocument();
        });

        it('falls back to "the partner" when name is blank/whitespace', () => {
            renderDialog({preselectedFieldName: 'Quantity', partnerName: '   '});
            expect(screen.getByText(/Requires the partner to approve/)).toBeInTheDocument();
        });
    });

    it('forwards pairingId to the create payload when supplied', async () => {
        // The dispatcher's tenant may have multiple active partner pairings; sending
        // pairingId lets the backend disambiguate without falling back to the
        // single-active-pairing heuristic that errors out on multi-pairing tenants.
        const user = setupUser();
        mockCreate.mockResolvedValueOnce({success: true, request: {status: 'Applied'}});
        renderDialog({pairingId: 17});
        await user.click(screen.getByLabelText(/New notes/i));
        await user.paste('x');
        await user.click(screen.getByRole('button', {name: /Apply/}));
        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({pairingId: 17}));
        });
    });

    it('surfaces backend error message via a toast after closing the dialog', async () => {
        const user = setupUser();
        mockCreate.mockResolvedValueOnce({
            success: false,
            message: 'A pending request for Notes already exists',
        });
        const onClose = jest.fn();
        renderDialog({onClose});
        await user.click(screen.getByLabelText(/New notes/i));
        await user.paste('x');
        await user.click(screen.getByRole('button', {name: /Apply/}));
        // The dialog closes immediately; the backend error appears as a toast
        // so the dispatcher can keep working in the meantime.
        await waitFor(() => {
            expect(onClose).toHaveBeenCalled();
        });
        expect(await screen.findByText(/already exists/)).toBeInTheDocument();
    });
});
