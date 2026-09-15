/**
 * ChangeCourierDialog Component Tests
 *
 * Covers the two-phase flow for changing the paid courier on an archived,
 * completed job: pick a courier (with invoicing warning) → confirm → save.
 */

import React from 'react';
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {setupUser} from '../../../__testUtils__/setupUser';
import {renderWithMantine} from '../../../__testUtils__';
import {ChangeCourierDialog, ChangeCourierDialogProps} from './ChangeCourierDialog';

const userEvent = setupUser();

const mockCouriers = [
    {id: 101, text: 'Nina New'},
    {id: 102, text: 'Other Courier'},
];

const createMockProps = (overrides: Partial<ChangeCourierDialogProps> = {}): ChangeCourierDialogProps => ({
    open: true,
    jobNo: 'JOB-001',
    currentCourierName: 'Olive Old',
    onClose: jest.fn(),
    onSave: jest.fn().mockResolvedValue(undefined),
    showToast: jest.fn(),
    searchCouriers: jest.fn().mockResolvedValue(mockCouriers),
    ...overrides,
});

/** Type into the courier search and pick the first option. */
const pickCourier = async () => {
    const search = screen.getByPlaceholderText(/Search courier/);
    fireEvent.focus(search);
    fireEvent.change(search, {target: {value: 'Nina'}});
    const option = await screen.findByRole('option', {name: /Nina New/});
    fireEvent.click(option);
};

/** Render and advance to the confirm phase. */
const advanceToConfirm = async (props: ChangeCourierDialogProps) => {
    renderWithMantine(<ChangeCourierDialog {...props} />);
    await pickCourier();
    await userEvent.click(screen.getByRole('button', {name: /^save$/i}));
    await screen.findByRole('button', {name: /confirm change/i});
};

describe('ChangeCourierDialog', () => {
    it('renders phase 1 with invoicing warning, current courier, and disabled Save', () => {
        renderWithMantine(<ChangeCourierDialog {...createMockProps()} />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Change Paid Courier')).toBeInTheDocument();
        // The invoicing-impact warning
        expect(screen.getByText(/changes which courier is invoiced and paid/i)).toBeInTheDocument();
        // Current courier shown read-only
        expect(screen.getByDisplayValue('Olive Old')).toBeInTheDocument();
        // Save disabled until a courier is picked
        expect(screen.getByRole('button', {name: /^save$/i})).toBeDisabled();
    });

    it('does not render when open is false', () => {
        renderWithMantine(<ChangeCourierDialog {...createMockProps({open: false})} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('searches couriers, enables Save on selection, and moves to confirm without saving', async () => {
        const props = createMockProps();
        renderWithMantine(<ChangeCourierDialog {...props} />);

        await pickCourier();
        expect(props.searchCouriers).toHaveBeenCalledWith('Nina');

        const save = screen.getByRole('button', {name: /^save$/i});
        expect(save).toBeEnabled();
        await userEvent.click(save);

        // Confirm phase: final warning question with both couriers, no save yet
        expect(await screen.findByText(/are you sure you want to change which courier is invoiced/i))
            .toBeInTheDocument();
        expect(screen.getByText('Olive Old')).toBeInTheDocument();
        expect(screen.getByText('Nina New')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /back/i})).toBeInTheDocument();
        expect(props.onSave).not.toHaveBeenCalled();
    });

    it('returns to phase 1 when Back is clicked', async () => {
        const props = createMockProps();
        await advanceToConfirm(props);

        await userEvent.click(screen.getByRole('button', {name: /back/i}));

        expect(screen.getByRole('button', {name: /^save$/i})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /confirm change/i})).not.toBeInTheDocument();
    });

    it('calls onSave with the courier id, toasts success, and closes on confirm', async () => {
        const props = createMockProps();
        await advanceToConfirm(props);

        await userEvent.click(screen.getByRole('button', {name: /confirm change/i}));

        await waitFor(() => {
            expect(props.onSave).toHaveBeenCalledWith(101);
            expect(props.showToast).toHaveBeenCalledWith(expect.stringMatching(/courier changed/i), 'success');
            expect(props.onClose).toHaveBeenCalled();
        });
    });

    it('toasts an error, stays open, and re-enables on save failure', async () => {
        const props = createMockProps({
            onSave: jest.fn().mockRejectedValue(new Error('API error')),
        });
        await advanceToConfirm(props);

        await userEvent.click(screen.getByRole('button', {name: /confirm change/i}));

        await waitFor(() => {
            expect(props.showToast).toHaveBeenCalledWith(expect.any(String), 'error');
        });
        expect(props.onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', {name: /confirm change/i})).toBeEnabled();
    });

    it('resets to phase 1 with no selection when reopened', async () => {
        const props = createMockProps();
        const {rerender} = renderWithMantine(<ChangeCourierDialog {...props} />);

        await pickCourier();
        await userEvent.click(screen.getByRole('button', {name: /^save$/i}));
        await screen.findByRole('button', {name: /confirm change/i});

        await act(async () => {
            rerender(<ChangeCourierDialog {...props} open={false} />);
        });
        await act(async () => {
            rerender(<ChangeCourierDialog {...props} open={true} />);
        });

        expect(screen.getByRole('button', {name: /^save$/i})).toBeDisabled();
    });
});
