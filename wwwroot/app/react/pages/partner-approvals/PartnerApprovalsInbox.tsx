/**
 * Partner Approvals Inbox — central queue of Pending change requests
 * the local tenant must review. Closes the biggest UX gap in the partner-job
 * change-request flow: today, an approver only sees requests by happening
 * to open the relevant job's Details panel.
 *
 * Pulls from /JobChangeRequest/PendingForApproval, which returns Pending +
 * Origin=Peer rows joined with job + client context. Rows are grouped by
 * customer (or partner if available) for at-a-glance scanning, sorted by
 * age within each group with overdue items first.
 *
 * Approve fires immediately. Reject opens an inline reason input (the same
 * pattern used by JobChangeRequestsForJob). Clicking a row navigates the
 * surrounding AngularJS shell to the job — implemented via the global
 * job-search helper the rest of the app already uses.
 */

import React, {useMemo, useState, useCallback} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import HandshakeIcon from '@mui/icons-material/Handshake';
import {alpha} from '@mui/material/styles';
import {useApproverInbox} from './useApproverInbox';
import {jobChangeRequestApi, type JobChangeRequestInboxItem} from '../../services/jobChangeRequestApi';
import {
    ageLevel,
    formatChangeRequestValue,
    getFieldMeta,
    relativeAgeShort,
} from '../../components/job-change-requests/jobChangeRequestFormatting';
import {headerChipSx, headerChromeSx, headerOnColor, headerOverlayColor} from '../../components/dialogs/shared/styles';

export interface PartnerApprovalsInboxProps {
    /** Optional callback fired when the user clicks "View job" on a row. */
    onOpenJob?: (jobId: number, jobNo: string) => void;
}

export const PartnerApprovalsInbox: React.FC<PartnerApprovalsInboxProps> = ({onOpenJob}) => {
    const {data: items = [], isLoading, error, refetch, isFetching} = useApproverInbox();
    const queryClient = useQueryClient();
    const [actingOn, setActingOn] = useState<number | null>(null);
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [actionError, setActionError] = useState('');

    /** Sorted oldest-first inside each customer group — overdue rises to the top. */
    const grouped = useMemo(() => groupByCustomer(items), [items]);

    const invalidate = useCallback(() => {
        return Promise.all([
            queryClient.invalidateQueries({queryKey: ['jobChangeRequests', 'inbox']}),
            queryClient.invalidateQueries({queryKey: ['jobChangeRequests']}),
        ]);
    }, [queryClient]);

    const handleApprove = useCallback(async (item: JobChangeRequestInboxItem) => {
        setActingOn(item.request.id);
        setActionError('');
        try {
            await jobChangeRequestApi.approve({
                requestId: item.request.id,
                rowVersion: item.request.rowVersion,
            });
            await invalidate();
        } catch (e) {
            setActionError((e as {message?: string})?.message ?? 'Approve failed');
        } finally {
            setActingOn(null);
        }
    }, [invalidate]);

    const handleConfirmReject = useCallback(async (item: JobChangeRequestInboxItem) => {
        setActingOn(item.request.id);
        setActionError('');
        try {
            await jobChangeRequestApi.reject({
                requestId: item.request.id,
                rowVersion: item.request.rowVersion,
                reason: rejectReason.trim() || undefined,
            });
            setRejectingId(null);
            setRejectReason('');
            await invalidate();
        } catch (e) {
            setActionError((e as {message?: string})?.message ?? 'Reject failed');
        } finally {
            setActingOn(null);
        }
    }, [rejectReason, invalidate]);

    // Header subtitle adapts to current load state, queue size, and whether
    // a background refetch is in flight — same pattern the sibling dialogs
    // use to give the user one line of "what's happening here" context.
    const subtitle = isLoading
        ? 'Loading partner change requests…'
        : items.length === 0
            ? 'All clear · nothing to review'
            : `${items.length} change request${items.length === 1 ? '' : 's'} awaiting your decision${isFetching ? ' · refreshing…' : ''}`;

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, bgcolor: 'background.default'}}>
            {/* Gradient header — mirrors the dialog / SideNav pattern so the
                drawer reads as a first-class surface in the app shell rather
                than a bolted-on panel. */}
            <Box
                sx={(theme) => ({
                    ...headerChromeSx(theme),
                    flexShrink: 0,
                })}
            >
                <Box sx={(theme) => headerChipSx(theme)}>
                    <HandshakeIcon/>
                </Box>
                <Box sx={{flex: 1, minWidth: 0}}>
                    <Typography variant="h6" noWrap sx={{
                        fontWeight: 600
                    }}>
                        Partner Approvals
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}} noWrap>
                        {subtitle}
                    </Typography>
                </Box>
                <Tooltip title="Refresh now">
                    <span>
                        <IconButton
                            onClick={() => refetch()}
                            disabled={isFetching}
                            sx={(theme) => ({
                                color: headerOnColor(theme),
                                '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)},
                                '&.Mui-disabled': {color: headerOverlayColor(theme, 0.4)},
                            })}
                        >
                            <RefreshIcon/>
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>
            {/* Scrollable list area */}
            <Box sx={{flex: 1, overflow: 'auto', p: 2}}>
                {isLoading && (
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6}}>
                        <CircularProgress size={20} sx={{mr: 1.5}}/>
                        <Typography variant="body2" sx={{
                            color: "text.secondary"
                        }}>Loading approvals…</Typography>
                    </Box>
                )}
                {actionError && (
                    <Alert severity="error" sx={{mb: 2}} onClose={() => setActionError('')}>
                        {actionError}
                    </Alert>
                )}
                {error && (
                    <Alert severity="error" sx={{mb: 2}}>
                        Could not load approvals: {(error as {message?: string}).message}
                    </Alert>
                )}

                {!isLoading && items.length === 0 && !error ? (
                    <EmptyState/>
                ) : !isLoading ? (
                    <Stack spacing={3}>
                        {grouped.map(group => (
                            <Box key={group.key}>
                                <Box sx={{display: 'flex', alignItems: 'baseline', mb: 1, gap: 1}}>
                                    <Typography variant="overline" sx={{letterSpacing: 1, fontWeight: 600}}>
                                        {group.label}
                                    </Typography>
                                    <Typography variant="caption" sx={{
                                        color: "text.secondary"
                                    }}>
                                        {group.items.length} request{group.items.length === 1 ? '' : 's'}
                                    </Typography>
                                </Box>
                                <Stack spacing={1.25}>
                                    {group.items.map(item => (
                                        <InboxRow
                                            key={item.request.id}
                                            item={item}
                                            actingOn={actingOn}
                                            isRejecting={rejectingId === item.request.id}
                                            rejectReason={rejectReason}
                                            onStartReject={() => { setRejectingId(item.request.id); setRejectReason(''); }}
                                            onCancelReject={() => { setRejectingId(null); setRejectReason(''); }}
                                            onChangeRejectReason={setRejectReason}
                                            onConfirmReject={() => handleConfirmReject(item)}
                                            onApprove={() => handleApprove(item)}
                                            onOpenJob={onOpenJob}
                                        />
                                    ))}
                                </Stack>
                            </Box>
                        ))}
                    </Stack>
                ) : null}
            </Box>
        </Box>
    );
};

