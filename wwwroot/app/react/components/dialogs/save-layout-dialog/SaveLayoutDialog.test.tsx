import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SaveLayoutDialog} from './SaveLayoutDialog';
import {renderWithTheme} from '../../../__testUtils__';

function setup(overrides: Partial<React.ComponentProps<typeof SaveLayoutDialog>> = {}) {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    renderWithTheme(
        <SaveLayoutDialog
            open
            existingNames={['Default']}
            onClose={onClose}
            onConfirm={onConfirm}
            {...overrides}
        />,
    );
    return {onClose, onConfirm};
}

describe('SaveLayoutDialog', () => {
    it('renders the header title and name field when open', () => {
        setup();
        expect(screen.getByText('Save Layout')).toBeInTheDocument();
        expect(screen.getByLabelText('Layout name')).toBeInTheDocument();
    });

    it('disables Add Layout when the name is empty and enables it once a valid name is typed', async () => {
        const user = userEvent.setup();
        setup();

        const addButton = screen.getByRole('button', {name: /add layout/i});
        expect(addButton).toBeDisabled();

        await user.click(screen.getByLabelText('Layout name'));
        await user.paste('My Layout');
        expect(addButton).not.toBeDisabled();
    });

    it('rejects a duplicate name (case-insensitive) with an error and keeps Add Layout disabled', async () => {
        const user = userEvent.setup();
        setup({existingNames: ['Default', 'Dispatch']});

        await user.click(screen.getByLabelText('Layout name'));
        await user.paste('dispatch');

        expect(screen.getByText('A layout with this name already exists.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /add layout/i})).toBeDisabled();
    });

    it('calls onConfirm with the trimmed name', async () => {
        const user = userEvent.setup();
        const {onConfirm} = setup();

        await user.click(screen.getByLabelText('Layout name'));
        await user.paste('  Night Shift  ');
        await user.click(screen.getByRole('button', {name: /add layout/i}));

        expect(onConfirm).toHaveBeenCalledWith('Night Shift');
    });

    it('submits on Enter', async () => {
        const user = userEvent.setup();
        const {onConfirm} = setup();

        await user.click(screen.getByLabelText('Layout name'));
        await user.paste('Quick');
        await user.keyboard('{Enter}');

        expect(onConfirm).toHaveBeenCalledWith('Quick');
    });

    it('calls onClose when Cancel is clicked', async () => {
        const user = userEvent.setup();
        const {onClose, onConfirm} = setup();

        await user.click(screen.getByRole('button', {name: /cancel/i}));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
