/**
 * Main-flow characterization tests for AccessorialChargesDialog.
 *
 * Written against the MUI implementation ahead of the Mantine conversion — the
 * only prior coverage was the Auto-Mate suggest path. Queries go through
 * visible text, roles and placeholders so they survive the port.
 */

import type {Mock, Mocked} from 'vitest';
import React from 'react';
import {fireEvent, screen, waitFor, within} from '@testing-library/react';
import {renderWithMantine} from '../../../test/utils';
import {AccessorialChargesDialog} from './AccessorialChargesDialog';
import {accessorialChargesApi} from '../../../api/accessorialChargesApi';
import {isAiEnabled} from '../../../utils/aiSettings';
import {clearSessionContext, setSessionContext, SessionContextDto} from '../../../api/session';
import type {
    AccessorialChargeDto,
    AccessorialChargesDialogProps,
    AccessorialChargesJob,
    JobAccessorialChargeDto,
} from './types';

vi.mock('../../../api/accessorialChargesApi', () => ({
    accessorialChargesApi: {
        getAvailableCharges: vi.fn(),
        getAppliedCharges: vi.fn(),
        getJobAmount: vi.fn(),
        addCharges: vi.fn(),
        updateCharge: vi.fn(),
        deleteCharge: vi.fn(),
    },
}));
vi.mock('../../../api/aiAssistantApi', () => ({analyzePricing: vi.fn()}));
vi.mock('../../../utils/aiSettings', () => ({isAiEnabled: vi.fn()}));

const api = accessorialChargesApi as Mocked<typeof accessorialChargesApi>;
const mockIsAiEnabled = isAiEnabled as Mock;

const job: AccessorialChargesJob = {id: 123, accessorialChargeGroupId: 5, amount: 100, weight: 10, quantity: 1};

/** A flat charge needs no input value, so it can be added without extra typing. */
const flatCharge: AccessorialChargeDto = {
    accessorialChargeId: 5,
    name: 'Tail-lift',
    description: 'Tail lift required',
    chargeType: 'flat',
    baseRate: 25,
    calculationOrder: 1,
    alreadyApplied: false,
};

/** A per-unit charge on a non-auto unit, so its input stays user-editable. */
const perUnitCharge: AccessorialChargeDto = {
    accessorialChargeId: 6,
    name: 'Waiting Time',
    description: 'Driver waiting',
    chargeType: 'hourly',
    unitTypeName: 'Hour',
    ratePerUnit: 40,
    calculationOrder: 2,
    alreadyApplied: false,
};

const appliedFlat: JobAccessorialChargeDto = {
    jobAccessorialChargeId: 900,
    jobId: 123,
    accessorialChargeId: 5,
    name: 'Tail-lift',
    chargeType: 'flat',
    baseRate: 25,
    itemCount: 1,
    calculatedAmount: 25,
    calculationOrder: 1,
    addedAtStage: 'booking',
    alwaysApply: false,
};

const appliedAlways: JobAccessorialChargeDto = {
    ...appliedFlat,
    jobAccessorialChargeId: 901,
    accessorialChargeId: 7,
    name: 'Admin Fee',
    calculatedAmount: 10,
    alwaysApply: true,
};

function renderDialog(overrides: Partial<AccessorialChargesDialogProps> = {}) {
    const props: AccessorialChargesDialogProps = {
        open: true,
        job,
        onClose: vi.fn(),
        showToast: vi.fn(),
        ...overrides,
    };
    return {props, ...renderWithMantine(<AccessorialChargesDialog {...props} />)};
}

/** The applied-charges table row for a named charge. */
async function appliedRow(name: string): Promise<HTMLElement> {
    const cell = await screen.findByText(name);
    return cell.closest('tr') as HTMLElement;
}

beforeEach(() => {
    vi.clearAllMocks();
    mockIsAiEnabled.mockReturnValue(false);
    (api.getAvailableCharges as Mock).mockResolvedValue([flatCharge, perUnitCharge]);
    (api.getAppliedCharges as Mock).mockResolvedValue([]);
    (api.getJobAmount as Mock).mockResolvedValue(100);
    (api.addCharges as Mock).mockResolvedValue(undefined);
    (api.updateCharge as Mock).mockImplementation((jobAccessorialChargeId: number, data: object) =>
        Promise.resolve({...appliedFlat, jobAccessorialChargeId, ...data}));
    (api.deleteCharge as Mock).mockResolvedValue(undefined);
});

