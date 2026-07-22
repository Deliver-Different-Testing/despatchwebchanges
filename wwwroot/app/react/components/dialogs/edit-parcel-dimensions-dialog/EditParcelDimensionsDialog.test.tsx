
import React from 'react';
import {screen, waitFor, within} from '@testing-library/react';
import {EditParcelDimensionsDialog} from './EditParcelDimensionsDialog';
import { renderWithTheme } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';
import type {ParcelDimensions} from './types';
import {apiClient} from '../../../services/apiClient';

jest.mock('../../../services/apiClient', () => ({
    apiClient: {
        get: jest.fn().mockResolvedValue(false),
        post: jest.fn().mockResolvedValue({}),
    },
}));

const mockPost = apiClient.post as jest.Mock;

const mockParcel = (overrides?: Partial<ParcelDimensions>): ParcelDimensions => ({
    itemName: 'Box',
    length: 10,
    depth: 5,
    height: 3,
    dimensions: '10 × 5 × 3 cm',
    ...overrides,
});

const defaultProps = {
    open: true,
    parcels: [mockParcel()],
    jobId: 1,
    isUsCustomer: false,
    onClose: jest.fn(),
    onSubmit: jest.fn(),
    showToast: jest.fn(),
};

// ── Header parcel count ────────────────────────────────────────────

describe('EditParcelDimensionsDialog header parcel count', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows singular parcel count for one parcel', () => {
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel()]} />);
        expect(screen.getByText(/1 type · 1 parcel total/i)).toBeInTheDocument();
    });

    it('shows plural parcel count for multiple identical parcels', () => {
        // Same attributes → grouped into 1 row with qty 3
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel(), mockParcel(), mockParcel()]} />);
        expect(screen.getByText(/1 type · 3 parcels total/i)).toBeInTheDocument();
    });

    it('shows correct type count for different parcels', () => {
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[
            mockParcel({itemName: 'A'}),
            mockParcel({itemName: 'B'}),
        ]} />);
        expect(screen.getByText(/2 types · 2 parcels total/i)).toBeInTheDocument();
    });
});

// ── Read-only (locked job) ─────────────────────────────────────────

describe('EditParcelDimensionsDialog read-only mode', () => {
    beforeEach(() => jest.clearAllMocks());

    it('hides Save, shows Close, disables inputs and shows the view-only subtitle', () => {
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} readOnly />);

        expect(screen.getByText('View only — this job is locked')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Close/i})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /^Save|Continue/i})).not.toBeInTheDocument();

        // Parcel fields are visible but not editable.
        const textboxes = screen.getAllByRole('textbox');
        expect(textboxes.length).toBeGreaterThan(0);
        textboxes.forEach((tb) => expect(tb).toBeDisabled());
    });
});

// ── Discard changes confirmation ───────────────────────────────────

describe('EditParcelDimensionsDialog discard changes confirmation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('closes directly when no changes have been made', async () => {
        const user = setupUser();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} />);

        await user.click(screen.getByRole('button', {name: /cancel/i}));

        expect(defaultProps.onClose).toHaveBeenCalled();
        expect(screen.queryByText('Discard unsaved changes')).not.toBeInTheDocument();
    });

    it('shows confirmation dialog when cancelling with unsaved changes', async () => {
        const user = setupUser();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} />);

        const nameInput = screen.getByPlaceholderText('Name');
        await user.clear(nameInput);
        await user.paste('Changed');

        await user.click(screen.getByRole('button', {name: /cancel/i}));

        expect(screen.getByText('Discard unsaved changes')).toBeInTheDocument();
        expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('closes when Discard is confirmed', async () => {
        const user = setupUser();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} />);

        const nameInput = screen.getByPlaceholderText('Name');
        await user.clear(nameInput);
        await user.paste('Changed');

        await user.click(screen.getByRole('button', {name: /cancel/i}));

        const confirmDialog = screen.getByText('Discard unsaved changes').closest('[role="dialog"]') as HTMLElement;
        await user.click(within(confirmDialog).getByRole('button', {name: /discard/i}));

        expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('keeps dialog open when Keep editing is clicked', async () => {
        const user = setupUser();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} />);

        const nameInput = screen.getByPlaceholderText('Name');
        await user.clear(nameInput);
        await user.paste('Changed');

        await user.click(screen.getByRole('button', {name: /cancel/i}));

        const confirmDialog = screen.getByText('Discard unsaved changes').closest('[role="dialog"]') as HTMLElement;
        await user.click(within(confirmDialog).getByRole('button', {name: /keep editing/i}));

        expect(defaultProps.onClose).not.toHaveBeenCalled();
        // Main dialog is still open and editable
        expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    });
});