// ── Empty state ──────────────────────────────────────────────────────

function EmptyState() {
    return (
        <Box sx={{
            textAlign: 'center',
            py: 8,
            color: 'text.secondary',
        }}>
            <CheckCircleOutlineIcon sx={{fontSize: 64, opacity: 0.4, mb: 1}}/>
            <Typography variant="subtitle1" sx={{fontWeight: 500}}>
                Inbox zero
            </Typography>
            <Typography variant="caption" sx={{display: 'block', mt: 0.5}}>
                No partner change requests are awaiting your review.
            </Typography>
        </Box>
    );
}

// ── Row component ────────────────────────────────────────────────────

interface InboxRowProps {
    item: JobChangeRequestInboxItem;
    actingOn: number | null;
    isRejecting: boolean;
    rejectReason: string;
    onStartReject: () => void;
    onCancelReject: () => void;
    onChangeRejectReason: (value: string) => void;
    onConfirmReject: () => void;
    onApprove: () => void;
    onOpenJob?: (jobId: number, jobNo: string) => void;
}

function InboxRow({
    item,
    actingOn,
    isRejecting,
    rejectReason,
    onStartReject,
    onCancelReject,
    onChangeRejectReason,
    onConfirmReject,
    onApprove,
    onOpenJob,
}: InboxRowProps) {
    const {request, jobNo} = item;
    const meta = useMemo(() => getFieldMeta(request.fieldName), [request.fieldName]);
    const fromDisplay = formatChangeRequestValue(request.fieldName, request.currentValue);
    const toDisplay = formatChangeRequestValue(request.fieldName, request.requestedValue);
    const level = ageLevel(request.requestedAt);
    const age = relativeAgeShort(request.requestedAt);
    const disabled = actingOn !== null;

    return (
        <Card variant="outlined" sx={(theme) => ({
            borderLeft: 3,
            borderLeftColor: level === 'overdue' ? 'error.main' : level === 'stale' ? 'warning.main' : 'info.main',
            bgcolor: level === 'overdue'
                ? alpha(theme.palette.error.main, 0.04)
                : level === 'stale'
                    ? alpha(theme.palette.warning.main, 0.04)
                    : 'background.paper',
        })}>
            <CardContent sx={{py: 1.5, '&:last-child': {pb: 1.5}}}>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap'}}>
                    <Tooltip title={`Open job ${jobNo}`}>
                        <Button
                            size="small"
                            variant="text"
                            endIcon={<OpenInNewIcon sx={{fontSize: 14}}/>}
                            onClick={() => onOpenJob?.(request.jobId, jobNo)}
                            sx={{textTransform: 'none', minWidth: 0, fontWeight: 700, py: 0.25, px: 0.5}}
                        >
                            {jobNo}
                        </Button>
                    </Tooltip>
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>·</Typography>
                    <Typography
                        component="span"
                        sx={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 20, height: 20, borderRadius: '50%', bgcolor: 'action.hover',
                            fontSize: '0.8rem',
                        }}
                    >
                        {meta.glyph}
                    </Typography>
                    <Typography variant="subtitle2" sx={{fontWeight: 600}}>{meta.label}</Typography>
                    {request.requiresCommercialRefresh && (
                        <Tooltip title="Triggers a price re-rate when approved">
                            <Chip size="small" label="re-rates" color="warning"/>
                        </Tooltip>
                    )}
                    <Box sx={{ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5}}>
                        {level === 'overdue' && <Chip size="small" color="error" label="Overdue"/>}
                        {level === 'stale' && <Chip size="small" color="warning" label="Review soon"/>}
                        <Tooltip title={new Date(request.requestedAt).toLocaleString()}>
                            <Typography variant="caption" sx={{
                                color: "text.secondary"
                            }}>{age} ago</Typography>
                        </Tooltip>
                    </Box>
                </Box>

                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexWrap: 'wrap'}}>
                    <Typography variant="caption" sx={{
                        color: "text.secondary"
                    }}>From</Typography>
                    <Typography component="span" sx={{fontFamily: 'monospace', fontSize: '0.85rem'}}>
                        {fromDisplay}
                    </Typography>
                    <Typography component="span" sx={{mx: 0.5, color: 'text.secondary'}}>→</Typography>
                    <Typography component="span" sx={{fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem'}}>
                        {toDisplay}
                    </Typography>
                </Box>

                {request.reason && (
                    <Typography
                        variant="caption"
                        sx={{
                            color: "text.secondary",
                            display: 'block',
                            mt: 0.5,
                            fontStyle: 'italic'
                        }}>
                        “{request.reason}”
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
                            disabled={disabled}
                            helperText="Shared with the partner so they know why"
                        />
                        <Box sx={{display: 'flex', gap: 1, justifyContent: 'flex-end'}}>
                            <Button size="small" onClick={onCancelReject} disabled={disabled}>Back</Button>
                            <Button
                                size="small"
                                variant="contained"
                                color="error"
                                startIcon={<HighlightOffIcon/>}
                                onClick={onConfirmReject}
                                disabled={disabled}
                            >
                                Confirm reject
                            </Button>
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1}}>
                        <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={onStartReject}
                            disabled={disabled}
                        >
                            Reject
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<CheckCircleOutlineIcon/>}
                            onClick={onApprove}
                            disabled={disabled}
                        >
                            Approve
                        </Button>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

// ── Grouping ─────────────────────────────────────────────────────────

interface InboxGroup {
    key: string;
    label: string;
    items: JobChangeRequestInboxItem[];
}

function groupByCustomer(items: JobChangeRequestInboxItem[]): InboxGroup[] {
    const byKey = new Map<string, InboxGroup>();
    for (const item of items) {
        const key = item.clientName ?? '__no_customer__';
        const label = item.clientName ?? 'Unassigned customer';
        let group = byKey.get(key);
        if (!group) {
            group = {key, label, items: []};
            byKey.set(key, group);
        }
        group.items.push(item);
    }
    // Inside each group: overdue first, then by age desc.
    for (const group of byKey.values()) {
        group.items.sort((a, b) =>
            new Date(a.request.requestedAt).getTime() - new Date(b.request.requestedAt).getTime(),
        );
    }
    // Across groups: customers with overdue items first, then alphabetical.
    return Array.from(byKey.values()).sort((a, b) => {
        const aOverdue = a.items.some(i => ageLevel(i.request.requestedAt) === 'overdue');
        const bOverdue = b.items.some(i => ageLevel(i.request.requestedAt) === 'overdue');
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        return a.label.localeCompare(b.label);
    });
}
