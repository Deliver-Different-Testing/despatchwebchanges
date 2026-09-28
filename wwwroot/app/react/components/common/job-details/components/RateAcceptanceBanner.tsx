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
import {Alert, Box, Button, Group, Stack, Text, Textarea} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import {Ban, TriangleAlert} from 'lucide-react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {Icon} from '../../icon/Icon';
import {DialogFooter, DialogHeader, DialogShell, dialogContentBg} from '../../../dialogs/shared/mantine';
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
    const [rejectDialogOpen, {open: openRejectDialog, close: closeRejectDialog}] = useDisclosure(false);
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
            closeRejectDialog();
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
                <Alert
                    color="orange"
                    variant="light"
                    icon={<Icon lucide={TriangleAlert} size={18}/>}
                    title="Partner rate needs review"
                    mb="xs"
                >
                    <Stack gap="sm">
                        <Group align="center" gap="md" wrap="wrap">
                            <Text size="sm" style={{flex: 1, minWidth: 240}}>
                                The partner has dispatched this job at{' '}
                                <strong>{proposed != null ? formatCurrency(proposed) : 'an unspecified rate'}</strong>.
                                Accept the rate to allocate a courier, or reject it with a note for the partner.
                            </Text>
                            <Group gap="xs">
                                <Button
                                    size="xs"
                                    color="green"
                                    loading={acceptMutation.isPending}
                                    onClick={() => acceptMutation.mutate()}
                                >
                                    Accept
                                </Button>
                                <Button
                                    size="xs"
                                    variant="outline"
                                    color="red"
                                    disabled={acceptMutation.isPending}
                                    onClick={openRejectDialog}
                                >
                                    Reject
                                </Button>
                            </Group>
                        </Group>
                        {actionError && (
                            <Text size="xs" c="red">{actionError}</Text>
                        )}
                    </Stack>
                </Alert>
                <DialogShell
                    opened={rejectDialogOpen}
                    onClose={closeRejectDialog}
                    label="Reject partner rate"
                >
                    <DialogHeader
                        icon={<Icon lucide={Ban}/>}
                        title="Reject partner rate"
                        variant="error"
                        onClose={closeRejectDialog}
                        closeDisabled={rejectMutation.isPending}
                    />
                    <Box p="lg" bg={dialogContentBg}>
                        <Text size="sm" mb="md">
                            The partner will be notified that the rate was rejected, with the reason you supply
                            below. The job stays unactioned on your side until they re-dispatch or cancel.
                        </Text>
                        <Textarea
                            data-autofocus
                            label="Reason"
                            minRows={2}
                            autosize
                            value={reason}
                            onChange={(e) => setReason(e.currentTarget.value)}
                            disabled={rejectMutation.isPending}
                        />
                    </Box>
                    <DialogFooter
                        onCancel={closeRejectDialog}
                        onConfirm={() => rejectMutation.mutate(reason.trim())}
                        confirmLabel="Reject Rate"
                        confirmColor="red"
                        confirmDisabled={!reason.trim()}
                        submitting={rejectMutation.isPending}
                    />
                </DialogShell>
            </>
        );
    }

    if (state.status === 'Rejected') {
        return (
            <Alert
                color="red"
                variant="light"
                icon={<Icon lucide={Ban} size={18}/>}
                title="Partner rate rejected"
                mb="xs"
            >
                <Text size="sm">
                    {state.rejectionReason ?? 'No reason supplied.'} The partner has been notified; allocate
                    only after they re-dispatch.
                </Text>
            </Alert>
        );
    }

    // Allowed / Accepted → render nothing; the job is actionable.
    return null;
};
