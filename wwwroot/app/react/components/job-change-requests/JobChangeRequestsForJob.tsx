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
import type {SxProps, Theme} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import EditIcon from '@mui/icons-material/Edit';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import {jobChangeRequestApi, type JobChangeRequestDto} from '../../services/jobChangeRequestApi';
import {useJobChangeRequests} from './useJobChangeRequests';
import {
    ageLevel,
    datetimeFieldSide,
    formatAddressLines,
    formatChangeRequestValueWithTz,
    formatRequestedAtTooltip,
    getFieldMeta,
    relativeAgeShort,
    type JobChangeRequestCategory,
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
    /** Pickup-side timezone text (e.g. "Pacific/Auckland") for datetime field display. Falls back to tenant TZ. */
    pickUpTimezoneText?: string;
    /** Delivery-side timezone text for `DeliverBy` field display. Falls back to tenant TZ. */
    deliveryTimezoneText?: string;
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

/**
 * Shared treatment for the small status/label chips (status, origin, awaiting,
 * overdue). Uppercasing is done in CSS — the label string stays natural case so
 * the DOM text content (and `getByText(...)` queries / screen readers) is intact.
 * Value-content chips deliberately do NOT use this, so prices/dates/addresses
 * stay readable.
 */
const labelChipSx = {
    textTransform: 'uppercase',
    fontWeight: 600,
    letterSpacing: '0.04em',
} satisfies SxProps<Theme>;

export const JobChangeRequestsForJob: React.FC<JobChangeRequestsForJobProps> = ({
    jobId,
    localPartyType = 'OwnerTenant',
    onChanged,
    onModifyRequest,
    pickUpTimezoneText,
    deliveryTimezoneText,
}) => {
    const queryClient = useQueryClient();
    const {data: rows = [], isLoading, error: queryError} = useJobChangeRequests(jobId);
    const [error, setError] = useState('');
    const [actingOn, setActingOn] = useState<number | null>(null);
    /** Row currently in "confirm reject — provide a reason" mode. */
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    /** Row currently in "confirm cancel — are you sure?" mode. */
    const [cancellingId, setCancellingId] = useState<number | null>(null);
    /** Most recently cancelled row, surfaced as an inline success banner so the
     * user gets explicit feedback (the row stays in the list with a Cancelled
     * chip, which on its own is too subtle for many dispatchers to notice). */
    const [recentlyCancelledId, setRecentlyCancelledId] = useState<number | null>(null);

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

    const handleConfirmCancel = useCallback(async (row: JobChangeRequestDto) => {
        setActingOn(row.id);
        try {
            await jobChangeRequestApi.cancel({requestId: row.id, rowVersion: row.rowVersion});
            setCancellingId(null);
            setRecentlyCancelledId(row.id);
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
                    <Typography variant="body2" sx={{
                        color: "text.secondary"
                    }}>Loading change requests…</Typography>
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
                    <Typography variant="body2" sx={{
                        color: "text.secondary"
                    }}>
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
                    onStartCancel={(id) => setCancellingId(id)}
                    onAbortCancel={() => setCancellingId(null)}
                    onConfirmCancel={handleConfirmCancel}
                    cancellingId={cancellingId}
                    recentlyCancelled={recentlyCancelledId === r.id}
                    onDismissCancelled={() => setRecentlyCancelledId(null)}
                    onModify={onModifyRequest ? handleModify : undefined}
                    pickUpTimezoneText={pickUpTimezoneText}
                    deliveryTimezoneText={deliveryTimezoneText}
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
    cancellingId: number | null;
    onStartCancel: (id: number) => void;
    onAbortCancel: () => void;
    onConfirmCancel: (row: JobChangeRequestDto) => void;
    recentlyCancelled: boolean;
    onDismissCancelled: () => void;
    onModify?: (row: JobChangeRequestDto) => void;
    pickUpTimezoneText?: string;
    deliveryTimezoneText?: string;
}

type ValueChipColor = 'default' | 'primary' | 'info';

/**
 * Per-category color for the small value chips that wrap non-address
 * "current → requested" tokens. Keeps the visual language consistent with
 * MetricCard accents on the job detail (datetime = primary, money = info).
 */
function valueChipColor(category: JobChangeRequestCategory): ValueChipColor {
    switch (category) {
        case 'datetime':
            return 'primary';
        case 'rate':
        case 'commercial':
            return 'info';
        default:
            return 'default';
    }
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
    cancellingId,
    onStartCancel,
    onAbortCancel,
    onConfirmCancel,
    recentlyCancelled,
    onDismissCancelled,
    onModify,
    pickUpTimezoneText,
    deliveryTimezoneText,
}: ChangeRequestCardProps) {
    const meta = useMemo(() => getFieldMeta(row.fieldName), [row.fieldName]);
    /** Tz for datetime-category rows: pickup side for everything except DeliverBy. */
    const fieldTimezoneText = meta.category === 'datetime'
        ? (datetimeFieldSide(row.fieldName) === 'delivery' ? deliveryTimezoneText : pickUpTimezoneText)
        : undefined;
    const fromDisplay = useMemo(
        () => formatChangeRequestValueWithTz(row.fieldName, row.currentValue, fieldTimezoneText),
        [row.fieldName, row.currentValue, fieldTimezoneText],
    );
    const toDisplay = useMemo(
        () => formatChangeRequestValueWithTz(row.fieldName, row.requestedValue, fieldTimezoneText),
        [row.fieldName, row.requestedValue, fieldTimezoneText],
    );
    const fromLines = useMemo(
        () => meta.category === 'address' ? formatAddressLines(row.currentValue) : [],
        [meta.category, row.currentValue],
    );
    const toLines = useMemo(
        () => meta.category === 'address' ? formatAddressLines(row.requestedValue) : [],
        [meta.category, row.requestedValue],
    );
    const requestedAtTooltip = useMemo(
        () => formatRequestedAtTooltip(row.requestedAt),
        [row.requestedAt],
    );
    const canApprove = row.status === 'Pending' && row.approvalPartyType === localPartyType;
    const isOwnPending = row.status === 'Pending' && row.origin === 'Local';
    const isRejecting = rejectingId === row.id;
    const isCancelling = cancellingId === row.id;
    const aging = row.status === 'Pending' ? ageLevel(row.requestedAt) : 'fresh';
    const status = statusColor(row.status);
    const isAddress = meta.category === 'address';
    const chipColor = valueChipColor(meta.category);
    /** Requested-side label color follows the row's lifecycle so the user can
     *  see at a glance whether the value is still in flight (warning), already
     *  approved (info), or live (success). */
    const requestedAccent: 'warning' | 'success' | 'info' | 'error' | 'default' =
        row.status === 'Pending' ? 'warning'
            : row.status === 'Applied' ? 'success'
            : row.status === 'Approved' ? 'info'
            : (row.status === 'Rejected' || row.status === 'Cancelled') ? 'error'
            : 'default';

    return (
        <Card variant="outlined" sx={(theme) => ({
            borderLeft: 3,
            borderLeftColor: `${status}.main`,
            bgcolor: row.status === 'Pending'
                ? alpha(theme.palette.warning.main, 0.04)
                : 'background.paper',
        })}>
            <CardContent sx={{py: 1.5, '&:last-child': {pb: 1.5}}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap'}}>
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
                        color={status}
                        variant="filled"
                        sx={labelChipSx}
                    />
                    <Box sx={{ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5}}>
                        {row.status === 'Pending' && aging === 'overdue' && (
                            <Chip
                                size="small"
                                color="error"
                                label="Overdue"
                                variant="filled"
                                sx={labelChipSx}
                            />
                        )}
                        <Tooltip title={requestedAtTooltip}>
                            <Typography variant="caption" sx={{
                                color: "text.secondary"
                            }}>
                                {relativeAgeShort(row.requestedAt)} ago
                            </Typography>
                        </Tooltip>
                    </Box>
                </Box>

                {isAddress ? (
                    <AddressDelta
                        fromLines={fromLines}
                        toLines={toLines}
                        fromFallback={fromDisplay}
                        toFallback={toDisplay}
                        requestedAccent={requestedAccent}
                    />
                ) : (
                    <ValueDelta
                        fromDisplay={fromDisplay}
                        toDisplay={toDisplay}
                        chipColor={chipColor}
                        requestedAccent={requestedAccent}
                    />
                )}

                {row.reason && (
                    <Box sx={{
                        mt: 1.5, p: 1.5,
                        border: '1.5px solid', borderColor: 'grey.200', borderRadius: 2, bgcolor: 'grey.50',
                        display: 'flex', gap: 1, alignItems: 'flex-start',
                    }}>
                        <FormatQuoteIcon sx={{fontSize: 18, color: 'text.disabled', transform: 'scaleX(-1)', mt: '1px'}}/>
                        <Box sx={{minWidth: 0}}>
                            <Typography sx={{
                                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.08em', color: 'text.secondary', mb: 0.25,
                            }}>
                                Reason
                            </Typography>
                            <Typography variant="body2" sx={{color: 'text.primary', whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                                {row.reason}
                            </Typography>
                        </Box>
                    </Box>
                )}

                {recentlyCancelled && (
                    <Alert
                        severity="success"
                        onClose={onDismissCancelled}
                        sx={{mt: 1, py: 0.25}}
                    >
                        Change request cancelled. {row.approvalPartyType === localPartyType ? '' : 'The partner has been notified.'}
                    </Alert>
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
                ) : isCancelling ? (
                    <Box sx={{mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1}}>
                        <Typography variant="body2" sx={{
                            color: "text.secondary"
                        }}>
                            Cancel this change request? The partner will be notified the request was retracted.
                        </Typography>
                        <Box sx={{display: 'flex', gap: 1, justifyContent: 'flex-end'}}>
                            <Button
                                size="small"
                                onClick={onAbortCancel}
                                disabled={actingOn !== null}
                            >
                                Keep request
                            </Button>
                            <Button
                                size="small"
                                variant="contained"
                                color="warning"
                                onClick={() => onConfirmCancel(row)}
                                disabled={actingOn !== null}
                                startIcon={actingOn === row.id ? <CircularProgress size={14} color="inherit"/> : <CancelOutlinedIcon/>}
                            >
                                Confirm cancel
                            </Button>
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap'}}>
                        <Chip
                            size="small"
                            label={row.origin === 'Local' ? 'You requested' : 'Partner requested'}
                            color={row.origin === 'Local' ? 'primary' : 'secondary'}
                            variant="filled"
                            sx={labelChipSx}
                        />
                        <Box sx={{ml: 'auto', display: 'flex', gap: 1, alignItems: 'center'}}>
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
                                        icon={<HourglassEmptyIcon/>}
                                        label="Awaiting partner"
                                        color="info"
                                        variant="filled"
                                        sx={labelChipSx}
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
                                        onClick={() => onStartCancel(row.id)}
                                        disabled={actingOn !== null}
                                    >
                                        Cancel
                                    </Button>
                                </>
                            )}
                            {row.status === 'Pending' && !canApprove && !isOwnPending && (
                                <Chip
                                    size="small"
                                    icon={<HourglassEmptyIcon/>}
                                    label="Awaiting partner"
                                    color="info"
                                    variant="filled"
                                    sx={labelChipSx}
                                />
                            )}
                        </Box>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

interface AddressDeltaProps {
    fromLines: string[];
    toLines: string[];
    fromFallback: string;
    toFallback: string;
    requestedAccent: 'warning' | 'success' | 'info' | 'error' | 'default';
}

/**
 * Side-by-side address comparison. Each side is its own outlined Card with
 * an overline label, mirroring the AddressSection layout on the job detail.
 * Collapses to a stacked layout on narrow screens with the arrow rotating
 * to point downward.
 */
function AddressDelta({fromLines, toLines, fromFallback, toFallback, requestedAccent}: AddressDeltaProps) {
    const renderLines = (lines: string[], fallback: string) => {
        const display = lines.length > 0 ? lines : [fallback];
        return display.map((line, idx) => (
            <Typography
                key={`${idx}-${line}`}
                variant="body2"
                sx={{lineHeight: 1.4, wordBreak: 'break-word'}}
            >
                {line}
            </Typography>
        ));
    };

    const requestedLabelColor = requestedAccent === 'default' ? 'text.secondary' : `${requestedAccent}.main`;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: {xs: 'column', sm: 'row'},
                alignItems: 'stretch',
                gap: 1,
                mb: 0.5,
            }}
        >
            <Box
                aria-label="Current address"
                sx={{
                    flex: 1,
                    minWidth: 0,
                    p: 1.25,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                }}
            >
                <Typography
                    variant="overline"
                    sx={{
                        display: 'block',
                        color: 'text.secondary',
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        lineHeight: 1.4,
                        mb: 0.5,
                    }}
                >
                    Current
                </Typography>
                {renderLines(fromLines, fromFallback)}
            </Box>
            <Box
                aria-hidden
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'text.secondary',
                    fontSize: '1.1rem',
                    px: {xs: 0, sm: 0.5},
                    py: {xs: 0.25, sm: 0},
                    transform: {xs: 'rotate(90deg)', sm: 'none'},
                }}
            >
                →
            </Box>
            <Box
                aria-label="Requested address"
                sx={(theme) => ({
                    flex: 1,
                    minWidth: 0,
                    p: 1.25,
                    border: 1,
                    borderColor: requestedAccent === 'default'
                        ? 'divider'
                        : alpha(theme.palette[requestedAccent].main, 0.5),
                    borderRadius: 2,
                    bgcolor: requestedAccent === 'default'
                        ? 'background.paper'
                        : alpha(theme.palette[requestedAccent].main, 0.06),
                })}
            >
                <Typography
                    variant="overline"
                    sx={{
                        display: 'block',
                        color: requestedLabelColor,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        lineHeight: 1.4,
                        mb: 0.5,
                    }}
                >
                    Requested
                </Typography>
                {renderLines(toLines, toFallback)}
            </Box>
        </Box>
    );
}

interface ValueDeltaProps {
    fromDisplay: string;
    toDisplay: string;
    chipColor: ValueChipColor;
    requestedAccent: 'warning' | 'success' | 'info' | 'error' | 'default';
}

/**
 * Inline "current → requested" pair for short, atomic values (prices,
 * dates, flags, refs). Each side is wrapped in a small MUI Chip so it
 * reads as a first-class token instead of bare monospace text.
 */
function ValueDelta({fromDisplay, toDisplay, chipColor, requestedAccent}: ValueDeltaProps) {
    /** Requested-side picks up the row's lifecycle accent (Pending = warning,
     *  Applied = success, etc.) so the user can see at a glance whether the
     *  proposed value is in flight or live. Pre-Pending the category color
     *  drives the chip; once a decision is rendered we follow lifecycle. */
    const requestedColor: ValueChipColor | 'warning' | 'success' | 'error' =
        requestedAccent === 'default' ? chipColor : requestedAccent;
    return (
        <Box sx={{mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap'}}>
            <Chip
                size="small"
                color="default"
                variant="filled"
                label={fromDisplay}
                sx={{maxWidth: '100%', '& .MuiChip-label': {whiteSpace: 'normal'}}}
            />
            <Typography component="span" sx={{color: 'text.secondary'}}>→</Typography>
            <Chip
                size="small"
                color={requestedColor}
                variant="filled"
                label={toDisplay}
                sx={{
                    maxWidth: '100%',
                    fontWeight: 600,
                    '& .MuiChip-label': {whiteSpace: 'normal'},
                }}
            />
        </Box>
    );
}
