import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {SendToLiveConfirmationDialog} from './SendToLiveConfirmationDialog';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const createProps = (overrides: Partial<React.ComponentProps<typeof SendToLiveConfirmationDialog>> = {}) => ({
    open: true,
    jobNo: 'JOB-001',
    onClose: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

describe('SendToLiveConfirmationDialog', () => {
    it('renders header, info paper, and footer buttons when open', () => {
        renderWithTheme(<SendToLiveConfirmationDialog {...createProps()} />);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: /send to live/i})).toBeInTheDocument();
        expect(screen.getByText(/Release bulk job JOB-001 to the live dispatch screen/)).toBeInTheDocument();
        expect(screen.getByText(/will be released and become visible/)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /^send to live$/i})).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        renderWithTheme(<SendToLiveConfirmationDialog {...createProps({open: false})} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', async () => {
        const user = userEvent.setup();
        const props = createProps();
        renderWithTheme(<SendToLiveConfirmationDialog {...props} />);

        await user.click(screen.getByRole('button', {name: /cancel/i}));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).not.toHaveBeenCalled();
    });

    it('calls onClose when the close icon is clicked', async () => {
        const user = userEvent.setup();
        const props = createProps();
        renderWithTheme(<SendToLiveConfirmationDialog {...props} />);

        await user.click(screen.getByRole('button', {name: /close dialog/i}));
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm then onClose when Send to Live is clicked', async () => {
        const user = userEvent.setup();
        const props = createProps();
        renderWithTheme(<SendToLiveConfirmationDialog {...props} />);

        await user.click(screen.getByRole('button', {name: /^send to live$/i}));

        await waitFor(() => expect(props.onConfirm).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    });

    it('shows loading state and disables buttons while submitting', async () => {
        const user = userEvent.setup();
        let resolveConfirm!: () => void;
        const onConfirm = jest.fn(() => new Promise<void>((resolve) => {
            resolveConfirm = resolve;
        }));
        const props = createProps({onConfirm});
        renderWithTheme(<SendToLiveConfirmationDialog {...props} />);

        await user.click(screen.getByRole('button', {name: /^send to live$/i}));

        expect(screen.getByRole('button', {name: /sending/i})).toBeDisabled();
        expect(screen.getByRole('button', {name: /cancel/i})).toBeDisabled();

        resolveConfirm();
        await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    });

    it('still calls onClose if onConfirm rejects', async () => {
        const user = userEvent.setup();
        const onConfirm = jest.fn().mockRejectedValue(new Error('api failed'));
        const props = createProps({onConfirm});
        renderWithTheme(<SendToLiveConfirmationDialog {...props} />);

        await user.click(screen.getByRole('button', {name: /^send to live$/i}));

        await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
