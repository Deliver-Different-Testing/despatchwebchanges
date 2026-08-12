/**
 * React Task History Component
 *
 * Displays a timeline of delivery journey events for a job.
 * Supports multiple density modes for different viewing preferences.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActionIcon, Alert, Avatar, Badge, Box, Group, Paper, Progress, Stack, Text, Tooltip, UnstyledButton} from '@mantine/core';
import {LayoutList, NotebookPen, RefreshCw, Rows2, Rows4, SquareDashedMousePointer} from 'lucide-react';
import {IconPackage} from '@tabler/icons-react';
import {Icon} from '../icon/Icon';
import classes from './TaskHistory.module.css';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
    DeliveryHistoryConfig,
    DeliveryJourney,
    DensityMode,
    TaskHistoryProps,
} from './TaskHistory.interfaces';
import {type EventColorTone, getEventColorTone, getEventIcon} from './eventIcons';
import {DeliveryEventDetailsDialog} from './DeliveryEventDetailsDialog';
import {getIanaTimezone, getTenantTimezone, getTimezoneAbbreviation} from '../../../utils/dateUtils';
import {formatCurrency} from '../../../utils/currencyUtils';
import {useDeliveryJourney} from '../../../hooks/useTasksApi';

dayjs.extend(relativeTime);

interface DensitySpec {
    rowGap: number;
    contentPad: number;
    cardPad: number;
    markerSize: number;
    iconFontSize: number;
    railLeft: number;
    showNotes: boolean;
    tagLimit: number;
    /** Mantine font-size key for the row title. */
    titleSize: 'sm' | 'xs';
}

const DENSITY: Record<DensityMode, DensitySpec> = {
    [DensityMode.Normal]: {
        rowGap: 16,
        contentPad: 16,
        cardPad: 12,
        markerSize: 36,
        iconFontSize: 20,
        railLeft: 18,
        showNotes: true,
        tagLimit: 10,
        titleSize: 'sm',
    },
    [DensityMode.Dense]: {
        rowGap: 10,
        contentPad: 12,
        cardPad: 8,
        markerSize: 28,
        iconFontSize: 16,
        railLeft: 14,
        showNotes: false,
        tagLimit: 4,
        titleSize: 'sm',
    },
    [DensityMode.UltraDense]: {
        rowGap: 6,
        contentPad: 8,
        cardPad: 6,
        markerSize: 22,
        iconFontSize: 13,
        railLeft: 11,
        showNotes: false,
        tagLimit: 2,
        titleSize: 'xs',
    },
};

const defaultConfig: DeliveryHistoryConfig = {
    showSummaryStats: false,
    densityMode: DensityMode.Normal,
};

const POLLING_INTERVAL_MS = 120_000; // 2 minutes

/**
 * The event's accent, as Mantine colour tokens. The tone keys are MUI's semantic
 * names, so they map once here rather than at every use.
 */
const TONE_COLOR: Record<EventColorTone, string> = {
    success: 'green',
    info: 'blue',
    warning: 'orange',
    error: 'red',
    secondary: 'gray',
};

function getEventColors(iconName: string | undefined | null): { main: string; contrast: string } {
    const color = TONE_COLOR[getEventColorTone(iconName)];
    return {
        main: `var(--mantine-color-${color}-filled)`,
        contrast: `var(--mantine-color-white)`,
    };
}

/** The two empty states differ only by glyph and copy. */
const EmptyState: React.FC<{icon: React.ReactNode; title: string; message: string}> = ({icon, title, message}) => (
    <Stack align="center" justify="center" gap="xs" p="xl" ta="center" style={{flex: 1}}>
        <Box c="var(--mantine-color-dimmed)" mb="xs">{icon}</Box>
        <Text fw={600} size="lg">{title}</Text>
        <Text size="sm" c="dimmed">{message}</Text>
    </Stack>
);

const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--mantine-color-body)',
    borderRadius: 'var(--mantine-radius-md)',
    overflow: 'hidden',
};

