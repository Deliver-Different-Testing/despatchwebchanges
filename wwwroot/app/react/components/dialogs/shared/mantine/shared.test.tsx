import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {DialogShell, DialogHeader, DialogFooter} from './index';
import {renderWithMantine} from '../../../../__testUtils__';

interface Handlers {
    onClose?: () => void;
    onCancel?: () => void;
    onConfirm?: () => void;
    submitting?: boolean;
}

function renderDialog(h: Handlers = {}) {
    const onClose = h.onClose ?? jest.fn();
    return renderWithMantine(
        <DialogShell opened onClose={onClose}>
            <DialogHeader
                icon={<span data-testid="header-icon"/>}
                title="Edit price"
                subtitle="Job 1234"
                onClose={onClose}
            />
            <DialogFooter
                onCancel={h.onCancel ?? jest.fn()}
                onConfirm={h.onConfirm ?? jest.fn()}
                confirmLabel="Save"
                submitting={h.submitting}
            />
        </DialogShell>,
    );
}

describe('Mantine dialog primitives', () => {
    it('renders the shell, title, subtitle and both actions', () => {
        renderDialog();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Edit price')).toBeInTheDocument();
        expect(screen.getByText('Job 1234')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    });

    it('fires onClose from the header close button', async () => {
        const onClose = jest.fn();
        renderDialog({onClose});
        await userEvent.click(screen.getByRole('button', {name: 'Close dialog'}));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('fires the footer callbacks', async () => {
        const onCancel = jest.fn();
        const onConfirm = jest.fn();
        renderDialog({onCancel, onConfirm});
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('disables Cancel and shows the confirm loader while submitting', () => {
        renderDialog({submitting: true});
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Save'})).toHaveAttribute('data-loading', 'true');
    });
});
