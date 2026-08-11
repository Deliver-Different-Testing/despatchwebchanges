import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {screen, waitFor} from '@testing-library/react';
import {SendToLiveConfirmationDialog} from './SendToLiveConfirmationDialog';
import {renderWithMantine} from '../../../__testUtils__';

const createProps = (overrides: Partial<React.ComponentProps<typeof SendToLiveConfirmationDialog>> = {}) => ({
    open: true,
    jobNo: 'JOB-001',
    onClose: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

describe('SendToLiveConfirmationDialog', () => {
    it('renders header, info paper, and footer buttons when open', () => {
        renderWithMantine(<SendToLiveConfirmationDialog {...createProps()} />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: /send to live/i})).toBeInTheDocument();
        expect(screen.getByText(/Release bulk job JOB-001 to the live dispatch screen/)).toBeInTheDocument();
        expect(screen.getByText(/will be released and become visible/)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /^send to live$/i})).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        renderWithMantine(<SendToLiveConfirmationDialog {...createProps({open: false})} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', async () => {
        const user = setupUser();
        const props = createProps();
        renderWithMantine(<SendToLiveConfirmationDialog {...props} />);

        await user.click(screen.getByRole('button', {name: /cancel/i}));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).not.toHaveBeenCalled();
    });

    it('calls onClose when the close icon is clicked', async () => {
        const user = setupUser();
        const props = createProps();
        renderWithMantine(<SendToLiveConfirmationDialog {...props} />);

        await user.click(screen.getByRole('button', {name: /close dialog/i}));
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm then onClose when Send to Live is clicked', async () => {
        const user = setupUser();
        const props = createProps();
        renderWithMantine(<SendToLiveConfirmationDialog {...props} />);

        await user.click(screen.getByRole('button', {name: /^send to live$/i}));

        await waitFor(() => expect(props.onConfirm).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    });

    it('shows loading state and disables buttons while submitting', async () => {
        const user = setupUser();
        let resolveConfirm!: () => void;
        const onConfirm = jest.fn(() => new Promise<void>((resolve) => {
            resolveConfirm = resolve;
        }));
        const props = createProps({onConfirm});
        renderWithMantine(<SendToLiveConfirmationDialog {...props} />);

        await user.click(screen.getByRole('button', {name: /^send to live$/i}));

        expect(screen.getByRole('button', {name: /sending/i})).toBeDisabled();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeDisabled();

        resolveConfirm();
        await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    });

    it('still calls onClose if onConfirm rejects', async () => {
        const user = setupUser();
        const onConfirm = jest.fn().mockRejectedValue(new Error('api failed'));
        const props = createProps({onConfirm});
        renderWithMantine(<SendToLiveConfirmationDialog {...props} />);

        await user.click(screen.getByRole('button', {name: /^send to live$/i}));

        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
