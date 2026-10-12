import React from 'react';
import {screen} from '@testing-library/react';
import {RestoreConfirmationDialog} from './RestoreConfirmationDialog';
import {renderWithMantine} from '../../../__testUtils__';
import {setupUser} from '../../../__testUtils__/setupUser';

const defaultProps = {
    open: true,
    onConfirm: jest.fn(),
    onClose: jest.fn(),
};

const noPod = {jobsWithPodName: 0, imageCount: 0};

describe('RestoreConfirmationDialog', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('completed-job copy', () => {
        it('shows singular copy for a single completed job', () => {
            renderWithMantine(<RestoreConfirmationDialog {...defaultProps} count={1} />);
            expect(screen.getByText('Restore completed job')).toBeInTheDocument();
            expect(screen.getByText(/This job is completed\. Restoring it reopens it as a new job/i))
                .toBeInTheDocument();
        });

        it('shows plural copy with the completed count for a bulk restore', () => {
            renderWithMantine(<RestoreConfirmationDialog {...defaultProps} count={3} />);
            expect(screen.getByText('Restore completed jobs')).toBeInTheDocument();
            expect(screen.getByText(/3 of the selected jobs are completed/i)).toBeInTheDocument();
        });

        it('drops the completed wording when the dialog was opened only because of a POD', () => {
            renderWithMantine(
                <RestoreConfirmationDialog
                    {...defaultProps}
                    count={0}
                    podImpact={{jobsWithPodName: 1, podName: 'J. Smith', imageCount: 0}}
                />,
            );

            expect(screen.getByText('Restore job')).toBeInTheDocument();
            expect(screen.queryByText(/is completed/i)).not.toBeInTheDocument();
        });
    });

    describe('POD warning', () => {
        it('quotes the POD name being cleared and points at Swap POD for a single job', () => {
            renderWithMantine(
                <RestoreConfirmationDialog
                    {...defaultProps}
                    count={1}
                    podImpact={{jobsWithPodName: 1, podName: 'J. Smith', imageCount: 0}}
                />,
            );

            expect(screen.getByText(
                /This clears the POD — delivery time and name “J\. Smith”\. To move a POD to another job, use Swap POD instead\./i,
            )).toBeInTheDocument();
        });

        it('states how many jobs lose their POD for a bulk restore', () => {
            renderWithMantine(
                <RestoreConfirmationDialog
                    {...defaultProps}
                    count={4}
                    podImpact={{jobsWithPodName: 2, imageCount: 0}}
                />,
            );

            expect(screen.getByText(/clears the proof of delivery .* on 2 of the selected jobs/i))
                .toBeInTheDocument();
        });

        it('omits the warning when no job carries a POD name', () => {
            renderWithMantine(<RestoreConfirmationDialog {...defaultProps} count={1} podImpact={noPod} />);

            expect(screen.queryByText(/clears the POD/i)).not.toBeInTheDocument();
        });
    });

    describe('Swap POD', () => {
        it('offers Swap POD as an alternative to losing the POD', async () => {
            const onSwapPod = jest.fn();
            const onConfirm = jest.fn();
            const user = setupUser();
            renderWithMantine(
                <RestoreConfirmationDialog
                    {...defaultProps}
                    count={1}
                    podImpact={{jobsWithPodName: 1, podName: 'J. Smith', imageCount: 0}}
                    onSwapPod={onSwapPod}
                    onConfirm={onConfirm}
                />,
            );

            await user.click(screen.getByRole('button', {name: 'Swap POD'}));

            expect(onSwapPod).toHaveBeenCalledTimes(1);
            expect(onConfirm).not.toHaveBeenCalled();
        });

        it('omits Swap POD when the caller has no single job to swap', () => {
            renderWithMantine(<RestoreConfirmationDialog {...defaultProps} count={2} />);

            expect(screen.queryByRole('button', {name: 'Swap POD'})).not.toBeInTheDocument();
        });

        it('disables Swap POD while the restore is submitting', () => {
            renderWithMantine(
                <RestoreConfirmationDialog {...defaultProps} count={1} onSwapPod={jest.fn()} submitting />,
            );

            expect(screen.getByRole('button', {name: 'Swap POD'})).toBeDisabled();
        });
    });

    describe('captured-images opt-in', () => {
        it('hides the checkbox entirely when there are no captured images', () => {
            renderWithMantine(<RestoreConfirmationDialog {...defaultProps} count={1} podImpact={noPod} />);

            expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        });

        it('names the image count in the checkbox label when it is known', () => {
            renderWithMantine(
                <RestoreConfirmationDialog
                    {...defaultProps}
                    count={1}
                    podImpact={{jobsWithPodName: 0, imageCount: 3}}
                />,
            );

            expect(screen.getByRole('checkbox', {name: /Also remove the 3 images captured on this job/i}))
                .toBeInTheDocument();
        });

        it('falls back to generic wording when the image count is unknown', () => {
            renderWithMantine(
                <RestoreConfirmationDialog
                    {...defaultProps}
                    count={1}
                    podImpact={{jobsWithPodName: 0, imageCount: null}}
                />,
            );

            expect(screen.getByRole('checkbox', {name: /Also remove the images captured on this job/i}))
                .toBeInTheDocument();
        });

        it('leaves the checkbox off by default and confirms with false', async () => {
            const onConfirm = jest.fn();
            const user = setupUser();
            renderWithMantine(<RestoreConfirmationDialog {...defaultProps} count={1} onConfirm={onConfirm} />);

            const checkbox = screen.getByRole('checkbox', {name: /Also remove the images captured/i});
            expect(checkbox).not.toBeChecked();
            expect(screen.getByText(/Captured photos and signatures will be kept/i)).toBeInTheDocument();

            await user.click(screen.getByRole('button', {name: 'Restore'}));

            expect(onConfirm).toHaveBeenCalledTimes(1);
            expect(onConfirm).toHaveBeenCalledWith(false);
        });

        it('confirms with true when the checkbox is ticked', async () => {
            const onConfirm = jest.fn();
            const user = setupUser();
            renderWithMantine(<RestoreConfirmationDialog {...defaultProps} count={1} onConfirm={onConfirm} />);

            await user.click(screen.getByRole('checkbox', {name: /Also remove the images captured/i}));
            expect(screen.getByText(/photos and signatures will be archived and hidden/i)).toBeInTheDocument();

            await user.click(screen.getByRole('button', {name: 'Restore'}));

            expect(onConfirm).toHaveBeenCalledWith(true);
        });

        it('confirms with false when there is no checkbox to tick', async () => {
            const onConfirm = jest.fn();
            const user = setupUser();
            renderWithMantine(
                <RestoreConfirmationDialog
                    {...defaultProps}
                    count={1}
                    podImpact={noPod}
                    onConfirm={onConfirm}
                />,
            );

            await user.click(screen.getByRole('button', {name: 'Restore'}));

            expect(onConfirm).toHaveBeenCalledWith(false);
        });
    });

    it('calls onClose when Cancel is clicked', async () => {
        const onClose = jest.fn();
        const user = setupUser();
        renderWithMantine(<RestoreConfirmationDialog {...defaultProps} count={1} onClose={onClose} />);

        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('locks the dialog and shows progress while submitting', () => {
        renderWithMantine(<RestoreConfirmationDialog {...defaultProps} count={1} submitting />);

        expect(screen.getByRole('button', {name: /Restoring/})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
        expect(screen.getByLabelText('Close dialog')).toBeDisabled();
    });
});
