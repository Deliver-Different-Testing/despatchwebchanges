import React from 'react';
import {screen} from '@testing-library/react';
import {DeleteLayoutDialog} from './DeleteLayoutDialog';
import { renderWithMantine } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';

function setup(overrides: Partial<React.ComponentProps<typeof DeleteLayoutDialog>> = {}) {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    renderWithMantine(
        <DeleteLayoutDialog
            open
            layoutName="Night Shift"
            onClose={onClose}
            onConfirm={onConfirm}
            {...overrides}
        />,
    );
    return {onClose, onConfirm};
}

describe('DeleteLayoutDialog', () => {
    it('renders the title and the layout name when open', () => {
        setup();
        expect(screen.getByText('Delete Layout')).toBeInTheDocument();
        // Name appears in the subtitle and the warning body.
        expect(screen.getAllByText(/Night Shift/).length).toBeGreaterThan(0);
    });

    it('calls onConfirm when Delete is clicked', async () => {
        const user = setupUser();
        const {onConfirm, onClose} = setup();

        await user.click(screen.getByRole('button', {name: /delete/i}));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Cancel is clicked', async () => {
        const user = setupUser();
        const {onClose, onConfirm} = setup();

        await user.click(screen.getByRole('button', {name: /cancel/i}));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