export const TaskHistory: React.FC<TaskHistoryProps> = ({
                                                            jobId,
                                                            config: propConfig,
                                                            showErrorToast,
                                                            showInfoToast,
                                                            showSuccessToast,
                                                            onDeliveryEventClick,
                                                        }) => {
    const config = useMemo(() => ({...defaultConfig, ...propConfig}), [propConfig]);

    const [densityMode, setDensityMode] = useState<DensityMode>(config.densityMode || DensityMode.Normal);
    const [shouldAnimate, setShouldAnimate] = useState(false);
    const [detailsEvent, setDetailsEvent] = useState<DeliveryJourney | null>(null);

    const timeZoneShort = useMemo(() => {
        const ianaTimeZone = getIanaTimezone(getTenantTimezone());
        return getTimezoneAbbreviation(ianaTimeZone);
    }, []);

    const {data: deliveryEvents = [], isLoading: loading, error: fetchError, refetch} = useDeliveryJourney(jobId, {
        refetchInterval: POLLING_INTERVAL_MS,
    });

    useEffect(() => {
        if (fetchError) {
            console.error('Error loading delivery journey:', fetchError);
            showErrorToast?.('Failed to load delivery journey');
        }
    }, [fetchError, showErrorToast]);

    useEffect(() => {
        const timer = setTimeout(() => setShouldAnimate(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const spec = DENSITY[densityMode];

    const cycleDensityMode = (): void => {
        setDensityMode(prev => {
            const modes = [DensityMode.Normal, DensityMode.Dense, DensityMode.UltraDense];
            return modes[(modes.indexOf(prev) + 1) % modes.length];
        });
    };

    const densityIcon = useMemo((): React.ReactNode => {
        switch (densityMode) {
            case DensityMode.Dense: return <Icon lucide={Rows2}/>;
            case DensityMode.UltraDense: return <Icon lucide={Rows4}/>;
            default: return <Icon lucide={LayoutList}/>;
        }
    }, [densityMode]);

    const densityLabel = useMemo((): string => {
        switch (densityMode) {
            case DensityMode.Dense: return 'Dense view';
            case DensityMode.UltraDense: return 'Ultra-dense view';
            default: return 'Normal view';
        }
    }, [densityMode]);

    const handleRefresh = useCallback(async (): Promise<void> => {
        showInfoToast?.('Refreshing delivery journey...');
        setShouldAnimate(false);
        await refetch();
        setShouldAnimate(true);
        showSuccessToast?.('Delivery journey updated');
    }, [refetch, showInfoToast, showSuccessToast]);

    const handleEventClick = (deliveryEvent: DeliveryJourney): void => {
        // Always open the built-in details dialog so users can read full
        // content (long addresses, all tags, notes). Parents that wired
        // onDeliveryEventClick still receive the event — the two are
        // intentionally additive, not exclusive.
        setDetailsEvent(deliveryEvent);
        onDeliveryEventClick?.(deliveryEvent);
    };

    if (!jobId) {
        return (
            <Box style={containerStyle}>
                <EmptyState
                    icon={<Icon lucide={SquareDashedMousePointer} size={48}/>}
                    title="Select a Job"
                    message="Select a job to view its delivery journey."
                />
            </Box>
        );
    }

    return (
        <Box style={containerStyle}>
            {/* Header */}
            <Group justify="flex-end" px="sm" py={6}>
                <Group gap={2}>
                    <Tooltip label={densityLabel}>
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={cycleDensityMode}
                            aria-label={`Toggle density: currently ${densityLabel}`}
                        >
                            {densityIcon}
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Refresh">
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={handleRefresh}
                            disabled={loading}
                            aria-label="Refresh delivery journey"
                            className={loading ? classes.spinning : undefined}
                        >
                            <Icon lucide={RefreshCw}/>
                        </ActionIcon>
                    </Tooltip>
                </Group>
            </Group>

            {/* Body */}
            <Box style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative'}}>
                {loading && (
                    // Mantine has no indeterminate bar; an animated full-width track is
                    // the busy affordance, named for assistive tech.
                    <Progress
                        value={100}
                        animated
                        size="xs"
                        aria-label="Loading delivery journey"
                        style={{position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10}}
                    />
                )}

                {deliveryEvents.length > 0 ? (
                    <Box style={{flex: 1, overflowY: 'auto', padding: spec.contentPad}}>
                        <Box
                            role="list"
                            aria-label="Delivery journey events"
                            style={{position: 'relative'}}
                        >
                            {/* Continuous timeline rail */}
                            <Box
                                aria-hidden
                                style={{
                                    position: 'absolute',
                                    left: spec.railLeft,
                                    top: spec.markerSize / 2,
                                    bottom: spec.markerSize / 2,
                                    width: 2,
                                    backgroundColor: 'var(--mantine-color-default-border)',
                                    borderRadius: 'var(--mantine-radius-sm)',
                                }}
                            />
                            <Stack gap={spec.rowGap}>
                                {deliveryEvents.map((event, index) => (
                                    <EventRow
                                        key={event.id}
                                        event={event}
                                        index={index}
                                        spec={spec}
                                        densityMode={densityMode}
                                        timeZoneShort={timeZoneShort}
                                        animated={shouldAnimate}
                                        onClick={() => handleEventClick(event)}
                                    />
                                ))}
                            </Stack>
                        </Box>
                    </Box>
                ) : !loading ? (
                    <EmptyState
                        icon={<Icon tabler={IconPackage} size={48}/>}
                        title="No Journey Events"
                        message="No delivery journey events found for this job."
                    />
                ) : null}
            </Box>

            <DeliveryEventDetailsDialog
                open={detailsEvent !== null}
                event={detailsEvent}
                timeZoneShort={timeZoneShort}
                onClose={() => setDetailsEvent(null)}
            />
        </Box>
    );
};

interface EventRowProps {
    event: DeliveryJourney;
    index: number;
    spec: DensitySpec;
    densityMode: DensityMode;
    timeZoneShort: string;
    animated: boolean;
    onClick?: () => void;
}

const EventRow: React.FC<EventRowProps> = ({event, index, spec, densityMode, timeZoneShort, animated, onClick}) => {
    const statusColor = getEventColors(event.icon);
    // An MUI icon component — the glyph name comes from the backend, so `eventIcons`
    // waits for the icon phase (§8) like `SymbolIcon`.
    const EventIcon = getEventIcon(event.icon);
    const ultraDense = densityMode === DensityMode.UltraDense;

    const tagsToShow = event.tags?.slice(0, spec.tagLimit) ?? [];
    const remainingTags = (event.tags?.length ?? 0) - spec.tagLimit;

    const cardBody = (
        <Stack gap={6} p={spec.cardPad} style={{width: '100%', minWidth: 0}}>
            {/* Title row */}
            <Group gap="xs" align="flex-start" wrap="wrap">
                <Text
                    size={spec.titleSize}
                    fw={ultraDense ? 500 : 600}
                    lh={1.3}
                    style={{flex: '1 1 auto', minWidth: 0}}
                >
                    {event.title}
                </Text>

                {event.grandTotalAfter != null && !ultraDense && (
                    <Badge color="green" variant="filled" h={20} fw={600} tt="none" style={{fontSize: '0.7rem'}}>
                        {`Total: ${formatCurrency(event.grandTotalAfter)}`}
                    </Badge>
                )}

                {!ultraDense && (
                    <Text size="xs" c="dimmed" lh={1.3} style={{whiteSpace: 'nowrap', flexShrink: 0}}>
                        {event._dateStr}
                        {densityMode === DensityMode.Normal && (
                            <Box component="span" c="var(--mantine-color-dimmed)" ml={4}>
                                {timeZoneShort}
                            </Box>
                        )}
                    </Text>
                )}
            </Group>

            {/* Who made the change — omitted entirely when unrecorded */}
            {event.performedBy && !ultraDense && (
                <Text size="xs" c="dimmed" lh={1.3} truncate mt={-2}>
                    by {event.performedBy}
                </Text>
            )}

            {/* Tags */}
            {tagsToShow.length > 0 && (
                <Group gap={4} wrap="wrap">
                    {tagsToShow.map((tag, tagIndex) => (
                        <Tooltip key={tagIndex} label={tag} position="top" openDelay={400}>
                            <Badge
                                variant="default"
                                tt="none"
                                h={ultraDense ? 16 : 20}
                                maw={ultraDense ? 120 : 220}
                                px={ultraDense ? 4 : 6}
                                style={{fontSize: ultraDense ? '0.65rem' : '0.7rem'}}
                            >
                                {tag}
                            </Badge>
                        </Tooltip>
                    ))}
                    {remainingTags > 0 && densityMode !== DensityMode.Normal && (
                        <Badge
                            variant="default"
                            tt="none"
                            c="dimmed"
                            h={ultraDense ? 16 : 20}
                            px={ultraDense ? 4 : 6}
                            style={{fontSize: ultraDense ? '0.65rem' : '0.7rem', fontStyle: 'italic'}}
                        >
                            {`+${remainingTags}`}
                        </Badge>
                    )}
                </Group>
            )}

            {/* Notes */}
            {event.notes && spec.showNotes && (
                <Alert
                    color="blue"
                    variant="outline"
                    py={4}
                    px="xs"
                    icon={<Icon lucide={NotebookPen} size={16}/>}
                    styles={{message: {fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--mantine-color-dimmed)'}}}
                >
                    {event.notes}
                </Alert>
            )}
        </Stack>
    );

    return (
        <Box
            role="listitem"
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                opacity: animated ? 1 : 0,
                transform: animated ? 'translateX(0)' : 'translateX(-12px)',
                transition: 'opacity 300ms ease, transform 300ms ease',
                // Staggered entrance, capped so a long journey still finishes promptly.
                transitionDelay: `${Math.min(index * 0.06, 0.6)}s`,
            }}
        >
            {/* Event marker (dot) */}
            <Avatar
                size={spec.markerSize}
                radius="xl"
                style={{
                    backgroundColor: statusColor.main,
                    color: statusColor.contrast,
                    border: '2px solid var(--mantine-color-body)',
                    boxShadow: 'var(--mantine-shadow-xs)',
                    flexShrink: 0,
                    zIndex: 1,
                }}
            >
                <EventIcon sx={{fontSize: spec.iconFontSize}}/>
            </Avatar>

            {/* Event card. The left keyline carries the event's accent, so it is set
                with longhands — the hover rule in the stylesheet repaints the other
                three sides only. */}
            <Paper
                withBorder
                radius="md"
                className={onClick ? classes.clickableCard : undefined}
                style={{
                    flex: 1,
                    minWidth: 0,
                    borderLeftWidth: 3,
                    borderLeftStyle: 'solid',
                    borderLeftColor: statusColor.main,
                }}
            >
                {onClick ? (
                    <UnstyledButton onClick={onClick} display="block" w="100%">
                        {cardBody}
                    </UnstyledButton>
                ) : (
                    cardBody
                )}
            </Paper>
        </Box>
    );
};

export default TaskHistory;
