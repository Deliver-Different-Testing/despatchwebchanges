/**
 * React Task History Component
 *
 * Displays a timeline of delivery journey events for a job.
 * Supports multiple density modes for different viewing preferences.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    ActionIcon,
    Alert,
    Badge,
    Box,
    Group,
    Paper,
    Progress,
    Stack,
    Text,
    Timeline,
    Tooltip,
    UnstyledButton
} from '@mantine/core';
import {LayoutList, NotebookPen, RefreshCw, Rows2, Rows4, SquareDashedMousePointer} from 'lucide-react';
import {IconPackage} from '@tabler/icons-react';
import {Icon} from '../icon/Icon';
import classes from './TaskHistory.module.css';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {DeliveryHistoryConfig, DeliveryJourney, DensityMode, TaskHistoryProps,} from './TaskHistory.interfaces';
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
 * The event's accent, as theme colour names. The tone keys are MUI's semantic
 * names, so they map once here rather than at every use. `info` is `reflex`
 * (the theme's declared info/links ramp) rather than Mantine's stock `blue`,
 * which the theme does not register.
 */
const TONE_COLOR: Record<EventColorTone, string> = {
    success: 'green',
    info: 'reflex',
    warning: 'orange',
    error: 'red',
    secondary: 'gray',
};

/** The same token Mantine resolves `Timeline.Item color` to, for the card's keyline. */
function eventAccent(tone: EventColorTone): string {
    return `var(--mantine-color-${TONE_COLOR[tone]}-filled)`;
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
    backgroundColor: 'var(--dd-surface-container)',
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
            <Box data-testid="task-history-root" style={containerStyle}>
                <EmptyState
                    icon={<Icon lucide={SquareDashedMousePointer} size={48}/>}
                    title="Select a Job"
                    message="Select a job to view its delivery journey."
                />
            </Box>
        );
    }

    return (
        <Box data-testid="task-history-root" style={containerStyle}>
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
                        <Timeline
                            // A bullet is only filled with its own tone while active, and the
                            // tone encodes what the event *is*, not how far the job has got —
                            // so every item is active. That also marks every rail segment
                            // active, which the stylesheet pins back to the neutral border.
                            active={deliveryEvents.length}
                            // The theme's autoContrast would derive the glyph colour from the
                            // light brand primary and hand every bullet a black glyph; opting
                            // out leaves Mantine's white, which all five tones are dark enough for.
                            autoContrast={false}
                            bulletSize={spec.markerSize}
                            lineWidth={2}
                            classNames={{item: classes.item}}
                            style={{'--journey-row-gap': `${spec.rowGap}px`} as React.CSSProperties}
                            role="list"
                            aria-label="Delivery journey events"
                        >
                            {/* Timeline.Item has to be the direct child: Timeline clones its
                                children to inject the private prop that fills a bullet, so a
                                wrapper component would swallow it. */}
                            {deliveryEvents.map((event, index) => {
                                const tone = getEventColorTone(event.icon);
                                // An MUI icon component — the glyph name comes from the backend,
                                // so `eventIcons` waits for the icon phase (§8) like `SymbolIcon`.
                                const EventIcon = getEventIcon(event.icon);
                                return (
                                    <Timeline.Item
                                        key={event.id}
                                        color={TONE_COLOR[tone]}
                                        bullet={<EventIcon sx={{fontSize: spec.iconFontSize}}/>}
                                        role="listitem"
                                        data-event-tone={tone}
                                        style={{
                                            opacity: shouldAnimate ? 1 : 0,
                                            transform: shouldAnimate ? 'translateX(0)' : 'translateX(-12px)',
                                            transition: 'opacity 300ms ease, transform 300ms ease',
                                            // Staggered entrance, capped so a long journey still finishes promptly.
                                            transitionDelay: `${Math.min(index * 0.06, 0.6)}s`,
                                        }}
                                    >
                                        <EventCard
                                            event={event}
                                            accent={eventAccent(tone)}
                                            spec={spec}
                                            densityMode={densityMode}
                                            timeZoneShort={timeZoneShort}
                                            onClick={() => handleEventClick(event)}
                                        />
                                    </Timeline.Item>
                                );
                            })}
                        </Timeline>
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

interface EventCardProps {
    event: DeliveryJourney;
    /** The event's tone as a colour token, for the card's left keyline. */
    accent: string;
    spec: DensitySpec;
    densityMode: DensityMode;
    timeZoneShort: string;
    onClick?: () => void;
}

const EventCard: React.FC<EventCardProps> = ({event, accent, spec, densityMode, timeZoneShort, onClick}) => {
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
                    color="reflex"
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

    // The left keyline carries the event's accent, so it is set with longhands — the
    // hover rule in the stylesheet repaints the other three sides only.
    return (
        <Paper
            withBorder
            radius="md"
            className={onClick ? classes.clickableCard : undefined}
            style={{
                minWidth: 0,
                borderLeftWidth: 3,
                borderLeftStyle: 'solid',
                borderLeftColor: accent,
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
    );
};

export default TaskHistory;
