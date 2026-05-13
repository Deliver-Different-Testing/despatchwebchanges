/** @jest-environment jest-environment-jsdom */
/**
 * JobChangeRequestDialog Tests
 */

import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {JobChangeRequestDialog, JobChangeRequestDialogProps} from './JobChangeRequestDialog';
import {renderWithTheme} from '../../../__testUtils__';
import {jobChangeRequestApi} from '../../../services/jobChangeRequestApi';

jest.mock('../../../services/jobChangeRequestApi', () => ({
    jobChangeRequestApi: {
        create: jest.fn(),
    },
}));

const mockCreate = jobChangeRequestApi.create as jest.Mock;

function renderDialog(overrides: Partial<JobChangeRequestDialogProps> = {}) {
    const defaultProps: JobChangeRequestDialogProps = {
        open: true,
        jobId: 42,
        jobNo: 'JOB-100',
        onClose: jest.fn(),
        onSubmitted: jest.fn(),
        ...overrides,
    };

    renderWithTheme(<JobChangeRequestDialog {...defaultProps} />);
    return defaultProps;
}

describe('JobChangeRequestDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows the job number in the header', () => {
        renderDialog();
        expect(screen.getByText(/JOB-100/)).toBeInTheDocument();
    });

    it('validates that a requested value is provided', async () => {
        const user = userEvent.setup();
        renderDialog();

        await user.click(screen.getByRole('button', {name: /Submit/}));

        expect(screen.getByText(/Enter the requested value/)).toBeInTheDocument();
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('submits create with the selected field and value', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValueOnce({
            success: true,
            request: {status: 'Pending'},
        });

        renderDialog();

        await user.type(screen.getByLabelText(/Requested value/), 'Please leave at reception');
        await user.click(screen.getByRole('button', {name: /Submit/}));

        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledWith({
                jobId: 42,
                fieldName: 'Notes',
                requestedValue: 'Please leave at reception',
                reason: undefined,
            });
        });
    });

    it('surfaces backend error message', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValueOnce({
            success: false,
            message: 'A pending request for Notes already exists',
        });

        renderDialog();

        await user.type(screen.getByLabelText(/Requested value/), 'x');
        await user.click(screen.getByRole('button', {name: /Submit/}));

        await waitFor(() => {
            expect(screen.getByText(/already exists/)).toBeInTheDocument();
        });
    });

    it('shows "applied" status for auto-apply fields', async () => {
        const user = userEvent.setup();
        const onSubmitted = jest.fn();
        mockCreate.mockResolvedValueOnce({
            success: true,
            request: {status: 'Applied'},
        });

        renderDialog({onSubmitted});

        await user.type(screen.getByLabelText(/Requested value/), 'auto-applied note');
        await user.click(screen.getByRole('button', {name: /Submit/}));

        await waitFor(() => {
            expect(screen.getByText(/Change applied/)).toBeInTheDocument();
        });
        expect(onSubmitted).toHaveBeenCalled();
    });

    it('shows "sent to partner" status for manual-approve fields', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValueOnce({
            success: true,
            request: {status: 'Pending'},
        });

        renderDialog();

        await user.click(screen.getByLabelText(/Field/));
        await user.click(screen.getByRole('option', {name: /Quantity/}));
        await user.type(screen.getByLabelText(/Requested value/), '5');
        await user.click(screen.getByRole('button', {name: /Submit/}));

        await waitFor(() => {
            expect(screen.getByText(/sent to partner/i)).toBeInTheDocument();
        });
    });
});