describe('AccessorialChargesDialog — chrome and loading', () => {
    it('renders the header, both sections and the available charges', async () => {
        renderDialog();

        expect(await screen.findByText('Add charges')).toBeInTheDocument();
        expect(screen.getByText('Accessorial charges')).toBeInTheDocument();
        expect(screen.getByText('Manage additional charges for this job')).toBeInTheDocument();
        expect(screen.getByText('Applied charges')).toBeInTheDocument();

        expect(screen.getByText('Tail-lift')).toBeInTheDocument();
        expect(screen.getByText('Tail lift required')).toBeInTheDocument();
        expect(screen.getByText('Waiting Time')).toBeInTheDocument();

        expect(api.getAvailableCharges).toHaveBeenCalledWith(5, 123);
        expect(api.getAppliedCharges).toHaveBeenCalledWith(123);
    });

    it('shows both empty states when the job has no applied or available charges', async () => {
        (api.getAvailableCharges as Mock).mockResolvedValue([]);
        renderDialog();

        expect(await screen.findByText('No charges have been applied to this job.')).toBeInTheDocument();
        expect(screen.getByText('No charges in this group yet.')).toBeInTheDocument();
    });

    it('renders nothing when closed', () => {
        renderDialog({open: false});
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes from the footer and the header', async () => {
        const {props} = renderDialog();
        await screen.findByText('Add charges');

        // The header X and the footer button both dismiss; the shared header
        // labels its close "Close dialog", the footer button reads "Close".
        fireEvent.click(screen.getByLabelText('Close dialog'));
        fireEvent.click(screen.getByRole('button', {name: 'Close'}));

        expect(props.onClose).toHaveBeenCalledTimes(2);
    });

    it('reloads both lists when Refresh is clicked', async () => {
        renderDialog();
        await screen.findByText('Add charges');
        expect(api.getAppliedCharges).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));

        await waitFor(() => expect(api.getAppliedCharges).toHaveBeenCalledTimes(2));
        expect(api.getAvailableCharges).toHaveBeenCalledTimes(2);
    });
});

