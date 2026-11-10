import type {MockedFunction} from 'vitest';
import React from 'react';
import {setupUser} from '../../../test/utils/setupUser';
import {createTestQueryClient, MantineTestProvider} from '../../../test/utils';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {QueryClientProvider} from '@tanstack/react-query';
import {DriverComplianceTab} from './DriverComplianceTab';
import {CourierCompliancePaginated} from '../../../types';
import {useComplianceList, useComplianceReminderPreview, useSendComplianceReminders} from '../../../hooks/useDriverManagementApi';

vi.mock('../../../hooks/useDriverManagementApi', () => ({
    useComplianceList: vi.fn(),
    useComplianceReminderPreview: vi.fn(),
    useSendComplianceReminders: vi.fn(),
}));

vi.mock('../../../api/driverManagementApi', () => ({
    driverManagementApi: {
        exportComplianceCsv: vi.fn(),
    },
}));

const mockUseComplianceList = useComplianceList as MockedFunction<typeof useComplianceList>;
const mockUseComplianceReminderPreview = useComplianceReminderPreview as MockedFunction<typeof useComplianceReminderPreview>;
const mockUseSendComplianceReminders = useSendComplianceReminders as MockedFunction<typeof useSendComplianceReminders>;

const renderWithProviders = (showToast = vi.fn(), fleetOptions = [{id: 1, text: 'Fleet A'}]) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <DriverComplianceTab showToast={showToast} fleetOptions={fleetOptions} />
            </MantineTestProvider>
        </QueryClientProvider>
    );
};

const createMockData = (): CourierCompliancePaginated => ({
    items: [
        {courierId: 10, code: 'JS001', name: 'John Smith', complianceType: 'Driver licence', complianceTypeKey: 'drivers_license', expiryDate: '2025-02-01', status: 'Expired', daysUntilExpiry: -10},
        {courierId: 20, code: 'JD002', name: 'Jane Doe', complianceType: 'WOF', complianceTypeKey: 'wof', expiryDate: '2099-06-15', status: 'Valid', daysUntilExpiry: 120},
        {courierId: 30, code: 'BW003', name: 'Bob Wilson', complianceType: 'Registration', complianceTypeKey: 'registration', expiryDate: null, status: 'Not set', daysUntilExpiry: null},
        {courierId: 40, code: 'AB004', name: 'Amy Bell', complianceType: 'DG endorsement', complianceTypeKey: 'dg_endorsement', expiryDate: '2099-01-01', status: 'Expiring soon', daysUntilExpiry: 0},
    ],
    total: 4,
    page: 1,
    pages: 1,
    totalExpired: 1,
    totalExpiringSoon: 1,
    totalValid: 1,
    totalNotSet: 1,
});

const emptyData = (): CourierCompliancePaginated => ({
    items: [], total: 0, page: 1, pages: 0,
    totalExpired: 0, totalExpiringSoon: 0, totalValid: 0, totalNotSet: 0,
});

const mutateAsync = vi.fn();
const refetch = vi.fn();

const previewResult = (recipients: number, maxRecipients = 200) =>
    ({recipients, sent: 0, nothingDue: 0, failed: 0, failures: [], maxRecipients});

const setupMocks = (overrides: {data?: CourierCompliancePaginated; isLoading?: boolean; isError?: boolean; preview?: object; isSending?: boolean} = {}) => {
    mockUseComplianceList.mockReturnValue({
        data: overrides.isError ? undefined : overrides.data ?? createMockData(),
        isLoading: overrides.isLoading ?? false,
        isError: overrides.isError ?? false,
        refetch,
    } as any);
    mutateAsync.mockReset().mockResolvedValue({...previewResult(1), sent: 1});
    mockUseSendComplianceReminders.mockReturnValue({mutateAsync, isPending: overrides.isSending ?? false} as any);
    mockUseComplianceReminderPreview.mockReturnValue(
        (overrides.preview ?? {data: previewResult(1), isLoading: false, isError: false}) as any);
};

const lastPreviewTarget = () => {
    const calls = mockUseComplianceReminderPreview.mock.calls;
    return calls[calls.length - 1][0];
};

const lastQuery = () => mockUseComplianceList.mock.calls[mockUseComplianceList.mock.calls.length - 1];

