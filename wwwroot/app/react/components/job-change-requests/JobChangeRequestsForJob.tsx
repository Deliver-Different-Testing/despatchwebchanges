/**
 * Job Change Requests — per-job history panel.
 *
 * Mounted inside <JobDetails/> when the job is an inter-tenant partner job.
 * Lists every <see cref="tucJobChangeRequest"/> row for the current job
 * (any status), with inline Approve / Reject when this tenant is the
 * approval party for a Pending row.
 *
 * Visual treatments and behaviours follow the partner-job UX review:
 *   - Field names and values are rendered with the shared formatter so
 *     they read as human language (no JSON blobs, no raw enum tokens).
 *   - Pending rows over 24h get an amber "Review soon" chip; over 72h
 *     an "Overdue" chip. Both pair with the existing border treatment.
 *   - Reject opens an inline reason-capture state instead of firing
 *     immediately. The reason flows back to the requester.
 *   - Requesters can Modify their own Pending rows — opens the
 *     change-request dialog preselected with the current requested
 *     value after cancelling the existing row.
 */

import React, {useState, useCallback, useMemo} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import {alpha} from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import EditIcon from '@mui/icons-material/Edit';
import {jobChangeRequestApi, type JobChangeRequestDto} from '../../services/jobChangeRequestApi';
import {useJobChangeRequests} from './useJobChangeRequests';
import {
    ageLevel,
    formatChangeRequestValue,
    getFieldMeta,
    relativeAgeShort,
} from './jobChangeRequestFormatting';

export interface JobChangeRequestsForJobProps {
    jobId: number;
    /** Local tenant identity used to gate Approve / Reject. Default "OwnerTenant". */
    localPartyType?: string;
    /** Notify parent that a row was approved or rejected — for refreshing the surrounding job-detail view. */
    onChanged?: () => void;
    /**
     * Opens the change-request dialog preselected with the supplied field +
     * current requested value. Called from the Modify action. JobDetails
     * owns the dialog state, so it wires this callback to open its own
     * <JobChangeRequestDialog/>.
     */
    onModifyRequest?: (args: {fieldName: string; requestedValue: string | null | undefined}) => void;
}

type StatusColor = 'default' | 'warning' | 'success' | 'error' | 'info';

const statusColor = (status: string): StatusColor => {
    switch (status) {
        case 'Pending':
            return 'warning';
        case 'Approved':
            return 'info';
        case 'Applied':
            return 'success';
        case 'Rejected':
        case 'Cancelled':
            return 'error';
        default:
            return 'default';
    }
};