describe('AccessorialChargesDialog — applied charges', () => {
    it('lists applied charges with their stage, amount and total', async () => {
        (api.getAvailableCharges as Mock).mockResolvedValue([]);
        (api.getAppliedCharges as Mock).mockResolvedValue([appliedFlat, appliedAlways]);
        renderDialog();

        const row = await appliedRow('Tail-lift');
        expect(within(row).getByText('BOOKING')).toBeInTheDocument();
        expect(within(row).getAllByText('Flat fee')).toHaveLength(2);
        expect(within(row).getByText('$25.00')).toBeInTheDocument();

        // Footer total across both applied charges.
        expect(screen.getByText('Total')).toBeInTheDocument();
        expect(screen.getByText('$35.00')).toBeInTheDocument();
    });

    it('marks an always-applied charge and blocks its removal', async () => {
        (api.getAppliedCharges as Mock).mockResolvedValue([appliedAlways]);
        renderDialog();

        const row = await appliedRow('Admin Fee');
        expect(within(row).getByText('ALWAYS')).toBeInTheDocument();
        expect(within(row).getByRole('button', {name: /cannot be removed/i})).toBeDisabled();
    });

    it('reveals Save once a row is edited and sends the update', async () => {
        (api.getAvailableCharges as Mock).mockResolvedValue([]);
        (api.getAppliedCharges as Mock).mockResolvedValue([appliedFlat]);
        const {props} = renderDialog();

        const row = await appliedRow('Tail-lift');
        expect(within(row).queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();

        fireEvent.change(within(row).getByPlaceholderText('Notes'), {target: {value: 'Agreed with client'}});

        const save = within(row).getByRole('button', {name: 'Save'});
        fireEvent.click(save);

        await waitFor(() => expect(api.updateCharge).toHaveBeenCalledWith(
            900,
            expect.objectContaining({notes: 'Agreed with client'}),
        ));
        await waitFor(() => expect(props.showToast).toHaveBeenCalledWith(expect.stringMatching(/updated/i), 'success'));
    });

    it('sends an override amount when one is entered', async () => {
        (api.getAvailableCharges as Mock).mockResolvedValue([]);
        (api.getAppliedCharges as Mock).mockResolvedValue([appliedFlat]);
        renderDialog();

        const row = await appliedRow('Tail-lift');
        fireEvent.change(within(row).getByLabelText('Override'), {target: {value: '99'}});
        fireEvent.click(within(row).getByRole('button', {name: 'Save'}));

        await waitFor(() => expect(api.updateCharge).toHaveBeenCalledWith(
            900,
            expect.objectContaining({overrideAmount: 99}),
        ));
    });

    it('shows the driver amount for an applied charge', async () => {
        (api.getAvailableCharges as Mock).mockResolvedValue([]);
        (api.getAppliedCharges as Mock).mockResolvedValue([{...appliedFlat, driverCalculatedAmount: 8}]);
        renderDialog();

        const row = await appliedRow('Tail-lift');
        expect(within(row).getByText(/Driver:/)).toHaveTextContent('8.00');
    });

    it('shows the driver override instead of the calculated driver amount when one is set', async () => {
        (api.getAvailableCharges as Mock).mockResolvedValue([]);
        (api.getAppliedCharges as Mock).mockResolvedValue([
            {...appliedFlat, driverCalculatedAmount: 8, driverOverrideAmount: 6},
        ]);
        renderDialog();

        const row = await appliedRow('Tail-lift');
        expect(within(row).getByText(/Driver:/)).toHaveTextContent('6.00');
        expect(within(row).getByLabelText('Driver override')).toHaveValue('6');
    });

    it('sends a driver override amount when one is entered, without touching the customer override', async () => {
        (api.getAvailableCharges as Mock).mockResolvedValue([]);
        (api.getAppliedCharges as Mock).mockResolvedValue([appliedFlat]);
        renderDialog();

        const row = await appliedRow('Tail-lift');
        fireEvent.change(within(row).getByLabelText('Driver override'), {target: {value: '6'}});
        fireEvent.click(within(row).getByRole('button', {name: 'Save'}));

        await waitFor(() => expect(api.updateCharge).toHaveBeenCalledWith(
            900,
            expect.objectContaining({driverOverrideAmount: 6, overrideAmount: undefined}),
        ));
    });

    it('keeps an existing driver override when only the customer override is changed', async () => {
        (api.getAvailableCharges as Mock).mockResolvedValue([]);
        (api.getAppliedCharges as Mock).mockResolvedValue([{...appliedFlat, driverOverrideAmount: 6}]);
        renderDialog();

        const row = await appliedRow('Tail-lift');
        fireEvent.change(within(row).getByLabelText('Override'), {target: {value: '99'}});
        fireEvent.click(within(row).getByRole('button', {name: 'Save'}));

        await waitFor(() => expect(api.updateCharge).toHaveBeenCalledWith(
            900,
            expect.objectContaining({overrideAmount: 99, driverOverrideAmount: 6}),
        ));
    });

    it('removes an applied charge', async () => {
        (api.getAvailableCharges as Mock).mockResolvedValue([]);
        (api.getAppliedCharges as Mock).mockResolvedValue([appliedFlat]);
        const {props} = renderDialog();

        const row = await appliedRow('Tail-lift');
        fireEvent.click(within(row).getByRole('button', {name: 'Remove'}));

        await waitFor(() => expect(api.deleteCharge).toHaveBeenCalledWith(900));
        await waitFor(() => expect(props.showToast).toHaveBeenCalledWith(expect.stringMatching(/removed/i), 'success'));
    });

    it('reports a delete failure through the toast', async () => {
        (api.getAvailableCharges as Mock).mockResolvedValue([]);
        (api.getAppliedCharges as Mock).mockResolvedValue([appliedFlat]);
        (api.deleteCharge as Mock).mockRejectedValue(new Error('nope'));
        const {props} = renderDialog();

        const row = await appliedRow('Tail-lift');
        fireEvent.click(within(row).getByRole('button', {name: 'Remove'}));

        await waitFor(() => expect(props.showToast).toHaveBeenCalledWith(expect.any(String), 'error'));
    });
});

describe('AccessorialChargesDialog — adding charges', () => {
    it('offers the add action only once something is selected, then sends it', async () => {
        const {props} = renderDialog();
        await screen.findByText('Add charges');

        expect(screen.queryByRole('button', {name: /add selected charges/i})).not.toBeInTheDocument();

        const row = screen.getByText('Tail-lift').closest('tr') as HTMLElement;
        fireEvent.click(within(row).getByRole('checkbox'));

        // The flat charge's base rate shows in the button total.
        const addButton = await screen.findByRole('button', {name: /add selected charges \(\$25\.00\)/i});
        fireEvent.click(addButton);

        await waitFor(() => expect(api.addCharges).toHaveBeenCalledWith(123, [
            expect.objectContaining({accessorialChargeId: 5, itemCount: 1}),
        ]));
        await waitFor(() => expect(props.showToast).toHaveBeenCalledWith(expect.any(String), 'success'));
    });

    it('carries a per-row note through to the request', async () => {
        renderDialog();
        await screen.findByText('Add charges');

        const row = screen.getByText('Tail-lift').closest('tr') as HTMLElement;
        fireEvent.click(within(row).getByRole('checkbox'));
        fireEvent.change(within(row).getByPlaceholderText('Notes'), {target: {value: 'Customer requested'}});

        fireEvent.click(await screen.findByRole('button', {name: /add selected charges/i}));

        await waitFor(() => expect(api.addCharges).toHaveBeenCalledWith(123, [
            expect.objectContaining({notes: 'Customer requested'}),
        ]));
    });

    it('blocks the add and flags the field when a non-flat charge has no input', async () => {
        renderDialog();
        await screen.findByText('Add charges');

        const row = screen.getByText('Waiting Time').closest('tr') as HTMLElement;
        fireEvent.click(within(row).getByRole('checkbox'));

        fireEvent.click(await screen.findByRole('button', {name: /add selected charges/i}));

        expect(await screen.findByText('Required')).toBeInTheDocument();
        expect(api.addCharges).not.toHaveBeenCalled();
    });

    it('sends the typed input value for a per-unit charge', async () => {
        renderDialog();
        await screen.findByText('Add charges');

        const row = screen.getByText('Waiting Time').closest('tr') as HTMLElement;
        fireEvent.click(within(row).getByRole('checkbox'));
        fireEvent.change(within(row).getByRole('textbox', {name: /input value/i}), {target: {value: '2'}});

        fireEvent.click(await screen.findByRole('button', {name: /add selected charges/i}));

        await waitFor(() => expect(api.addCharges).toHaveBeenCalledWith(123, [
            expect.objectContaining({accessorialChargeId: 6, inputValue: 2}),
        ]));
    });

    it('reports an add failure through the toast', async () => {
        (api.addCharges as Mock).mockRejectedValue(new Error('nope'));
        const {props} = renderDialog();
        await screen.findByText('Add charges');

        const row = screen.getByText('Tail-lift').closest('tr') as HTMLElement;
        fireEvent.click(within(row).getByRole('checkbox'));
        fireEvent.click(await screen.findByRole('button', {name: /add selected charges/i}));

        await waitFor(() => expect(props.showToast).toHaveBeenCalledWith(expect.any(String), 'error'));
    });
});

describe('AccessorialChargesDialog — portion jobs', () => {
    const portionJob: AccessorialChargesJob = {
        ...job,
        portionJobs: [
            {jobId: 123, label: 'Leg 1', accessorialChargeGroupId: 5},
            {jobId: 456, label: 'Leg 2', accessorialChargeGroupId: 8},
        ],
    };

    it('renders a tab per portion and loads the chosen leg', async () => {
        renderDialog({job: portionJob});
        await screen.findByText('Add charges');

        expect(screen.getByRole('tab', {name: 'Leg 1'})).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', {name: 'Leg 2'}));

        await waitFor(() => expect(api.getAppliedCharges).toHaveBeenCalledWith(456));
        expect(api.getAvailableCharges).toHaveBeenCalledWith(8, 456);
    });

    it('exposes the portion strip as a tablist and marks only the active leg selected', async () => {
        renderDialog({job: portionJob});
        await screen.findByText('Add charges');

        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getByRole('tab', {name: 'Leg 1'})).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', {name: 'Leg 2'})).toHaveAttribute('aria-selected', 'false');

        fireEvent.click(screen.getByRole('tab', {name: 'Leg 2'}));

        await waitFor(() =>
            expect(screen.getByRole('tab', {name: 'Leg 2'})).toHaveAttribute('aria-selected', 'true'));
        expect(screen.getByRole('tab', {name: 'Leg 1'})).toHaveAttribute('aria-selected', 'false');
    });
});

