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
import {
    ActionIcon,
    Alert,
    Badge,
    Box,
    Button,
    Card,
    Group,
    Loader,
    Stack,
    Text,
    Textarea,
    ThemeIcon,
    Tooltip,
    alpha,
} from '@mantine/core';
import {CircleCheckBig, CircleX, ExternalLink, Handshake, RefreshCw} from 'lucide-react';
import {Icon} from '../../components/common/icon/Icon';
import {useApproverInbox} from './useApproverInbox';
import {jobChangeRequestApi} from '../../services/jobChangeRequestApi';
import {
    ageLevel,
    formatChangeRequestValue,
    getFieldMeta,
    relativeAgeShort,
} from '../../components/job-change-requests/jobChangeRequestFormatting';
import {
    dialogContentBg,
    headerChipProps,
    headerChromeStyle,
    headerOnColor,
    headerOverlayColor,
} from '../../components/dialogs/shared/mantine/styles';
import type {JobChangeRequestInboxItem} from '../../interfaces/jobChangeRequest';

export interface PartnerApprovalsInboxProps {
    /** Optional callback fired when the user clicks "View job" on a row. */
    onOpenJob?: (jobId: number, jobNo: string) => void;
}

/**
 * Age drives the row's left rule and wash. Kept as one lookup so the three
 * levels cannot drift apart between the border, the fill and the badge.
 */