// ── Row qty and delete ─────────────────────────────────────────────

describe('EditParcelDimensionsDialog row quantity and delete', () => {
    beforeEach(() => jest.clearAllMocks());

    it('increases qty when + is clicked', async () => {
        const user = setupUser();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel()]} />);

        expect(screen.getByText(/1 parcel total/i)).toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: /increase quantity/i}));
        expect(screen.getByText(/2 parcels total/i)).toBeInTheDocument();
    });

    it('decreases qty when - is clicked', async () => {
        const user = setupUser();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel(), mockParcel()]} />);

        expect(screen.getByText(/2 parcels total/i)).toBeInTheDocument();
        await user.click(screen.getByRole('button', {name: /decrease quantity/i}));
        expect(screen.getByText(/1 parcel total/i)).toBeInTheDocument();
    });

    it('disables - button when qty is 1', () => {
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel()]} />);
        expect(screen.getByRole('button', {name: /decrease quantity/i})).toBeDisabled();
    });

    it('deletes a row when Delete row is clicked', async () => {
        const user = setupUser();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[
            mockParcel({itemName: 'A'}),
            mockParcel({itemName: 'B'}),
        ]} />);

        expect(screen.getByText(/2 types · 2 parcels total/i)).toBeInTheDocument();
        await user.click(screen.getAllByRole('button', {name: /delete row/i})[0]);
        expect(screen.getByText(/1 type · 1 parcel total/i)).toBeInTheDocument();
    });

    it('keeps at least one empty row when the last row is deleted', async () => {
        const user = setupUser();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel()]} />);

        await user.click(screen.getByRole('button', {name: /delete row/i}));

        // Still has one row (reset to empty), so still shows 1 parcel total
        expect(screen.getByText(/1 type · 1 parcel total/i)).toBeInTheDocument();
    });
});

// ── Barcode auto-fill from job number ──────────────────────────────

describe('EditParcelDimensionsDialog barcode auto-fill', () => {
    beforeEach(() => jest.clearAllMocks());

    const savedParcels = () => {
        const call = mockPost.mock.calls.find(c => c[0] === 'job/UpdateJobPackages');
        return (call?.[1]?.parcels ?? []) as ParcelDimensions[];
    };

    it('auto-fills an added item barcode as {jobNumber}-N, continuing past existing barcodes and leaving them untouched', async () => {
        const user = setupUser();
        renderWithTheme(
            <EditParcelDimensionsDialog
                {...defaultProps}
                jobNumber={55}
                parcels={[mockParcel({weight: 5, barcode: '55-3'})]}
            />,
        );

        await user.click(screen.getByRole('button', {name: /increase quantity/i}));
        await user.click(screen.getByRole('button', {name: /^save$/i}));

        await waitFor(() => expect(mockPost).toHaveBeenCalledWith('job/UpdateJobPackages', expect.anything()));
        const barcodes = savedParcels().map(p => p.barcode);
        expect(barcodes).toContain('55-3'); // existing barcode preserved
        expect(barcodes).toContain('55-4'); // new item continues the sequence
    });

    it('auto-fills the first barcode of a newly added package type', async () => {
        const user = setupUser();
        renderWithTheme(
            <EditParcelDimensionsDialog
                {...defaultProps}
                jobNumber={55}
                parcels={[mockParcel({weight: 5})]}
            />,
        );

        await user.click(screen.getByRole('button', {name: /add package type/i}));

        // Give the new type a weight so Save enables.
        const weightInputs = screen.getAllByRole('spinbutton', {name: 'Weight'});
        await user.clear(weightInputs[weightInputs.length - 1]);
        await user.paste('5');

        await user.click(screen.getByRole('button', {name: /^save$/i}));

        await waitFor(() => expect(mockPost).toHaveBeenCalledWith('job/UpdateJobPackages', expect.anything()));
        expect(savedParcels().map(p => p.barcode)).toContain('55-1');
    });

    it('leaves added barcodes empty when no jobNumber is provided', async () => {
        const user = setupUser();
        renderWithTheme(
            <EditParcelDimensionsDialog
                {...defaultProps}
                parcels={[mockParcel({weight: 5})]}
            />,
        );

        await user.click(screen.getByRole('button', {name: /increase quantity/i}));
        await user.click(screen.getByRole('button', {name: /^save$/i}));

        await waitFor(() => expect(mockPost).toHaveBeenCalledWith('job/UpdateJobPackages', expect.anything()));
        expect(savedParcels().some(p => p.barcode)).toBe(false);
    });
});

