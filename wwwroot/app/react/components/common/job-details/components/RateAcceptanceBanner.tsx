/**
 * Mode 1 rate-acceptance banner.
 *
 * When tenant A dispatched with PricingMode = "Agreed" (operator-typed rate), B's pipeline
 * is gated from allocating a courier until the local operator confirms the rate. This
 * banner renders the acceptance prompt + Accept/Reject controls when the gate is closed,
 * and passively shows the rejection note when B has already rejected.
 *
 * Renders nothing when the gate doesn't apply (Modes 2/3 / Accepted / non-partner job).
 */
import React, {useState} from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
    acceptPartnerRate,
    getPartnerInboundRateAcceptance,
    rejectPartnerRate,
} from '../../../../services/jobListApi';
import {formatCurrency} from '../../../../utils/currencyUtils';

interface RateAcceptanceBannerProps {
    jobId: number;
}

export const RateAcceptanceBanner: React.FC<RateAcceptanceBannerProps> = ({jobId}) => {
    const queryClient = useQueryClient();
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);

    const queryKey = ['partnerInboundRateAcceptance', jobId];
    const {data: state, isLoading} = useQuery({
        queryKey,
        queryFn: () => getPartnerInboundRateAcceptance(jobId),
        // Re-query when the banner re-mounts; the cache is invalidated explicitly on
        // accept/reject so we don't need polling.
        staleTime: 30_000,
    });

    const acceptMutation = useMutation({
        mutationFn: () => acceptPartnerRate(jobId),
        onSuccess: (result) => {
            if (!result.success) {
                setActionError(result.errorMessage ?? 'Failed to accept rate.');
                return;
            }
            setActionError(null);
            void queryClient.invalidateQueries({queryKey});
        },
        onError: (err: unknown) => {
            setActionError(err instanceof Error ? err.message : 'Failed to accept rate.');
        },
    });

    const rejectMutation = useMutation({
        mutationFn: (text: string) => rejectPartnerRate(jobId, text),
        onSuccess: (result) => {
            if (!result.success) {
                setActionError(result.errorMessage ?? 'Failed to reject rate.');
                return;
            }
            setActionError(null);
            setRejectDialogOpen(false);
            setReason('');
            void queryClient.invalidateQueries({queryKey});
        },
        onError: (err: unknown) => {
            setActionError(err instanceof Error ? err.message : 'Failed to reject rate.');
        },
    });

    if (isLoading || !state) return null;

    if (state.status === 'PendingAcceptance') {
        const proposed = state.proposedAgreedRate;
        return (
            <>
                <Alert severity="warning" sx={{mb: 1}}>
                    <AlertTitle>Partner rate needs review</AlertTitle>
                    <Stack direction={{xs: 'column', sm: 'row'}} spacing={2} alignItems={{sm: 'center'}}>
                        <Typography variant="body2" sx={{flex: 1}}>
                            The partner has dispatched this job at{' '}
                            <strong>{proposed != null ? formatCurrency(proposed) : 'an unspecified rate'}</strong>.
                            Accept the rate to allocate a courier, or reject it with a note for the partner.
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <Button
                                size="small"
                                variant="contained"
                                color="success"
                                disabled={acceptMutation.isPending}
                                onClick={() => acceptMutation.mutate()}
                            >
                                {acceptMutation.isPending ? <CircularProgress size={16} color="inherit"/> : 'Accept'}
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                disabled={acceptMutation.isPending}
                                onClick={() => setRejectDialogOpen(true)}
                            >
                                Reject
                            </Button>
                        </Stack>
                    </Stack>
                    {actionError && (
                        <Typography variant="caption" color="error" sx={{display: 'block', mt: 1}}>
                            {actionError}
                        </Typography>
                    )}
                </Alert>

                <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Reject partner rate</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" sx={{mb: 2}}>
                            The partner will be notified that the rate was rejected, with the reason you supply
                            below. The job stays unactioned on your side until they re-dispatch or cancel.
                        </Typography>
                        <TextField
                            autoFocus
                            fullWidth
                            multiline
                            minRows={2}
                            label="Reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            disabled={rejectMutation.isPending}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setRejectDialogOpen(false)} disabled={rejectMutation.isPending}>
                            Cancel
                        </Button>
                        <Button
                            color="error"
                            variant="contained"
                            disabled={!reason.trim() || rejectMutation.isPending}
                            onClick={() => rejectMutation.mutate(reason.trim())}
                        >
                            {rejectMutation.isPending ? <CircularProgress size={16} color="inherit"/> : 'Reject Rate'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </>
        );
    }

    if (state.status === 'Rejected') {
        return (
            <Alert severity="error" sx={{mb: 1}}>
                <AlertTitle>Partner rate rejected</AlertTitle>
                <Typography variant="body2">
                    {state.rejectionReason ?? 'No reason supplied.'} The partner has been notified; allocate
                    only after they re-dispatch.
                </Typography>
            </Alert>
        );
    }

    // Allowed / Accepted → render nothing; the job is actionable.
    return null;
};
