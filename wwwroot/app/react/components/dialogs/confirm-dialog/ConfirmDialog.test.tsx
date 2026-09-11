import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';
import {ConfirmDialog} from './ConfirmDialog';

describe('ConfirmDialog', () => {
    const props = {
        opened: true,
        title: 'Send Quote Request',
        message: 'Send a quote request to Acme Air for job ABC123?',
        onClose: jest.fn(),
        onConfirm: jest.fn(),
    };

    beforeEach(() => jest.clearAllMocks());

    it('shows the title and message', () => {
        renderWithMantine(<ConfirmDialog {...props}/>);

        expect(screen.getByText('Send Quote Request')).toBeInTheDocument();
        expect(screen.getByText(/Acme Air for job ABC123/)).toBeInTheDocument();
    });

    it('names the dialog for assistive tech', () => {
        renderWithMantine(<ConfirmDialog {...props}/>);
        expect(screen.getByRole('dialog')).toHaveAccessibleName('Send Quote Request');
    });

    it('renders nothing when closed', () => {
        renderWithMantine(<ConfirmDialog {...props} opened={false}/>);
        // MantineProvider injects a <style>, so assert on the role instead.
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('confirms and cancels through the footer', async () => {
        const user = setupUser();
        renderWithMantine(<ConfirmDialog {...props}/>);

        await user.click(screen.getByRole('button', {name: /confirm/i}));
        expect(props.onConfirm).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('button', {name: /cancel/i}));
        expect(props.onClose).toHaveBeenCalled();
    });

    it('honours custom button labels', () => {
        renderWithMantine(
            <ConfirmDialog {...props} confirmLabel="Send request" cancelLabel="Not now"/>,
        );

        expect(screen.getByRole('button', {name: 'Send request'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Not now'})).toBeInTheDocument();
    });

    describe('acknowledge-only (no onConfirm)', () => {
        it('offers a single OK and no Cancel', () => {
            // There is no choice to make, so a Cancel would imply one.
            renderWithMantine(
                <ConfirmDialog
                    opened
                    title="Flight Assignment Required"
                    message="Assign a flight before assigning an agent."
                    onClose={props.onClose}
                />,
            );

            expect(screen.getByRole('button', {name: 'OK'})).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: /cancel/i})).not.toBeInTheDocument();
        });

        it('closes from OK', async () => {
            const user = setupUser();
            const onClose = jest.fn();
            renderWithMantine(
                <ConfirmDialog opened title="Heads up" message="Noted." onClose={onClose}/>,
            );

            await user.click(screen.getByRole('button', {name: 'OK'}));
            expect(onClose).toHaveBeenCalled();
        });
    });

    it('disables both buttons while submitting', () => {
        renderWithMantine(<ConfirmDialog {...props} submitting/>);

        expect(screen.getByRole('button', {name: /confirm/i})).toBeDisabled();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeDisabled();
    });

    it('accepts a node message for richer content', () => {
        renderWithMantine(
            <ConfirmDialog {...props} message={<span data-testid="rich">Rich body</span>}/>,
        );

        expect(screen.getByTestId('rich')).toBeInTheDocument();
    });
});