describe('DriverComplianceTab', () => {
    it('renders server-computed rows, columns and the four stat cards', () => {
        setupMocks();
        renderWithProviders();

        expect(screen.getByText('Days until expiry')).toBeInTheDocument();
        expect(screen.queryByText('Item/Number')).not.toBeInTheDocument();
        expect(screen.queryByText('Total drivers')).not.toBeInTheDocument();
        for (const label of ['Expired', 'Expiring soon', 'Not set', 'Valid']) {
            expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
        }

        expect(screen.getByText('10 days overdue')).toBeInTheDocument();
        expect(screen.getByText('120 days')).toBeInTheDocument();
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('starts on the Needs attention default with server ordering, and sends contract sort keys', () => {
        setupMocks();
        renderWithProviders();

        expect(lastQuery()[0].orderBy).toBe('');
        expect(lastQuery()[1]).toEqual({type: '', status: 'attention', fleet: 0});

        fireEvent.click(screen.getByText('Name'));
        expect(lastQuery()[0].orderBy).toBe('name');
        fireEvent.click(screen.getByText('Days until expiry'));
        expect(lastQuery()[0].orderBy).toBe('daysUntilExpiry');
        fireEvent.click(screen.getByText('Expiry date'));
        expect(lastQuery()[0].orderBy).toBe('expiryDate');
    });

    it('sends a per-row reminder for that courier only, choosing SMS, and toasts only the sent count', async () => {
        const user = setupUser();
        const showToast = vi.fn();
        setupMocks();
        mutateAsync.mockResolvedValue({...previewResult(1), sent: 1, nothingDue: 2});
        renderWithProviders(showToast);

        const buttons = screen.getAllByRole('button', {name: 'Send reminder'});
        expect(buttons[1]).toBeDisabled();
        expect(buttons[0]).toBeEnabled();

        await user.click(buttons[0]);
        expect(lastPreviewTarget()).toEqual({courierIds: [10]});
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('John Smith')).toBeInTheDocument();
        expect(within(dialog).getByText(/will get a reminder about everything that needs renewing/)).toBeInTheDocument();
        await user.click(within(dialog).getByLabelText('SMS'));
        await user.click(within(dialog).getByRole('button', {name: 'Send reminders'}));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({courierIds: [10], channel: 2}));
        expect(showToast).toHaveBeenCalledTimes(1);
        expect(showToast).toHaveBeenCalledWith('Reminders sent to 1 driver', 'success');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('previews the bulk count from the current filters, sends them, warns about failures, and shows a 400 message', async () => {
        const user = setupUser();
        const showToast = vi.fn();
        setupMocks({preview: {data: previewResult(3), isLoading: false, isError: false}});
        mutateAsync.mockResolvedValueOnce({
            ...previewResult(3), sent: 1, failed: 4,
            failures: [1, 2, 3, 4].map(id => ({courierId: id, name: `Driver ${id}`, reason: 'no device'})),
        });
        renderWithProviders(showToast);

        fireEvent.change(screen.getByPlaceholderText('Search compliance…'), {target: {value: 'smith'}});
        await waitFor(() => expect(lastQuery()[0].searchTerm).toBe('smith'));
        await user.click(screen.getByRole('button', {name: /Send reminders/}));
        expect(lastPreviewTarget()).toEqual({filter: {searchTerm: 'smith', fleet: 0, type: '', status: 'attention'}});
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText("3 drivers will get a reminder about the items you've filtered to.")).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', {name: 'Send reminders'}));

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
            filter: {searchTerm: 'smith', fleet: 0, type: '', status: 'attention'},
            channel: 1,
        }));
        await waitFor(() => expect(showToast).toHaveBeenCalledWith(
            "4 couldn't be sent: Driver 1 (no device), Driver 2 (no device), Driver 3 (no device) and 1 more", 'warning'));
        expect(showToast).toHaveBeenCalledWith('Reminders sent to 1 driver', 'success');

        await user.click(screen.getByRole('button', {name: /Send reminders/}));
        mutateAsync.mockRejectedValueOnce({status: 400, message: 'Too many recipients.'});
        await user.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Send reminders'}));
        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Too many recipients.', 'error'));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('disables Send while the preview loads, when no one is due, and when over the limit', async () => {
        const user = setupUser();
        setupMocks({preview: {data: undefined, isLoading: true, isError: false}});
        const loading = renderWithProviders();
        await user.click(screen.getByRole('button', {name: /Send reminders/}));
        expect(screen.getByLabelText('Checking who will get a reminder')).toBeInTheDocument();
        expect(within(screen.getByRole('dialog')).getByRole('button', {name: 'Send reminders'})).toBeDisabled();
        loading.unmount();

        setupMocks({preview: {data: previewResult(0), isLoading: false, isError: false}});
        const none = renderWithProviders();
        await user.click(screen.getByRole('button', {name: /Send reminders/}));
        expect(screen.getByText('No one in these filters needs a reminder.')).toBeInTheDocument();
        expect(within(screen.getByRole('dialog')).getByRole('button', {name: 'Send reminders'})).toBeDisabled();
        none.unmount();

        setupMocks({preview: {data: previewResult(250), isLoading: false, isError: false}});
        renderWithProviders();
        await user.click(screen.getByRole('button', {name: /Send reminders/}));
        expect(screen.getByText(/That's 250 drivers\. Narrow the filters to 200 or fewer\./)).toBeInTheDocument();
        expect(within(screen.getByRole('dialog')).getByRole('button', {name: 'Send reminders'})).toBeDisabled();
    });

    it('keeps the dialog busy and blocks a second send while the mutation is pending', async () => {
        const user = setupUser();
        setupMocks({isSending: true});
        renderWithProviders();

        await user.click(screen.getByRole('button', {name: /Send reminders/}));
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByRole('button', {name: 'Send reminders'})).toBeDisabled();
        expect(within(dialog).getByRole('button', {name: 'Cancel'})).toBeDisabled();
        fireEvent.click(within(dialog).getByRole('button', {name: 'Send reminders'}));
        expect(mutateAsync).not.toHaveBeenCalled();
    });

    it('closes the dialog on Cancel', async () => {
        const user = setupUser();
        setupMocks();
        renderWithProviders();

        await user.click(screen.getByRole('button', {name: /Send reminders/}));
        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('shows loading, load-failed (with retry), true-empty and filtered-empty states', async () => {
        const user = setupUser();
        setupMocks({isLoading: true});
        const loading = renderWithProviders();
        expect(screen.getByText('Loading…')).toBeInTheDocument();
        loading.unmount();

        setupMocks({isError: true});
        const failed = renderWithProviders();
        expect(screen.getByText("Couldn't load compliance items")).toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: 'Try again'}));
        expect(refetch).toHaveBeenCalled();
        failed.unmount();

        setupMocks({data: emptyData()});
        renderWithProviders();
        expect(screen.getByText('Nothing needs attention')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Search compliance…'), {target: {value: 'zzz'}});
        await screen.findByText('No compliance items match these filters');
        expect(screen.getByText('No compliance items match these filters')).toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: 'Clear filters'}));
        expect(lastQuery()[0].searchTerm).toBe('');
        expect(screen.getByText('Nothing needs attention')).toBeInTheDocument();
    });
});
