import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteIcon from '@mui/icons-material/Delete';
import {renderWithTheme} from '../../../__testUtils__';
import {DialogShell} from './DialogShell';
import {DialogHeader} from './DialogHeader';
import {DialogFooter} from './DialogFooter';

describe('DialogShell', () => {
    it('renders children inside a dialog when open', () => {
        renderWithTheme(
            <DialogShell open onClose={jest.fn()}>
                <div>shell body</div>
            </DialogShell>,
        );
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('shell body')).toBeInTheDocument();
    });

    it('renders nothing when closed', () => {
        renderWithTheme(
            <DialogShell open={false} onClose={jest.fn()}>
                <div>shell body</div>
            </DialogShell>,
        );
        expect(screen.queryByText('shell body')).not.toBeInTheDocument();
    });
});

describe('DialogHeader', () => {
    it('renders title, subtitle and icon, and fires onClose', async () => {
        const user = userEvent.setup();
        const onClose = jest.fn();
        renderWithTheme(
            <DialogHeader
                icon={<DeleteIcon data-testid="hdr-icon"/>}
                title="Void JOB123"
                subtitle="Permanently cancel this job"
                onClose={onClose}
            />,
        );

        expect(screen.getByText('Void JOB123')).toBeInTheDocument();
        expect(screen.getByText('Permanently cancel this job')).toBeInTheDocument();
        expect(screen.getByTestId('hdr-icon')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /close dialog/i}));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('omits the subtitle when not provided', () => {
        renderWithTheme(
            <DialogHeader icon={<DeleteIcon/>} title="No subtitle" onClose={jest.fn()}/>,
        );
        expect(screen.getByText('No subtitle')).toBeInTheDocument();
    });

    it('disables the close button while closeDisabled', () => {
        renderWithTheme(
            <DialogHeader icon={<DeleteIcon/>} title="T" onClose={jest.fn()} closeDisabled/>,
        );
        expect(screen.getByRole('button', {name: /close dialog/i})).toBeDisabled();
    });
});

describe('DialogFooter', () => {
    it('fires the cancel and confirm callbacks', async () => {
        const user = userEvent.setup();
        const onCancel = jest.fn();
        const onConfirm = jest.fn();
        renderWithTheme(
            <DialogFooter onCancel={onCancel} onConfirm={onConfirm} confirmLabel="Save"/>,
        );

        await user.click(screen.getByRole('button', {name: 'Cancel'}));
        await user.click(screen.getByRole('button', {name: 'Save'}));
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('disables the confirm button when confirmDisabled', () => {
        renderWithTheme(
            <DialogFooter onCancel={jest.fn()} onConfirm={jest.fn()} confirmLabel="Save" confirmDisabled/>,
        );
        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
    });

    it('disables both buttons while submitting', () => {
        renderWithTheme(
            <DialogFooter onCancel={jest.fn()} onConfirm={jest.fn()} confirmLabel="Save" submitting/>,
        );
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
    });
});
