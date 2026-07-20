import React from 'react';
import {screen} from '@testing-library/react';
import {RestoreCompletedConfirmationDialog} from './RestoreCompletedConfirmationDialog';
import {renderWithTheme} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';

const defaultProps = {
    open: true,
    onConfirm: jest.fn(),
    onClose: jest.fn(),
};

describe('RestoreCompletedConfirmationDialog', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows singular copy for a single job', () => {
        renderWithTheme(<RestoreCompletedConfirmationDialog {...defaultProps} count={1} />);
        expect(screen.getByText('Restore completed job')).toBeInTheDocument();
        expect(screen.getByText(/This job is completed\. Restoring it reopens it as a new job/i)).toBeInTheDocument();
    });

    it('shows plural copy with the completed count for a bulk restore', () => {
        renderWithTheme(<RestoreCompletedConfirmationDialog {...defaultProps} count={3} />);
        expect(screen.getByText('Restore completed jobs')).toBeInTheDocument();
        expect(screen.getByText(/3 of the selected jobs are completed/i)).toBeInTheDocument();
    });

    it('leaves the remove-images checkbox off by default and confirms with false', async () => {
        const onConfirm = jest.fn();
        const user = setupUser();
        renderWithTheme(<RestoreCompletedConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);

        const checkbox = screen.getByRole('checkbox', {name: /Also remove the images captured/i});
        expect(checkbox).not.toBeChecked();
        expect(screen.getByText(/Captured photos and signatures will be kept/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: 'Restore'}));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(false);
    });

    it('confirms with true when the remove-images checkbox is ticked', async () => {
        const onConfirm = jest.fn();
        const user = setupUser();
        renderWithTheme(<RestoreCompletedConfirmationDialog {...defaultProps} onConfirm={onConfirm} />);

        await user.click(screen.getByRole('checkbox', {name: /Also remove the images captured/i}));
        expect(screen.getByText(/photos and signatures will be archived and hidden/i)).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: 'Restore'}));

        expect(onConfirm).toHaveBeenCalledWith(true);
    });

    it('calls onClose when Cancel is clicked', async () => {
        const onClose = jest.fn();
        const user = setupUser();
        renderWithTheme(<RestoreCompletedConfirmationDialog {...defaultProps} onClose={onClose} />);

        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('locks the dialog and shows progress while submitting', () => {
        renderWithTheme(<RestoreCompletedConfirmationDialog {...defaultProps} submitting />);

        expect(screen.getByRole('button', {name: /Restoring/})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
        expect(screen.getByLabelText('Close dialog')).toBeDisabled();
    });
});
