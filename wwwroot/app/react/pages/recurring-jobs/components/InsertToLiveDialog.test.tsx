/**
 * InsertToLiveDialog Component Tests
 *
 * Covers the restyled push-to-live dialog: rendering of the canonical
 * dialog chrome, scope selection, and the insert flow (success + error).
 */

import React from 'react';
import { renderWithMantine } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';
import {screen, waitFor} from '@testing-library/react';
import dayjs from 'dayjs';

import {InsertToLiveDialog, InsertToLiveDialogProps} from './InsertToLiveDialog';
import {InsertRecurringToLiveResult, InsertToLiveScope, PrebookListModel} from '../../../interfaces';
import {AddressViewModel} from '../../../interfaces/address';

jest.mock('../../../services/recurringJobsApi', () => ({
    recurringJobsApi: {
        insertToLive: jest.fn(),
    },
}));

import {recurringJobsApi} from '../../../services/recurringJobsApi';

const mockInsertToLive = recurringJobsApi.insertToLive as jest.MockedFunction<
    typeof recurringJobsApi.insertToLive
>;


function emptyAddress(): AddressViewModel {
    return {
        addressLine1: '', addressLine2: '', addressLine3: '', addressLine4: '',
        addressLine5: '', addressLine6: '', addressLine7: '', addressLine8: '',
        fullAddress: '',
    };
}

function createJob(overrides?: Partial<PrebookListModel>): PrebookListModel {
    return {
        id: 42,
        booked: dayjs('2026-07-06'),
        client: 'Acme Corp',
        jobNo: 'RJ-1001',
        clientId: 7,
        courier: 'Courier A',
        speed: 'Standard',
        customJobName: 'Nightly medical run',
        pickupAddress: emptyAddress(),
        deliveryAddress: emptyAddress(),
        routeId: 3,
        routeName: 'North loop',
        ...overrides,
    };
}

function createResult(overrides?: Partial<InsertRecurringToLiveResult>): InsertRecurringToLiveResult {
    return {
        bookingsMaterialised: 1,
        jobsInserted: 1,
        jobsRepriced: 0,
        insertedJobIds: [100],
        parentBookingIds: [42],
        flightsAutoAssigned: 0,
        flightsUnmatched: 0,
        ...overrides,
    };
}

function createProps(overrides?: Partial<InsertToLiveDialogProps>): InsertToLiveDialogProps {
    return {
        open: true,
        job: createJob(),
        onClose: jest.fn(),
        onSuccess: jest.fn(),
        showToast: jest.fn(),
        ...overrides,
    };
}

function renderDialog(props: InsertToLiveDialogProps) {
    return renderWithMantine(
            <InsertToLiveDialog {...props} />
    );
}

describe('InsertToLiveDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the title, booking identity, scope options and info guidance', () => {
        renderDialog(createProps());

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Insert to live'})).toBeInTheDocument();
        // Booking identity appears in both the header subtitle and the Paper section.
        expect(screen.getAllByText(/RJ-1001/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Nightly medical run/).length).toBeGreaterThan(0);
        expect(screen.getByText('Route: North loop')).toBeInTheDocument();
        expect(screen.getByLabelText(/Insert date/)).toBeInTheDocument();
        expect(screen.getByLabelText('Selected booking (parent + any children)')).toBeInTheDocument();
        expect(screen.getByLabelText('All Manual bookings on the same route for that date')).toBeInTheDocument();
        expect(screen.getByText(/fresh job number is minted per push/i)).toBeInTheDocument();
    });

    it('renders nothing when job is null', () => {
        renderDialog(createProps({job: null}));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('disables the Route scope option when the booking has no route', () => {
        renderDialog(createProps({job: createJob({routeId: null, routeName: null})}));
        expect(screen.getByLabelText('All Manual bookings on the same route for that date')).toBeDisabled();
    });

    it('enables the Route scope option when the booking has a route', () => {
        renderDialog(createProps());
        expect(screen.getByLabelText('All Manual bookings on the same route for that date')).not.toBeDisabled();
    });

    it('calls onClose when Cancel is clicked', async () => {
        const user = setupUser();
        const onClose = jest.fn();
        renderDialog(createProps({onClose}));

        await user.click(screen.getByRole('button', {name: /Cancel/i}));
        expect(onClose).toHaveBeenCalled();
    });

    it('inserts with the default date and Group scope, then reports success', async () => {
        const user = setupUser();
        const onSuccess = jest.fn();
        const showToast = jest.fn();
        const result = createResult();
        mockInsertToLive.mockResolvedValue(result);

        renderDialog(createProps({onSuccess, showToast}));

        await user.click(screen.getByRole('button', {name: /Insert to live/i}));

        const expectedDate = dayjs().format('YYYY-MM-DD');
        await waitFor(() => {
            expect(mockInsertToLive).toHaveBeenCalledWith({
                jobId: 42,
                insertDate: expectedDate,
                scope: InsertToLiveScope.Group,
            });
        });
        expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Inserted 1 job(s)'), 'success');
        expect(onSuccess).toHaveBeenCalledWith(result);
    });

    it('submits the Route scope when selected', async () => {
        const user = setupUser();
        mockInsertToLive.mockResolvedValue(createResult());

        renderDialog(createProps());

        await user.click(screen.getByLabelText('All Manual bookings on the same route for that date'));
        await user.click(screen.getByRole('button', {name: /Insert to live/i}));

        await waitFor(() => {
            expect(mockInsertToLive).toHaveBeenCalledWith(
                expect.objectContaining({scope: InsertToLiveScope.Route})
            );
        });
    });

    it('warns when saved flights could not be matched', async () => {
        const user = setupUser();
        const showToast = jest.fn();
        mockInsertToLive.mockResolvedValue(createResult({flightsUnmatched: 2}));

        renderDialog(createProps({showToast}));

        await user.click(screen.getByRole('button', {name: /Insert to live/i}));

        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith(
                expect.stringContaining("couldn't be matched"),
                'warning'
            );
        });
    });

    it('surfaces the backend error message on failure', async () => {
        const user = setupUser();
        const showToast = jest.fn();
        const onSuccess = jest.fn();
        mockInsertToLive.mockRejectedValue({response: {data: 'Booking is not in Manual mode.'}});
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        renderDialog(createProps({showToast, onSuccess}));

        await user.click(screen.getByRole('button', {name: /Insert to live/i}));

        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith('Booking is not in Manual mode.', 'error');
        });
        expect(onSuccess).not.toHaveBeenCalled();

        consoleError.mockRestore();
    });
});