// ── Weight validation ──────────────────────────────────────────────

describe('EditParcelDimensionsDialog weight validation', () => {
    beforeEach(() => jest.clearAllMocks());

    it('disables Save and shows error when a parcel has no weight', () => {
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel()]} />);

        expect(screen.getByRole('button', {name: /save/i})).toBeDisabled();
        expect(screen.getByText(/all parcels must have a weight greater than 0/i)).toBeInTheDocument();
    });

    it('enables Save once all parcels have a weight greater than 0', async () => {
        const user = setupUser();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel()]} />);

        const weightInputs = screen.getAllByRole('spinbutton', {name: 'Weight'});
        const weightInput = weightInputs[weightInputs.length - 1];
        await user.clear(weightInput);
        await user.paste('10');

        expect(screen.getByRole('button', {name: /save/i})).not.toBeDisabled();
        expect(screen.queryByText(/all parcels must have a weight greater than 0/i)).not.toBeInTheDocument();
    });

    it('disables Save when a parcel weight is zero', async () => {
        const user = setupUser();
        renderWithTheme(<EditParcelDimensionsDialog {...defaultProps} parcels={[mockParcel({weight: 5})]} />);

        const weightInputs = screen.getAllByRole('spinbutton', {name: 'Weight'});
        const weightInput = weightInputs[weightInputs.length - 1];
        await user.clear(weightInput);
        await user.paste('0');

        expect(screen.getByRole('button', {name: /save/i})).toBeDisabled();
    });
});

// ── Partner mode (Packages requires partner approval) ──────────────

describe('EditParcelDimensionsDialog partnerMode', () => {
    beforeEach(() => jest.clearAllMocks());

    it('labels the action "Continue" instead of "Save"', () => {
        renderWithTheme(
            <EditParcelDimensionsDialog
                {...defaultProps}
                parcels={[mockParcel({weight: 5})]}
                partnerMode
            />,
        );
        expect(screen.getByRole('button', {name: /continue/i})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /^save$/i})).not.toBeInTheDocument();
    });

    it('skips the UpdateJobPackages POST and resolves with captured parcels', async () => {
        const user = setupUser();
        const onSubmit = jest.fn();
        const showToast = jest.fn();
        renderWithTheme(
            <EditParcelDimensionsDialog
                {...defaultProps}
                parcels={[mockParcel({weight: 5})]}
                partnerMode
                onSubmit={onSubmit}
                showToast={showToast}
            />,
        );

        await user.click(screen.getByRole('button', {name: /continue/i}));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        const submitArg = onSubmit.mock.calls[0][0];
        expect(submitArg.parcels).toHaveLength(1);
        expect(submitArg.parcels[0]).toMatchObject({weight: 5, length: 10, depth: 5, height: 3});
        expect(submitArg.totalWeight).toBe(5);

        // No direct write, no success toast — those happen in the next dialog leg.
        expect(mockPost).not.toHaveBeenCalledWith('job/UpdateJobPackages', expect.anything());
        expect(showToast).not.toHaveBeenCalledWith(expect.stringMatching(/successfully updated/i), 'success');
    });

    it('non-partner mode still POSTs to UpdateJobPackages', async () => {
        const user = setupUser();
        const onSubmit = jest.fn();
        renderWithTheme(
            <EditParcelDimensionsDialog
                {...defaultProps}
                parcels={[mockParcel({weight: 5})]}
                onSubmit={onSubmit}
            />,
        );

        await user.click(screen.getByRole('button', {name: /save/i}));

        await waitFor(() =>
            expect(mockPost).toHaveBeenCalledWith(
                'job/UpdateJobPackages',
                expect.objectContaining({jobId: 1}),
            ),
        );
    });
});
