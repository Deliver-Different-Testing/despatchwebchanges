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

import React, {useCallback, useMemo, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {
    Alert, Avatar, Badge, Box, Button, Divider, Flex, Group, Loader, Paper, Stack, Text, Textarea, Tooltip,
} from '@mantine/core';
import {CircleCheck, CircleX, Hourglass, Pencil, Quote, Ban} from 'lucide-react';
import {Icon} from '../common/icon/Icon';
import {jobChangeRequestApi} from '../../services/jobChangeRequestApi';
import {useJobChangeRequests} from './useJobChangeRequests';
import {
    ageLevel,
    datetimeFieldSide,
    formatAddressLines,
    formatChangeRequestValueWithTz,
    formatRequestedAtTooltip,
    getFieldMeta,
    type JobChangeRequestCategory,
    relativeAgeShort,
} from './jobChangeRequestFormatting';
import {ChangeRequestTriage} from './ChangeRequestTriage';
import type {JobChangeRequestDto} from '../../interfaces/jobChangeRequest';

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

/**
 * The row's lifecycle tone. Exposed on the DOM as `data-tone` wherever it drives a
 * colour, so tests (and a reader) assert the meaning rather than the palette.
 */
type StatusTone = 'pending' | 'approved' | 'applied' | 'closed' | 'neutral';

const statusTone = (status: string): StatusTone => {
    switch (status) {
        case 'Pending':
            return 'pending';
        case 'Approved':
            return 'approved';
        case 'Applied':
            return 'applied';
        case 'Rejected':
        case 'Cancelled':
            return 'closed';
        default:
            return 'neutral';
    }
};

/** Mantine colour per tone — the one place the lifecycle meets the palette. */
const toneColors: Record<StatusTone, string> = {
    pending: 'orange',
    approved: 'reflex',
    applied: 'green',
    closed: 'red',
    neutral: 'gray',
};

/**
 * Shared props for the small status/label badges (status, origin, awaiting,
 * overdue). `tt="uppercase"` is Mantine's own text-transform prop, so the label
 * string stays natural case in the DOM and `getByText(...)` / screen readers see
 * real words. Value-content badges deliberately do NOT use this, so
 * prices/dates/addresses stay readable.
 */
const labelBadgeProps = {
    size: 'sm',
    tt: 'uppercase',
    fw: 600,
} as const;

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

    if (isLoading) {
        return (
            <Paper withBorder radius="md">
                <Group gap="xs" px="md" py="md">
                    <Loader size={16}/>
                    <Text size="sm" c="dimmed">Loading change requests…</Text>
                </Group>
            </Paper>
        );
    }

    if (effectiveError) {
        return (
            <Alert color="red" variant="light" icon={<Icon lucide={CircleX} size={18}/>}>
                {effectiveError}
            </Alert>
        );
    }

    if (rows.length === 0) {
        return (
            <Paper withBorder radius="md" px="md" py="md">
                <Text size="sm" c="dimmed">
                    No partner change requests for this job.
                </Text>
            </Paper>
        );
    }

    return (
        <Stack gap="sm">
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

/**
 * Per-category colour for the small value badges that wrap non-address
 * "current → requested" tokens. Keeps the visual language consistent with
 * MetricCard accents on the job detail (datetime = brand, money = reflex).
 */
function valueBadgeColor(category: JobChangeRequestCategory): string {
    switch (category) {
        case 'datetime':
            return 'brand';
        case 'rate':
        case 'commercial':
            return 'reflex';
        default:
            return 'gray';
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
        [row.fieldName, row.currentValue],
    );
    const toDisplay = useMemo(
        () => formatChangeRequestValueWithTz(row.fieldName, row.requestedValue, fieldTimezoneText),
        [row.fieldName, row.requestedValue],
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
    const tone = statusTone(row.status);
    const toneAccent = `var(--mantine-color-${toneColors[tone]}-6)`;
    const isAddress = meta.category === 'address';
    const badgeColor = valueBadgeColor(meta.category);
    /** Requested-side accent follows the row's lifecycle so the user can see at a
     *  glance whether the value is still in flight, approved, or live. */
    const requestedTone: StatusTone = tone;

    return (
        <Paper
            withBorder
            radius="md"
            data-tone={tone}
            style={{
                borderLeftWidth: 3,
                borderLeftStyle: 'solid',
                borderLeftColor: toneAccent,
                // Pending rows carry a faint wash of their accent so they stand
                // out in the list.
                ...(tone === 'pending'
                    ? {backgroundColor: `color-mix(in srgb, ${toneAccent} 4%, transparent)`}
                    : {}),
            }}
        >
            <Box px="md" py="sm">
                <Group gap="xs" mb="xs" wrap="wrap">
                    <Avatar size={22} radius="xl" color="gray">{meta.glyph}</Avatar>
                    <Text size="sm" fw={600}>{meta.label}</Text>
                    <Badge {...labelBadgeProps} color={toneColors[tone]} data-tone={tone}>
                        {row.status}
                    </Badge>
                    <Group gap={4} ml="auto" wrap="nowrap">
                        {row.status === 'Pending' && aging === 'overdue' && (
                            <Badge {...labelBadgeProps} color="red">Overdue</Badge>
                        )}
                        <Tooltip label={requestedAtTooltip}>
                            <Text size="xs" c="dimmed">{relativeAgeShort(row.requestedAt)} ago</Text>
                        </Tooltip>
                    </Group>
                </Group>

                {isAddress ? (
                    <AddressDelta
                        fromLines={fromLines}
                        toLines={toLines}
                        fromFallback={fromDisplay}
                        toFallback={toDisplay}
                        requestedTone={requestedTone}
                    />
                ) : (
                    <ValueDelta
                        fromDisplay={fromDisplay}
                        toDisplay={toDisplay}
                        badgeColor={badgeColor}
                        requestedTone={requestedTone}
                    />
                )}

                {row.reason && (
                    <Paper
                        withBorder
                        radius="md"
                        mt="sm"
                        p="sm"
                        bg="var(--mantine-color-gray-1)"
                        style={{display: 'flex', alignItems: 'flex-start', gap: 8}}
                    >
                        <Icon
                            lucide={Quote}
                            size={18}
                            color="var(--mantine-color-dimmed)"
                            style={{transform: 'scaleX(-1)', marginTop: 1, flexShrink: 0}}
                            aria-hidden
                        />
                        <Box style={{minWidth: 0}}>
                            <Text c="dimmed" size="xs" fw={700} tt="uppercase" mb={2} style={{letterSpacing: '0.08em'}}>
                                Reason
                            </Text>
                            <Text size="sm" style={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                                {row.reason}
                            </Text>
                        </Box>
                    </Paper>
                )}

                {recentlyCancelled && (
                    <Alert
                        color="green"
                        variant="light"
                        icon={<Icon lucide={CircleCheck} size={18}/>}
                        withCloseButton
                        closeButtonLabel="Dismiss"
                        onClose={onDismissCancelled}
                        mt="xs"
                        py={2}
                    >
                        Change request cancelled. {row.approvalPartyType === localPartyType ? '' : 'The partner has been notified.'}
                    </Alert>
                )}

                {isRejecting ? (
                    <Stack gap="xs" mt="sm">
                        <Textarea
                            label="Reason for rejection (optional)"
                            value={rejectReason}
                            onChange={e => onChangeRejectReason(e.currentTarget.value)}
                            minRows={2}
                            autosize
                            data-autofocus
                            disabled={actingOn !== null}
                            description="Shared with the partner so they know why"
                        />
                        <Group gap="xs" justify="flex-end">
                            <Button
                                size="xs"
                                variant="subtle"
                                onClick={onCancelReject}
                                disabled={actingOn !== null}
                            >
                                Back
                            </Button>
                            <Button
                                size="xs"
                                color="red"
                                onClick={() => onConfirmReject(row)}
                                disabled={actingOn !== null}
                                leftSection={<Icon lucide={CircleX} size={16}/>}
                            >
                                Confirm reject
                            </Button>
                        </Group>
                    </Stack>
                ) : isCancelling ? (
                    <Stack gap="xs" mt="sm">
                        <Text size="sm" c="dimmed">
                            Cancel this change request? The partner will be notified the request was retracted.
                        </Text>
                        <Group gap="xs" justify="flex-end">
                            <Button
                                size="xs"
                                variant="subtle"
                                onClick={onAbortCancel}
                                disabled={actingOn !== null}
                            >
                                Keep request
                            </Button>
                            <Button
                                size="xs"
                                color="orange"
                                onClick={() => onConfirmCancel(row)}
                                disabled={actingOn !== null}
                                loading={actingOn === row.id}
                                leftSection={<Icon lucide={Ban} size={16}/>}
                            >
                                Confirm cancel
                            </Button>
                        </Group>
                    </Stack>
                ) : (
                    <Group gap="xs" mt="xs" wrap="wrap">
                        {canApprove && <ChangeRequestTriage requestId={row.id} jobId={row.jobId}/>}
                        <Badge
                            {...labelBadgeProps}
                            color={row.origin === 'Local' ? 'brand' : 'grape'}
                            data-origin={row.origin === 'Local' ? 'local' : 'partner'}
                        >
                            {row.origin === 'Local' ? 'You requested' : 'Partner requested'}
                        </Badge>
                        <Group gap="xs" ml="auto" wrap="nowrap">
                            {canApprove && (
                                <>
                                    <Button
                                        size="xs"
                                        color="green"
                                        onClick={() => onApprove(row)}
                                        disabled={actingOn !== null}
                                        leftSection={<Icon lucide={CircleCheck} size={16}/>}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="xs"
                                        variant="outline"
                                        color="red"
                                        onClick={() => onStartReject(row.id)}
                                        disabled={actingOn !== null}
                                    >
                                        Reject
                                    </Button>
                                </>
                            )}
                            {isOwnPending && !canApprove && (
                                <>
                                    <AwaitingPartnerBadge/>
                                    {onModify && (
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            onClick={() => onModify(row)}
                                            disabled={actingOn !== null}
                                            leftSection={<Icon lucide={Pencil} size={16}/>}
                                        >
                                            Modify
                                        </Button>
                                    )}
                                    <Button
                                        size="xs"
                                        variant="outline"
                                        color="orange"
                                        onClick={() => onStartCancel(row.id)}
                                        disabled={actingOn !== null}
                                    >
                                        Cancel
                                    </Button>
                                </>
                            )}
                            {row.status === 'Pending' && !canApprove && !isOwnPending && (
                                <AwaitingPartnerBadge/>
                            )}
                        </Group>
                    </Group>
                )}
            </Box>
        </Paper>
    );
}

/** "Awaiting partner" — shown to both parties when the other one owns the decision. */
function AwaitingPartnerBadge() {
    return (
        <Badge
            {...labelBadgeProps}
            color={toneColors.approved}
            data-tone="awaiting"
            leftSection={<Icon lucide={Hourglass} size={12}/>}
        >
            Awaiting partner
        </Badge>
    );
}

interface AddressDeltaProps {
    fromLines: string[];
    toLines: string[];
    fromFallback: string;
    toFallback: string;
    requestedTone: StatusTone;
}

/**
 * Side-by-side address comparison. Each side is its own outlined card with
 * an overline label, mirroring the AddressSection layout on the job detail.
 * Collapses to a stacked layout on narrow screens with the arrow rotating
 * to point downward.
 */
function AddressDelta({fromLines, toLines, fromFallback, toFallback, requestedTone}: AddressDeltaProps) {
    const renderLines = (lines: string[], fallback: string) => {
        const display = lines.length > 0 ? lines : [fallback];
        return display.map((line, idx) => (
            <Text key={`${idx}-${line}`} size="sm" style={{lineHeight: 1.4, wordBreak: 'break-word'}}>
                {line}
            </Text>
        ));
    };

    const isNeutral = requestedTone === 'neutral';
    const accent = `var(--mantine-color-${toneColors[requestedTone]}-6)`;

    /** Both sides share the card shell; only the requested one takes an accent. */
    const sideProps = {
        withBorder: true,
        radius: 'md',
        p: 10,
        style: {flex: 1, minWidth: 0},
    } as const;

    const overlineProps = {size: 'xs', tt: 'uppercase', fw: 600, mb: 4} as const;

    return (
        <Flex direction={{base: 'column', sm: 'row'}} align="stretch" gap="xs" mb={4}>
            <Paper {...sideProps} aria-label="Current address">
                <Text {...overlineProps} c="dimmed" style={{letterSpacing: '0.06em'}}>Current</Text>
                {renderLines(fromLines, fromFallback)}
            </Paper>
            {/* The arrow turns with the layout: down while the cards are stacked,
                across once they sit side by side. */}
            <Box aria-hidden style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <Text c="dimmed" fz="1.1rem" hiddenFrom="sm">↓</Text>
                <Text c="dimmed" fz="1.1rem" px={4} visibleFrom="sm">→</Text>
            </Box>
            <Paper
                {...sideProps}
                aria-label="Requested address"
                data-tone={isNeutral ? undefined : requestedTone}
                bg={isNeutral ? undefined : `color-mix(in srgb, ${accent} 6%, transparent)`}
                style={{
                    ...sideProps.style,
                    ...(isNeutral ? {} : {borderColor: `color-mix(in srgb, ${accent} 50%, transparent)`}),
                }}
            >
                <Text
                    {...overlineProps}
                    c={isNeutral ? 'dimmed' : undefined}
                    style={{letterSpacing: '0.06em', ...(isNeutral ? {} : {color: accent})}}
                >
                    Requested
                </Text>
                {renderLines(toLines, toFallback)}
            </Paper>
        </Flex>
    );
}

interface ValueDeltaProps {
    fromDisplay: string;
    toDisplay: string;
    badgeColor: string;
    requestedTone: StatusTone;
}

/**
 * Inline "current → requested" pair for short, atomic values (prices,
 * dates, flags, refs). Each side is wrapped in a small badge so it
 * reads as a first-class token instead of bare monospace text.
 */
function ValueDelta({fromDisplay, toDisplay, badgeColor, requestedTone}: ValueDeltaProps) {
    /** Requested-side picks up the row's lifecycle accent (Pending = amber,
     *  Applied = green, etc.) so the user can see at a glance whether the
     *  proposed value is in flight or live. Pre-Pending the category colour
     *  drives the badge; once a decision is rendered we follow lifecycle. */
    const requestedColor = requestedTone === 'neutral' ? badgeColor : toneColors[requestedTone];
    /**
     * A value can be a long date or address, so these badges wrap instead of
     * truncating — Mantine's Styles API reaches the label slot, which is where
     * the default `nowrap` lives.
     */
    const valueBadgeProps = {
        size: 'sm',
        tt: 'none',
        h: 'auto',
        maw: '100%',
        styles: {label: {whiteSpace: 'normal' as const}},
    } as const;

    return (
        <Group gap={6} mb={4} wrap="wrap">
            <Badge {...valueBadgeProps} color="gray">
                {fromDisplay}
            </Badge>
            <Text component="span" c="dimmed">→</Text>
            <Badge {...valueBadgeProps} color={requestedColor} fw={600} data-tone={requestedTone}>
                {toDisplay}
            </Badge>
        </Group>
    );
}
