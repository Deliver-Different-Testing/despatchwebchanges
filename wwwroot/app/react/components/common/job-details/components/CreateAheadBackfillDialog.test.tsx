/**
 * CreateAheadBackfillDialog Component Tests
 *
 * Covers preview loading, candidate rendering, toggle-all, and the
 * create-backfill flow (success + error). The dialog is a passive
 * consumer of recurringJobsApi so we mock the two endpoints and assert
 * the wire payload matches what the operator ticked in the checklist.
 */

import React from 'react';
import {screen, waitFor, fireEvent} from '@testing-library/react';
import {renderWithMantine} from '../../../../__testUtils__';

import {CreateAheadBackfillDialog, CreateAheadBackfillDialogProps}
    from './CreateAheadBackfillDialog';
import {
    CreateCreateAheadBackfillResult,
    PreviewCreateAheadBackfillResult,
} from '../../../../interfaces';

jest.mock('../../../../services/recurringJobsApi', () => ({
    recurringJobsApi: {
        previewCreateAheadBackfill: jest.fn(),
        createCreateAheadBackfill: jest.fn(),
    },
}));

import {recurringJobsApi} from '../../../../services/recurringJobsApi';

const mockPreview = recurringJobsApi.previewCreateAheadBackfill as jest.MockedFunction<typeof recurringJobsApi.previewCreateAheadBackfill>;
const mockCreate = recurringJobsApi.createCreateAheadBackfill as jest.MockedFunction<typeof recurringJobsApi.createCreateAheadBackfill>;

function createPreview(
    overrides?: Partial<PreviewCreateAheadBackfillResult>
): PreviewCreateAheadBackfillResult {
    return {
        candidates: [
            {serviceDate: '2024-06-17', displayLabel: 'Mon 17 Jun'},
            {serviceDate: '2024-06-18', displayLabel: 'Tue 18 Jun'},
        ],
        alreadyExistingDates: [],
        skippedDates: [],
        ...overrides,
    };
}

function createResult(
    overrides?: Partial<CreateCreateAheadBackfillResult>
): CreateCreateAheadBackfillResult {
    return {
        jobsCreated: 4,
        duplicatesSkipped: 0,
        createdDates: ['2024-06-17', '2024-06-18'],
        errors: [],
        ...overrides,
    };
}

function createProps(
    overrides?: Partial<CreateAheadBackfillDialogProps>
): CreateAheadBackfillDialogProps {
    return {
        open: true,
        jobId: 42,
        oldValue: 0,
        newValue: 2,
        onClose: jest.fn(),
        onSuccess: jest.fn(),
        showToast: jest.fn(),
        ...overrides,
    };
}

function renderDialog(props: CreateAheadBackfillDialogProps) {
    return renderWithMantine(<CreateAheadBackfillDialog {...props} />);
}