export const JobChangeRequestsForJob: React.FC<JobChangeRequestsForJobProps> = ({
    jobId,
    localPartyType = 'OwnerTenant',
    onChanged,
    onModifyRequest,
}) => {
    const queryClient = useQueryClient();
    const {data: rows = [], isLoading, error: queryError} = useJobChangeRequests(jobId);
    const [error, setError] = useState('');
    const [actingOn, setActingOn] = useState<number | null>(null);
    /** Row currently in "confirm reject — provide a reason" mode. */
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const invalidate = useCallback(() => {
        return queryClient.invalidateQueries({queryKey: ['jobChangeRequests', jobId]});
    }, [queryClient, jobId]);

    const handleApprove = useCallback(async (row: JobChangeRequestDto) => {
        setActingOn(row.id);
        try {
            await jobChangeRequestApi.approve({requestId: row.id, rowVersion: row.rowVersion});
            await invalidate();
            onChanged?.();
        } catch (e) {
            setError((e as {message?: string})?.message ?? 'Approve failed');
        } finally {
            setActingOn(null);
        }
    }, [invalidate, onChanged]);

    const handleConfirmReject = useCallback(async (row: JobChangeRequestDto) => {
        setActingOn(row.id);
        try {
            await jobChangeRequestApi.reject({
                requestId: row.id,
                rowVersion: row.rowVersion,
                reason: rejectReason.trim() || undefined,
            });
            setRejectingId(null);
            setRejectReason('');
            await invalidate();
            onChanged?.();
        } catch (e) {
            setError((e as {message?: string})?.message ?? 'Reject failed');
        } finally {
            setActingOn(null);
        }
    }, [rejectReason, invalidate, onChanged]);

    const handleCancel = useCallback(async (row: JobChangeRequestDto) => {
        setActingOn(row.id);
        try {
            await jobChangeRequestApi.cancel({requestId: row.id, rowVersion: row.rowVersion});
            await invalidate();
            onChanged?.();
        } catch (e) {
            setError((e as {message?: string})?.message ?? 'Cancel failed');
        } finally {
            setActingOn(null);
        }
    }, [invalidate, onChanged]);

    /**
     * Modify cancels the existing Pending row, then opens the dialog
     * preseeded with the same field and the previously requested value
     * so the user can adjust without retyping. The backend's
     * "duplicate pending" guard prevents creating a new row before
     * cancellation lands, which is why we sequence them.
     */
    const handleModify = useCallback(async (row: JobChangeRequestDto) => {
        if (!onModifyRequest) return;
        setActingOn(row.id);
        try {
            await jobChangeRequestApi.cancel({requestId: row.id, rowVersion: row.rowVersion});
            await invalidate();
            onModifyRequest({fieldName: row.fieldName, requestedValue: row.requestedValue});
        } catch (e) {
            setError((e as {message?: string})?.message ?? 'Could not start modify');
        } finally {
            setActingOn(null);
        }
    }, [invalidate, onModifyRequest]);

    // Surface the query's own error (network / 5xx) alongside any action error.
    const effectiveError = error || (queryError as {message?: string} | null)?.message || '';
    const loading = isLoading;

    if (loading) {
        return (
            <Card variant="outlined">
                <CardContent sx={{display: 'flex', alignItems: 'center', gap: 1, py: 2}}>
                    <CircularProgress size={16}/>
                    <Typography variant="body2" color="text.secondary">Loading change requests…</Typography>
                </CardContent>
            </Card>
        );
    }

    if (effectiveError) {
        return <Alert severity="error">{effectiveError}</Alert>;
    }

    if (rows.length === 0) {
        return (
            <Card variant="outlined">
                <CardContent sx={{py: 2}}>
                    <Typography variant="body2" color="text.secondary">
                        No partner change requests for this job.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Stack spacing={1.5}>
            {rows.map(r => (
                <ChangeRequestCard
                    key={r.id}
                    row={r}
                    localPartyType={localPartyType}
                    actingOn={actingOn}
                    rejectingId={rejectingId}
                    rejectReason={rejectReason}
                    onStartReject={(id) => { setRejectingId(id); setRejectReason(''); }}
                    onCancelReject={() => { setRejectingId(null); setRejectReason(''); }}
                    onChangeRejectReason={setRejectReason}
                    onConfirmReject={handleConfirmReject}
                    onApprove={handleApprove}
                    onCancel={handleCancel}
                    onModify={onModifyRequest ? handleModify : undefined}
                />
            ))}
        </Stack>
    );
};

interface ChangeRequestCardProps {
    row: JobChangeRequestDto;
    localPartyType: string;
    actingOn: number | null;
    rejectingId: number | null;
    rejectReason: string;
    onStartReject: (id: number) => void;
    onCancelReject: () => void;
    onChangeRejectReason: (value: string) => void;
    onConfirmReject: (row: JobChangeRequestDto) => void;
    onApprove: (row: JobChangeRequestDto) => void;
    onCancel: (row: JobChangeRequestDto) => void;
    onModify?: (row: JobChangeRequestDto) => void;
}

function ChangeRequestCard({
    row,
    localPartyType,
    actingOn,
    rejectingId,
    rejectReason,
    onStartReject,
    onCancelReject,
    onChangeRejectReason,
    onConfirmReject,
    onApprove,
    onCancel,
    onModify,
}: ChangeRequestCardProps) {
    const meta = useMemo(() => getFieldMeta(row.fieldName), [row.fieldName]);
    const fromDisplay = useMemo(
        () => formatChangeRequestValue(row.fieldName, row.currentValue),
        [row.fieldName, row.currentValue],
    );
    const toDisplay = useMemo(
        () => formatChangeRequestValue(row.fieldName, row.requestedValue),
        [row.fieldName, row.requestedValue],
    );
    const canApprove = row.status === 'Pending' && row.approvalPartyType === localPartyType;
    const isOwnPending = row.status === 'Pending' && row.origin === 'Local';
    const isRejecting = rejectingId === row.id;
    const aging = row.status === 'Pending' ? ageLevel(row.requestedAt) : 'fresh';

    return (
        <Card variant="outlined" sx={(theme) => ({
            borderLeft: 3,
            borderLeftColor: `${statusColor(row.status)}.main`,
            bgcolor: row.status === 'Pending'
                ? alpha(theme.palette.warning.main, 0.04)
                : 'background.paper',
        })}>
            <CardContent sx={{py: 1.5, '&:last-child': {pb: 1.5}}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
                    <Typography
                        component="span"
                        sx={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                             width: 22, height: 22, borderRadius: '50%', bgcolor: 'action.hover',
                             fontSize: '0.85rem', flexShrink: 0}}
                    >
                        {meta.glyph}
                    </Typography>
                    <Typography variant="subtitle2" sx={{fontWeight: 600}}>
                        {meta.label}
                    </Typography>
                    <Chip
                        label={row.status}
                        size="small"
                        color={statusColor(row.status)}
                        variant={row.status === 'Pending' ? 'filled' : 'outlined'}
                    />
                    {row.requiresCommercialRefresh && (
                        <Tooltip title="Triggers a price re-rate when applied">
                            <Chip size="small" label="re-rates" color="warning" variant="outlined"/>
                        </Tooltip>
                    )}
                    <Box sx={{ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5}}>
                        {row.status === 'Pending' && aging !== 'fresh' && (
                            <Chip
                                size="small"
                                color={aging === 'overdue' ? 'error' : 'warning'}
                                label={aging === 'overdue' ? 'Overdue' : 'Review soon'}
                                variant="filled"
                            />
                        )}
                        <Tooltip title={new Date(row.requestedAt).toLocaleString()}>
                            <Typography variant="caption" color="text.secondary">
                                {relativeAgeShort(row.requestedAt)} ago
                            </Typography>
                        </Tooltip>
                    </Box>
                </Box>

                <Box sx={{mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap'}}>
                    <Typography variant="caption" color="text.secondary">From</Typography>
                    <Typography component="span" sx={{fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-word'}}>
                        {fromDisplay}
                    </Typography>
                    <Typography component="span" sx={{color: 'text.secondary', mx: 0.5}}>→</Typography>
                    <Typography component="span" sx={{fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem', wordBreak: 'break-word'}}>
                        {toDisplay}
                    </Typography>
                </Box>

                {row.reason && (
                    <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 0.5}}>
                        “{row.reason}”
                    </Typography>
                )}

                {isRejecting ? (
                    <Box sx={{mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1}}>
                        <TextField
                            label="Reason for rejection (optional)"
                            value={rejectReason}
                            onChange={e => onChangeRejectReason(e.target.value)}
                            size="small"
                            fullWidth
                            multiline
                            minRows={2}
                            autoFocus
                            disabled={actingOn !== null}
                            helperText="Shared with the partner so they know why"
                        />
                        <Box sx={{display: 'flex', gap: 1, justifyContent: 'flex-end'}}>
                            <Button
                                size="small"
                                onClick={onCancelReject}
                                disabled={actingOn !== null}
                            >
                                Back
                            </Button>
                            <Button
                                size="small"
                                variant="contained"
                                color="error"
                                onClick={() => onConfirmReject(row)}
                                disabled={actingOn !== null}
                                startIcon={<HighlightOffIcon/>}
                            >
                                Confirm reject
                            </Button>
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap'}}>
                        <Typography variant="caption" color="text.secondary">
                            {row.origin === 'Local' ? 'You requested' : 'Partner requested'}
                        </Typography>
                        <Box sx={{ml: 'auto', display: 'flex', gap: 1}}>
                            {canApprove && (
                                <>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        color="success"
                                        onClick={() => onApprove(row)}
                                        disabled={actingOn !== null}
                                        startIcon={<CheckCircleOutlineIcon/>}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        onClick={() => onStartReject(row.id)}
                                        disabled={actingOn !== null}
                                    >
                                        Reject
                                    </Button>
                                </>
                            )}
                            {isOwnPending && !canApprove && (
                                <>
                                    <Chip
                                        size="small"
                                        label="Awaiting partner"
                                        variant="outlined"
                                    />
                                    {onModify && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => onModify(row)}
                                            disabled={actingOn !== null}
                                            startIcon={<EditIcon/>}
                                        >
                                            Modify
                                        </Button>
                                    )}
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="warning"
                                        onClick={() => onCancel(row)}
                                        disabled={actingOn !== null}
                                    >
                                        Cancel
                                    </Button>
                                </>
                            )}
                            {row.status === 'Pending' && !canApprove && !isOwnPending && (
                                <Chip size="small" label="Awaiting partner" variant="outlined"/>
                            )}
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
