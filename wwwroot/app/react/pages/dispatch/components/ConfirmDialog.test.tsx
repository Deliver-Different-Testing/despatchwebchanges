/** @jest-environment jest-environment-jsdom */
/**
 * ConfirmDialog Component Tests
 */

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';
import {renderWithTheme} from '../../../__testUtils__';
import {ConfirmDialog, ConfirmDialogProps} from './ConfirmDialog';

const defaultProps: ConfirmDialogProps = {
    open: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
};

function renderDialog(overrides?: Partial<ConfirmDialogProps>) {
    const props = {...defaultProps, ...overrides};
    return renderWithTheme(<ConfirmDialog {...props} />);
}

describe('ConfirmDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not render when open is false', () => {
        renderDialog({open: false});

        expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
        expect(screen.queryByText('Are you sure you want to proceed?')).not.toBeInTheDocument();
    });

    it('renders dialog with title and message when open', () => {
        renderDialog();

        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('shows default button labels', () => {
        renderDialog();

        expect(screen.getByRole('button', {name: 'Confirm'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    });

    it('shows custom button labels when provided', () => {
        renderDialog({confirmLabel: 'Yes, Delete', cancelLabel: 'Go Back'});

        expect(screen.getByRole('button', {name: 'Yes, Delete'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Go Back'})).toBeInTheDocument();
    });

    it('calls onConfirm when confirm button clicked', () => {
        const onConfirm = jest.fn();
        renderDialog({onConfirm});

        fireEvent.click(screen.getByRole('button', {name: 'Confirm'}));

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when cancel button clicked', () => {
        const onClose = jest.fn();
        renderDialog({onClose});

        fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close icon button clicked', () => {
        const onClose = jest.fn();
        renderDialog({onClose});

        // The close icon button is the IconButton with CloseIcon, not the Cancel text button
        const buttons = screen.getAllByRole('button');
        const closeIconButton = buttons.find(
            btn => btn.querySelector('[data-testid="CloseIcon"]')
        );
        expect(closeIconButton).toBeDefined();
        fireEvent.click(closeIconButton!);

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
