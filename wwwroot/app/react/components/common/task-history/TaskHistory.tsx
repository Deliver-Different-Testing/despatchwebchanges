/**
 * React Task History Component
 *
 * Displays a timeline of delivery journey events for a job.
 * Supports multiple density modes for different viewing preferences.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {alpha, useTheme} from '@mui/material/styles';
import type {SxProps, Theme} from '@mui/material/styles';
import SyncIcon from '@mui/icons-material/Sync';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';
import ViewCompactAltIcon from '@mui/icons-material/ViewCompactAlt';
import NotesIcon from '@mui/icons-material/Notes';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import PackageIcon from '@mui/icons-material/Inventory2';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
    DeliveryHistoryConfig,
    DeliveryJourney,
    DensityMode,
    TaskHistoryProps,
} from './TaskHistory.interfaces';
import {getEventColorTone, getEventIcon} from './eventIcons';
import {DeliveryEventDetailsDialog} from './DeliveryEventDetailsDialog';
import {getIanaTimezone, getTenantTimezone, getTimezoneAbbreviation} from '../../../utils/dateUtils';
import {formatCurrency} from '../../../utils/currencyUtils';
import {useDeliveryJourney} from '../../../hooks/useTasksApi';

dayjs.extend(relativeTime);

type PaletteColorKey = 'success' | 'info' | 'warning' | 'error' | 'secondary';

interface DensitySpec {
    rowGap: number;
    contentPad: number;
    cardPad: number;
    markerSize: number;
    iconFontSize: number;
    railLeft: number;
    showNotes: boolean;
    tagLimit: number;
    titleVariant: 'subtitle2' | 'body2' | 'caption';
}

const DENSITY: Record<DensityMode, DensitySpec> = {
    [DensityMode.Normal]: {
        rowGap: 2,
        contentPad: 2,
        cardPad: 1.5,
        markerSize: 36,
        iconFontSize: 20,
        railLeft: 18,
        showNotes: true,
        tagLimit: 10,
        titleVariant: 'subtitle2',
    },
    [DensityMode.Dense]: {
        rowGap: 1.25,
        contentPad: 1.5,
        cardPad: 1,
        markerSize: 28,
        iconFontSize: 16,
        railLeft: 14,
        showNotes: false,
        tagLimit: 4,
        titleVariant: 'body2',
    },
    [DensityMode.UltraDense]: {
        rowGap: 0.75,
        contentPad: 1,
        cardPad: 0.75,
        markerSize: 22,
        iconFontSize: 13,
        railLeft: 11,
        showNotes: false,
        tagLimit: 2,
        titleVariant: 'caption',
    },
};

const defaultConfig: DeliveryHistoryConfig = {
    showSummaryStats: false,
    densityMode: DensityMode.Normal,
};

const POLLING_INTERVAL_MS = 120_000; // 2 minutes

function getEventColors(theme: Theme, iconName: string | undefined | null): { main: string; tint: string; contrast: string } {
    const key: PaletteColorKey = getEventColorTone(iconName);
    const palette = theme.palette[key];
    return {
        main: palette.main,
        tint: alpha(palette.main, 0.1),
        contrast: palette.contrastText,
    };
}

const containerSx = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    bgcolor: 'background.paper',
    borderRadius: 2,
    overflow: 'hidden',
} satisfies SxProps<Theme>;

const headerSx = {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    px: 1.5,
    py: 0.75,
} satisfies SxProps<Theme>;

const emptyStateSx = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    p: 4,
    textAlign: 'center',
} satisfies SxProps<Theme>;

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
            case DensityMode.Dense: return <ViewCompactIcon/>;
            case DensityMode.UltraDense: return <ViewCompactAltIcon/>;
            default: return <ViewAgendaIcon/>;
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
            <Box sx={containerSx}>
                <Box sx={emptyStateSx}>
                    <SelectAllIcon sx={{fontSize: 48, color: 'text.disabled', mb: 2}}/>
                    <Typography variant="h6" sx={{mb: 1}}>Select a Job</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Select a job to view its delivery journey.
                    </Typography>
                </Box>
            </Box>
        );
    }

    const hoverBgSx = {bgcolor: 'action.hover'};

    return (
        <Box sx={containerSx}>
            {/* Header */}
            <Box sx={headerSx}>
                <Stack direction="row" spacing={0.25}>
                    <Tooltip title={densityLabel}>
                        <IconButton
                            size="small"
                            onClick={cycleDensityMode}
                            aria-label={`Toggle density: currently ${densityLabel}`}
                            sx={{color: 'text.secondary', '&:hover': hoverBgSx}}
                        >
                            {densityIcon}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Refresh">
                        <IconButton
                            size="small"
                            onClick={handleRefresh}
                            disabled={loading}
                            aria-label="Refresh delivery journey"
                            sx={{
                                color: 'text.secondary',
                                '&:hover': hoverBgSx,
                                '@keyframes thSpin': {
                                    from: {transform: 'rotate(0deg)'},
                                    to: {transform: 'rotate(360deg)'},
                                },
                                '& svg': loading ? {animation: 'thSpin 1s linear infinite'} : {},
                            }}
                        >
                            <SyncIcon/>
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Box>

            {/* Body */}
            <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative'}}>
                {loading && (
                    <LinearProgress sx={{position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10}}/>
                )}

                {deliveryEvents.length > 0 ? (
                    <Box sx={{flex: 1, overflowY: 'auto', p: spec.contentPad}}>
                        <Box
                            role="list"
                            aria-label="Delivery journey events"
                            sx={{position: 'relative'}}
                        >
                            {/* Continuous timeline rail */}
                            <Box
                                aria-hidden
                                sx={{
                                    position: 'absolute',
                                    left: spec.railLeft,
                                    top: spec.markerSize / 2,
                                    bottom: spec.markerSize / 2,
                                    width: 2,
                                    bgcolor: 'divider',
                                    borderRadius: 1,
                                }}
                            />
                            <Stack spacing={spec.rowGap}>
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
                    <Box sx={emptyStateSx}>
                        <PackageIcon sx={{fontSize: 48, color: 'text.disabled', mb: 2}}/>
                        <Typography variant="h6" sx={{mb: 1}}>No Journey Events</Typography>
                        <Typography variant="body2" color="text.secondary">
                            No delivery journey events found for this job.
                        </Typography>
                    </Box>
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
    const theme = useTheme();
    const statusColor = getEventColors(theme, event.icon);
    const Icon = getEventIcon(event.icon);

    const tagsToShow = event.tags?.slice(0, spec.tagLimit) ?? [];
    const remainingTags = (event.tags?.length ?? 0) - spec.tagLimit;

    const cardBody = (
        <Stack spacing={0.75} sx={{p: spec.cardPad, width: '100%', minWidth: 0}}>
            {/* Title row */}
            <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 0.5}}
            >
                <Typography
                    variant={spec.titleVariant}
                    sx={{
                        fontWeight: densityMode === DensityMode.UltraDense ? 500 : 600,
                        flex: '1 1 auto',
                        minWidth: 0,
                        lineHeight: 1.3,
                        color: 'text.primary',
                    }}
                >
                    {event.title}
                </Typography>

                {event.grandTotalAfter != null && densityMode !== DensityMode.UltraDense && (
                    <Chip
                        size="small"
                        color="success"
                        variant="filled"
                        label={`Total: ${formatCurrency(event.grandTotalAfter)}`}
                        sx={{height: 20, '& .MuiChip-label': {px: 0.75, fontSize: '0.7rem', fontWeight: 600}}}
                    />
                )}

                {densityMode !== DensityMode.UltraDense && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{whiteSpace: 'nowrap', flexShrink: 0, lineHeight: 1.3}}
                    >
                        {event._dateStr}
                        {densityMode === DensityMode.Normal && (
                            <Box component="span" sx={{color: 'text.disabled', ml: 0.5}}>
                                {timeZoneShort}
                            </Box>
                        )}
                    </Typography>
                )}
            </Stack>

            {/* Who made the change — omitted entirely when unrecorded */}
            {event.performedBy && densityMode !== DensityMode.UltraDense && (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                        mt: -0.25,
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    by {event.performedBy}
                </Typography>
            )}

            {/* Tags */}
            {tagsToShow.length > 0 && (
                <Stack direction="row" spacing={0.5} useFlexGap sx={{flexWrap: 'wrap', rowGap: 0.5}}>
                    {tagsToShow.map((tag, tagIndex) => (
                        <Tooltip
                            key={tagIndex}
                            title={tag}
                            placement="top"
                            enterDelay={400}
                            disableInteractive
                        >
                            <Chip
                                label={tag}
                                size="small"
                                sx={{
                                    height: densityMode === DensityMode.UltraDense ? 16 : 20,
                                    maxWidth: densityMode === DensityMode.UltraDense ? 120 : 220,
                                    '& .MuiChip-label': {
                                        px: densityMode === DensityMode.UltraDense ? 0.5 : 0.75,
                                        fontSize: densityMode === DensityMode.UltraDense ? '0.65rem' : '0.7rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    },
                                }}
                            />
                        </Tooltip>
                    ))}
                    {remainingTags > 0 && densityMode !== DensityMode.Normal && (
                        <Chip
                            label={`+${remainingTags}`}
                            size="small"
                            sx={{
                                height: densityMode === DensityMode.UltraDense ? 16 : 20,
                                fontStyle: 'italic',
                                color: 'text.disabled',
                                '& .MuiChip-label': {
                                    px: densityMode === DensityMode.UltraDense ? 0.5 : 0.75,
                                    fontSize: densityMode === DensityMode.UltraDense ? '0.65rem' : '0.7rem',
                                },
                            }}
                        />
                    )}
                </Stack>
            )}

            {/* Notes */}
            {event.notes && spec.showNotes && (
                <Alert
                    severity="info"
                    variant="outlined"
                    icon={<NotesIcon fontSize="small"/>}
                    sx={{
                        py: 0.25,
                        px: 1,
                        '& .MuiAlert-message': {
                            fontSize: '0.75rem',
                            fontStyle: 'italic',
                            color: 'text.secondary',
                            py: 0.5,
                        },
                        '& .MuiAlert-icon': {py: 0.5},
                    }}
                >
                    {event.notes}
                </Alert>
            )}
        </Stack>
    );

    return (
        <Box
            role="listitem"
            sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                opacity: animated ? 1 : 0,
                transform: animated ? 'translateX(0)' : 'translateX(-12px)',
                transition: theme.transitions.create(['opacity', 'transform'], {
                    duration: theme.transitions.duration.standard,
                }),
                transitionDelay: `${Math.min(index * 0.06, 0.6)}s`,
            }}
        >
            {/* Event marker (dot) */}
            <Avatar
                sx={{
                    width: spec.markerSize,
                    height: spec.markerSize,
                    bgcolor: statusColor.main,
                    color: statusColor.contrast,
                    border: 2,
                    borderColor: 'background.paper',
                    boxShadow: 1,
                    flexShrink: 0,
                    zIndex: 1,
                }}
            >
                <Icon sx={{fontSize: spec.iconFontSize}}/>
            </Avatar>

            {/* Event card */}
            <Card
                variant="outlined"
                sx={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 2,
                    borderLeft: '3px solid',
                    borderLeftColor: statusColor.main,
                    bgcolor: 'background.paper',
                    transition: theme.transitions.create(['box-shadow', 'border-color'], {
                        duration: theme.transitions.duration.shorter,
                    }),
                    '&:hover': onClick
                        ? {boxShadow: 2, borderColor: 'primary.main', borderLeftColor: statusColor.main}
                        : undefined,
                }}
            >
                {onClick ? (
                    <CardActionArea onClick={onClick} sx={{display: 'block'}}>
                        {cardBody}
                    </CardActionArea>
                ) : (
                    cardBody
                )}
            </Card>
        </Box>
    );
};

export default TaskHistory;