describe('CreateAheadBackfillDialog', () => {
    beforeEach(() => {
        mockPreview.mockReset();
        mockCreate.mockReset();
    });

    it('does not call the preview endpoint when closed', () => {
        mockPreview.mockResolvedValue(createPreview());
        renderDialog(createProps({open: false}));
        expect(mockPreview).not.toHaveBeenCalled();
    });

    it('does not call the preview endpoint when newValue <= oldValue', () => {
        mockPreview.mockResolvedValue(createPreview());
        renderDialog(createProps({oldValue: 3, newValue: 3}));
        expect(mockPreview).not.toHaveBeenCalled();
    });

    it('fetches the preview on open with the exact request shape', async () => {
        mockPreview.mockResolvedValue(createPreview());
        renderDialog(createProps({jobId: 42, oldValue: 0, newValue: 2}));
        await waitFor(() => {
            expect(mockPreview).toHaveBeenCalledWith({
                jobId: 42,
                oldValue: 0,
                newValue: 2,
            });
        });
    });

    it('renders candidates pre-checked so the operator can accept-all with one click', async () => {
        mockPreview.mockResolvedValue(createPreview());
        renderDialog(createProps());
        await waitFor(() => {
            expect(screen.getByText('Mon 17 Jun (2024-06-17)')).toBeInTheDocument();
        });
        expect(screen.getByText('Tue 18 Jun (2024-06-18)')).toBeInTheDocument();
        // Button label reflects the selected count.
        expect(screen.getByRole('button', {name: /Create 2 booking\(s\)/})).toBeInTheDocument();
    });

    it('toggle-all clears the selection when everything is checked, then restores it', async () => {
        mockPreview.mockResolvedValue(createPreview());
        renderDialog(createProps());
        await waitFor(() => screen.getByText('Mon 17 Jun (2024-06-17)'));
        const selectAll = screen.getByLabelText('Select all (2)');
        fireEvent.click(selectAll);
        expect(screen.getByRole('button', {name: /Create 0 booking\(s\)/})).toBeDisabled();
        fireEvent.click(selectAll);
        expect(screen.getByRole('button', {name: /Create 2 booking\(s\)/})).toBeEnabled();
    });

    it('renders the empty-candidates alert when no interim dates need backfilling', async () => {
        mockPreview.mockResolvedValue(createPreview({candidates: []}));
        renderDialog(createProps());
        await waitFor(() => {
            expect(screen.getByText(/No interim dates need backfilling/i)).toBeInTheDocument();
        });
        // With zero candidates the create button is disabled.
        expect(screen.getByRole('button', {name: /Create 0 booking\(s\)/})).toBeDisabled();
    });

    it('renders already-existing dates and skipped reasons under their sections', async () => {
        mockPreview.mockResolvedValue(createPreview({
            alreadyExistingDates: ['2024-06-19'],
            skippedDates: [{serviceDate: '2024-06-16', reason: 'Does not match recurrence pattern'}],
        }));
        renderDialog(createProps());
        await waitFor(() => screen.getByText(/Already live/i));
        expect(screen.getByText(/2024-06-19/)).toBeInTheDocument();
        expect(screen.getByText(/2024-06-16 — Does not match recurrence pattern/)).toBeInTheDocument();
    });

    it('surfaces a preview-endpoint failure as an inline alert', async () => {
        mockPreview.mockRejectedValue(new Error('Backend unavailable'));
        renderDialog(createProps());
        await waitFor(() => {
            expect(screen.getByText('Backend unavailable')).toBeInTheDocument();
        });
    });

    it('posts the operator-selected dates and fires onSuccess + toast on success', async () => {
        mockPreview.mockResolvedValue(createPreview());
        mockCreate.mockResolvedValue(createResult());
        const onSuccess = jest.fn();
        const showToast = jest.fn();
        renderDialog(createProps({jobId: 42, onSuccess, showToast}));

        await waitFor(() => screen.getByRole('button', {name: /Create 2 booking\(s\)/}));
        fireEvent.click(screen.getByRole('button', {name: /Create 2 booking\(s\)/}));

        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledWith({
                jobId: 42,
                dates: ['2024-06-17', '2024-06-18'],
            });
        });
        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalled();
        });
        expect(showToast).toHaveBeenCalledWith(
            expect.stringContaining('Created 4 job(s)'),
            'success'
        );
    });

    it('reports duplicatesSkipped in the toast when the second push races the cron', async () => {
        mockPreview.mockResolvedValue(createPreview());
        mockCreate.mockResolvedValue(createResult({jobsCreated: 2, duplicatesSkipped: 1}));
        const showToast = jest.fn();
        renderDialog(createProps({showToast}));
        await waitFor(() => screen.getByRole('button', {name: /Create 2 booking\(s\)/}));
        fireEvent.click(screen.getByRole('button', {name: /Create 2 booking\(s\)/}));
        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith(
                expect.stringContaining('Skipped 1 duplicate'),
                'success'
            );
        });
    });

    it('emits a warning-level toast when the batch had per-date errors', async () => {
        mockPreview.mockResolvedValue(createPreview());
        mockCreate.mockResolvedValue(createResult({
            jobsCreated: 2,
            createdDates: ['2024-06-17'],
            errors: [{serviceDate: '2024-06-18', message: 'Push failed'}],
        }));
        const showToast = jest.fn();
        renderDialog(createProps({showToast}));
        await waitFor(() => screen.getByRole('button', {name: /Create 2 booking\(s\)/}));
        fireEvent.click(screen.getByRole('button', {name: /Create 2 booking\(s\)/}));
        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith(
                expect.stringContaining('1 date(s) failed'),
                'warning'
            );
        });
    });

    it('surfaces a create-endpoint failure as an error toast', async () => {
        mockPreview.mockResolvedValue(createPreview());
        mockCreate.mockRejectedValue(new Error('SP crashed'));
        const showToast = jest.fn();
        renderDialog(createProps({showToast}));
        await waitFor(() => screen.getByRole('button', {name: /Create 2 booking\(s\)/}));
        fireEvent.click(screen.getByRole('button', {name: /Create 2 booking\(s\)/}));
        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith('SP crashed', 'error');
        });
    });
});