// Driver pay on accessorials doesn't apply to NZ (NZ pays the courier a % of the whole job), so its UI is hidden there.
describe('AccessorialChargesDialog — driver pay by tenant country', () => {
    const tenantContext = (countryCode: string): SessionContextDto => ({
        contactId: 1, staffId: 1, firstName: 'A', fullName: 'A B', email: null, dispatcher: null,
        timeZone: 'Pacific/Auckland', countryCode, isUsTenant: false, currencyCode: 'NZD',
        clientInternal: true, isNetworkPartner: false, visibleFeatures: null, npMapCenter: null, hubUrl: null,
    });

    beforeEach(() => {
        (api.getAvailableCharges as Mock).mockResolvedValue([]);
        (api.getAppliedCharges as Mock).mockResolvedValue([{...appliedFlat, driverCalculatedAmount: 8}]);
    });

    afterEach(() => clearSessionContext());

    it('hides the driver amount and driver override for an NZ tenant', async () => {
        setSessionContext(tenantContext('NZ'));
        renderDialog();

        const row = await appliedRow('Tail-lift');
        expect(within(row).getByLabelText('Override')).toBeInTheDocument();
        expect(within(row).queryByText(/Driver:/)).not.toBeInTheDocument();
        expect(within(row).queryByLabelText('Driver override')).not.toBeInTheDocument();
    });

    it('shows the driver amount and driver override for an AU tenant', async () => {
        setSessionContext(tenantContext('AU'));
        renderDialog();

        const row = await appliedRow('Tail-lift');
        expect(within(row).getByText(/Driver:/)).toBeInTheDocument();
        expect(within(row).getByLabelText('Driver override')).toBeInTheDocument();
    });
});