const AGE_ACCENT = {
    overdue: 'red',
    stale: 'orange',
    fresh: 'blue',
} as const;

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

    const fg = headerOnColor();

    return (
        <Box
            bg={dialogContentBg}
            style={{display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0}}
        >
            {/* Solid brand header — mirrors <DialogHeader> so the drawer reads as a
                first-class surface in the app shell rather than a bolted-on panel. */}
            <Box style={{...headerChromeStyle(), flexShrink: 0}}>
                <ThemeIcon {...headerChipProps()}>
                    <Icon lucide={Handshake}/>
                </ThemeIcon>
                <Box style={{flex: 1, minWidth: 0}}>
                    <Text component="h2" m={0} fw={600} fz="lg" c={fg} truncate>
                        Partner Approvals
                    </Text>
                    <Text fz="sm" c={fg} truncate style={{opacity: 0.85}}>
                        {subtitle}
                    </Text>
                </Box>
                <Tooltip label="Refresh now">
                    <ActionIcon
                        variant="subtle"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        aria-label="Refresh now"
                        style={{
                            '--ai-color': fg,
                            '--ai-hover': headerOverlayColor(0.1),
                        } as React.CSSProperties & Record<`--${string}`, string>}
                    >
                        <Icon lucide={RefreshCw}/>
                    </ActionIcon>
                </Tooltip>
            </Box>

            {/* Scrollable list area */}
            <Box p="md" style={{flex: 1, overflow: 'auto'}}>
                {isLoading && (
                    <Group justify="center" gap="sm" py={48}>
                        <Loader size={20} aria-label="Loading approvals"/>
                        <Text size="sm" c="dimmed">Loading approvals…</Text>
                    </Group>
                )}
                {actionError && (
                    <Alert color="red" mb="md" withCloseButton onClose={() => setActionError('')}>
                        {actionError}
                    </Alert>
                )}
                {error && (
                    <Alert color="red" mb="md">
                        Could not load approvals: {(error as {message?: string}).message}
                    </Alert>
                )}

                {!isLoading && items.length === 0 && !error ? (
                    <EmptyState/>
                ) : !isLoading ? (
                    <Stack gap={24}>
                        {grouped.map(group => (
                            <Box key={group.key}>
                                <Group align="baseline" gap="xs" mb="xs">
                                    <Text tt="uppercase" fz="xs" fw={600} style={{letterSpacing: 1}}>
                                        {group.label}
                                    </Text>
                                    <Text fz="xs" c="dimmed">
                                        {group.items.length} request{group.items.length === 1 ? '' : 's'}
                                    </Text>
                                </Group>
                                <Stack gap={10}>
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
        <Stack align="center" gap={4} py={64} c="dimmed">
            <Icon lucide={CircleCheckBig} size={64} style={{opacity: 0.4}}/>
            <Text fz="md" fw={500}>
                Inbox zero
            </Text>
            <Text fz="xs">
                No partner change requests are awaiting your review.
            </Text>
        </Stack>
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
    const accent = AGE_ACCENT[level] ?? AGE_ACCENT.fresh;

    return (
        <Card
            withBorder
            p={0}
            style={{
                borderLeft: `3px solid var(--mantine-color-${accent}-6)`,
                // Fresh rows keep the card fill; aged rows take a faint wash of
                // their accent so the queue's shape reads at a glance.
                backgroundColor: level === 'fresh'
                    ? undefined
                    : alpha(`var(--mantine-color-${accent}-6)`, 0.04),
            }}
        >
            <Box px="md" py={12}>
                <Group gap="xs" mb={4} wrap="wrap">
                    <Tooltip label={`Open job ${jobNo}`}>
                        <Button
                            size="compact-xs"
                            variant="subtle"
                            fw={700}
                            rightSection={<Icon lucide={ExternalLink} size={14}/>}
                            onClick={() => onOpenJob?.(request.jobId, jobNo)}
                        >
                            {jobNo}
                        </Button>
                    </Tooltip>
                    <Text size="sm" c="dimmed">·</Text>
                    <ThemeIcon size={20} radius="xl" variant="light" color="gray">
                        <Text fz="0.8rem" component="span">{meta.glyph}</Text>
                    </ThemeIcon>
                    <Text fz="sm" fw={600}>{meta.label}</Text>
                    {request.requiresCommercialRefresh && (
                        <Tooltip label="Triggers a price re-rate when approved">
                            <Badge size="sm" color="orange" variant="light">re-rates</Badge>
                        </Tooltip>
                    )}
                    <Group gap={4} align="center" ml="auto">
                        {level === 'overdue' && <Badge size="sm" color="red" variant="light">Overdue</Badge>}
                        {level === 'stale' && <Badge size="sm" color="orange" variant="light">Review soon</Badge>}
                        <Tooltip label={new Date(request.requestedAt).toLocaleString()}>
                            <Text fz="xs" c="dimmed">{age} ago</Text>
                        </Tooltip>
                    </Group>
                </Group>

                <Group gap={4} mb={4} wrap="wrap">
                    <Text fz="xs" c="dimmed">From</Text>
                    <Text component="span" ff="monospace" fz="0.85rem">
                        {fromDisplay}
                    </Text>
                    <Text component="span" c="dimmed" mx={4}>→</Text>
                    <Text component="span" ff="monospace" fw={600} fz="0.85rem">
                        {toDisplay}
                    </Text>
                </Group>

                {request.reason && (
                    <Text fz="xs" c="dimmed" fs="italic" mt={4}>
                        “{request.reason}”
                    </Text>
                )}

                {isRejecting ? (
                    <Stack gap="xs" mt={12}>
                        <Textarea
                            label="Reason for rejection (optional)"
                            description="Shared with the partner so they know why"
                            value={rejectReason}
                            onChange={e => onChangeRejectReason(e.currentTarget.value)}
                            size="sm"
                            minRows={2}
                            autosize
                            data-autofocus
                            autoFocus
                            disabled={disabled}
                        />
                        <Group gap="xs" justify="flex-end">
                            <Button size="xs" variant="default" onClick={onCancelReject} disabled={disabled}>
                                Back
                            </Button>
                            <Button
                                size="xs"
                                color="red"
                                leftSection={<Icon lucide={CircleX} size={16}/>}
                                onClick={onConfirmReject}
                                disabled={disabled}
                            >
                                Confirm reject
                            </Button>
                        </Group>
                    </Stack>
                ) : (
                    <Group gap="xs" justify="flex-end" mt="xs">
                        <Button
                            size="xs"
                            variant="outline"
                            color="red"
                            onClick={onStartReject}
                            disabled={disabled}
                        >
                            Reject
                        </Button>
                        <Button
                            size="xs"
                            color="green"
                            leftSection={<Icon lucide={CircleCheckBig} size={16}/>}
                            onClick={onApprove}
                            disabled={disabled}
                        >
                            Approve
                        </Button>
                    </Group>
                )}
            </Box>
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
