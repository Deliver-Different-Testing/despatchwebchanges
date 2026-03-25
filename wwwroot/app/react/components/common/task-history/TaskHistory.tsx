/**
 * React Task History Component
 *
 * Displays a timeline of delivery journey events for a job.
 * Supports multiple density modes for different viewing preferences.
 */

import React, {useState, useMemo, useEffect, useCallback, useRef} from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import SyncIcon from '@mui/icons-material/Sync';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';
import ViewCompactAltIcon from '@mui/icons-material/ViewCompactAlt';
import NotesIcon from '@mui/icons-material/Notes';
import CircleIcon from '@mui/icons-material/Circle';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import PackageIcon from '@mui/icons-material/Inventory2';
import {useTheme, type Theme} from '@mui/material';
import {alpha} from '@mui/material/styles';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
    TaskHistoryProps,
    DeliveryJourney,
    DensityMode,
    DeliveryHistoryConfig,
} from './TaskHistory.interfaces';
import {getIanaTimezone, getTenantTimezone, getTimezoneAbbreviation} from '../../../utils/dateUtils';

dayjs.extend(relativeTime);

// Icon color classes mapped to actual colors
// These are intentional design data for differentiating user avatars/icons, not a theme concern.
const ICON_COLORS = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#ec4899', // Pink
];

// Status colors derived from theme palette
function getStatusColors(theme: Theme) {
    return {
        completed: {main: theme.palette.success.main, light: alpha(theme.palette.success.main, 0.12)},
        current: {main: theme.palette.info.main, light: alpha(theme.palette.info.main, 0.12)},
        todo: {main: theme.palette.error.main, light: alpha(theme.palette.error.main, 0.08)},
        pending: {main: theme.palette.warning.main, light: alpha(theme.palette.warning.main, 0.12)},
        waiting: {main: theme.palette.text.disabled, light: theme.palette.grey[100]},
    };
}

const defaultConfig: DeliveryHistoryConfig = {
    showSummaryStats: false,
    densityMode: DensityMode.Normal,
};

function getIconColor(index: number): string {
    return ICON_COLORS[index % ICON_COLORS.length];
}

function getStatusColor(theme: Theme, status: string): { main: string; light: string } {
    const statusColors = getStatusColors(theme);
    return statusColors[status as keyof typeof statusColors] || statusColors.waiting;
}

export const TaskHistory: React.FC<TaskHistoryProps> = ({
                                                            jobId,
                                                            config: propConfig,
                                                            dispatchService,
                                                            showErrorToast,
                                                            showInfoToast,
                                                            showSuccessToast,
                                                            onDeliveryEventClick,
                                                        }) => {
    const theme = useTheme();
    const config = useMemo(() => ({...defaultConfig, ...propConfig}), [propConfig]);

    const [deliveryEvents, setDeliveryEvents] = useState<DeliveryJourney[]>([]);
    const [loading, setLoading] = useState(false);
    const [densityMode, setDensityMode] = useState<DensityMode>(config.densityMode || DensityMode.Normal);
    const [shouldAnimate, setShouldAnimate] = useState(false);

    const timeZoneShort = useMemo(() => {
        const ianaTimeZone = getIanaTimezone(getTenantTimezone());
        return getTimezoneAbbreviation(ianaTimeZone);
    }, []);

    const loadDeliveryJourney = useCallback(async (): Promise<void> => {
        if (!jobId) {
            setDeliveryEvents([]);
            return;
        }

        setLoading(true);
        try {
            const journey = await dispatchService.getDeliveryJourney(jobId);
            setDeliveryEvents(journey);
        } catch (error) {
            console.error('Error loading delivery journey:', error);
            showErrorToast?.('Failed to load delivery journey');
            setDeliveryEvents([]);
        } finally {
            setLoading(false);
        }
    }, [jobId, dispatchService, showErrorToast]);

    // Load delivery journey on mount and when jobId changes
    useEffect(() => {
        loadDeliveryJourney();
    }, [loadDeliveryJourney]);

    // Start animation timer on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldAnimate(true);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Setup refresh interval (2 minute polling) - use ref to avoid interval recreation
    const jobIdRef = useRef(jobId);
    jobIdRef.current = jobId;
    const loadDeliveryJourneyRef = useRef(loadDeliveryJourney);
    loadDeliveryJourneyRef.current = loadDeliveryJourney;

    useEffect(() => {
        const interval = setInterval(async () => {
            if (jobIdRef.current) {
                await loadDeliveryJourneyRef.current();
            }
        }, 120000);
        return () => clearInterval(interval);
    }, []);

    const cycleDensityMode = (): void => {
        setDensityMode(prev => {
            const modes = [DensityMode.Normal, DensityMode.Dense, DensityMode.UltraDense];
            const currentIndex = modes.indexOf(prev);
            return modes[(currentIndex + 1) % modes.length];
        });
    };

    const getDensityModeIcon = (): React.ReactNode => {
        switch (densityMode) {
            case DensityMode.Normal:
                return <ViewAgendaIcon/>;
            case DensityMode.Dense:
                return <ViewCompactIcon/>;
            case DensityMode.UltraDense:
                return <ViewCompactAltIcon/>;
            default:
                return <ViewAgendaIcon/>;
        }
    };

    const getDensityModeLabel = (): string => {
        switch (densityMode) {
            case DensityMode.Normal:
                return 'Normal View';
            case DensityMode.Dense:
                return 'Dense View';
            case DensityMode.UltraDense:
                return 'Ultra-Dense View';
            default:
                return 'Normal View';
        }
    };

    const handleRefresh = async (): Promise<void> => {
        showInfoToast?.('Refreshing delivery journey...');
        setShouldAnimate(false);

        await loadDeliveryJourney();
        setShouldAnimate(true);
        showSuccessToast?.('Delivery journey updated');
    };

    const handleEventClick = (event: React.MouseEvent, deliveryEvent: DeliveryJourney): void => {
        event.preventDefault();
        event.stopPropagation();
        onDeliveryEventClick?.(deliveryEvent);
    };

    const sizes = useMemo(() => {
        switch (densityMode) {
            case DensityMode.Dense:
                return {
                    padding: 12,
                    eventGap: 12,
                    markerSize: 24,
                    iconSize: 14,
                    titleSize: '0.875rem',
                    timeSize: '10px',
                    tagSize: '10px',
                    trackLeft: 11,
                    cardPadding: '8px 10px',
                    tagLimit: 3,
                };
            case DensityMode.UltraDense:
                return {
                    padding: 8,
                    eventGap: 8,
                    markerSize: 18,
                    iconSize: 10,
                    titleSize: '0.75rem',
                    timeSize: '9px',
                    tagSize: '9px',
                    trackLeft: 8,
                    cardPadding: '6px 8px',
                    tagLimit: 2,
                };
            default:
                return {
                    padding: 16,
                    eventGap: 16,
                    markerSize: 32,
                    iconSize: 18,
                    titleSize: '0.875rem',
                    timeSize: '0.75rem',
                    tagSize: '0.75rem',
                    trackLeft: 15,
                    cardPadding: '12px',
                    tagLimit: 10,
                };
        }
    }, [densityMode]);

    // No job selected state
    if (!jobId) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    backgroundColor: 'background.paper',
                    borderRadius: 2,
                    overflow: 'hidden',
                }}
            >
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 4,
                        textAlign: 'center',
                    }}
                >
                    <SelectAllIcon sx={{fontSize: 48, color: 'text.disabled', mb: 2}}/>
                    <Typography variant="h6" sx={{color: 'text.primary', mb: 1}}>
                        Select a Job
                    </Typography>
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>
                        Select a job to view its delivery journey.
                    </Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: 'background.paper',
                borderRadius: 2,
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    padding: '6px 12px',
                    backgroundColor: 'primary.main',
                    borderBottom: 1,
                    borderColor: 'divider',
                }}
            >
                <Box sx={{display: 'flex', gap: 0.25}}>
                    <Tooltip title={getDensityModeLabel()}>
                        <IconButton
                            size="small"
                            onClick={cycleDensityMode}
                            sx={{
                                color: 'primary.contrastText',
                                '&:hover': {bgcolor: alpha(theme.palette.common.white, 0.15)},
                            }}
                        >
                            {getDensityModeIcon()}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Refresh">
                        <IconButton
                            size="small"
                            onClick={handleRefresh}
                            disabled={loading}
                            sx={{
                                color: 'primary.contrastText',
                                '&:hover': {bgcolor: alpha(theme.palette.common.white, 0.15)},
                                '@keyframes spin': {
                                    from: {transform: 'rotate(0deg)'},
                                    to: {transform: 'rotate(360deg)'},
                                },
                                '& svg': loading ? {animation: 'spin 1s linear infinite'} : {},
                            }}
                        >
                            <SyncIcon/>
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Main Content */}
            <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative'}}>
                {/* Loading Bar */}
                {loading && (
                    <LinearProgress
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            zIndex: 10,
                        }}
                    />
                )}

                {/* Journey Events */}
                {deliveryEvents.length > 0 ? (
                    <Box
                        sx={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: `${sizes.padding}px`,
                        }}
                    >
                        <Box sx={{position: 'relative'}}>
                            {/* Timeline Track */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    left: `${sizes.trackLeft}px`,
                                    top: 0,
                                    bottom: 0,
                                    width: densityMode === DensityMode.UltraDense ? 1 : 2,
                                    backgroundColor: 'divider',
                                }}
                            />

                            {/* Events */}
                            {deliveryEvents.map((event, index) => {
                                const statusColor = getStatusColor(theme, event.status);
                                const iconColor = getIconColor(index);
                                const isLast = index === deliveryEvents.length - 1;
                                const tagsToShow = event.tags?.slice(0, sizes.tagLimit) || [];
                                const remainingTags = (event.tags?.length || 0) - sizes.tagLimit;

                                return (
                                    <Box
                                        key={event.id}
                                        onClick={(e) => handleEventClick(e, event)}
                                        sx={{
                                            display: 'flex',
                                            gap: `${sizes.eventGap}px`,
                                            marginBottom: isLast ? 0 : `${sizes.eventGap}px`,
                                            cursor: 'pointer',
                                            opacity: shouldAnimate ? 1 : 0,
                                            transform: shouldAnimate ? 'translateX(0)' : 'translateX(-16px)',
                                            transition: 'opacity 0.4s ease, transform 0.4s ease',
                                            transitionDelay: `${index * 0.08}s`,
                                            '&:hover .event-card': {
                                                borderColor: 'primary.main',
                                                boxShadow: 2,
                                            },
                                        }}
                                    >
                                        {/* Event Marker */}
                                        <Box
                                            sx={{
                                                position: 'relative',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                zIndex: 5,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: sizes.markerSize,
                                                    height: sizes.markerSize,
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: iconColor,
                                                    border: `${densityMode === DensityMode.UltraDense ? 2 : 3}px solid white`,
                                                    boxShadow: 1,
                                                    '& svg': {
                                                        color: 'white',
                                                        fontSize: sizes.iconSize,
                                                    },
                                                }}
                                            >
                                                <CircleIcon sx={{fontSize: sizes.iconSize}}/>
                                            </Box>
                                            {!isLast && (
                                                <Box
                                                    sx={{
                                                        width: densityMode === DensityMode.UltraDense ? 1 : 2,
                                                        flex: 1,
                                                        minHeight: densityMode === DensityMode.UltraDense ? 8 : 16,
                                                        backgroundColor: 'divider',
                                                        marginTop: '-2px',
                                                    }}
                                                />
                                            )}
                                        </Box>

                                        {/* Event Card */}
                                        <Box
                                            className="event-card"
                                            sx={{
                                                flex: 1,
                                                backgroundColor: 'background.paper',
                                                border: 1,
                                                borderColor: 'divider',
                                                borderLeft: `3px solid ${statusColor.main}`,
                                                borderRadius: 2,
                                                padding: sizes.cardPadding,
                                                background: `linear-gradient(to right, ${statusColor.light}, white 20%)`,
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            {/* Event Header */}
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'flex-start',
                                                    flexDirection: densityMode === DensityMode.UltraDense ? 'column' : 'row',
                                                    gap: densityMode === DensityMode.UltraDense ? '2px' : '8px',
                                                    marginBottom: '6px',
                                                }}
                                            >
                                                <Typography
                                                    sx={{
                                                        fontSize: sizes.titleSize,
                                                        fontWeight: densityMode === DensityMode.UltraDense ? 500 : 600,
                                                        color: 'text.primary',
                                                        lineHeight: 1.3,
                                                    }}
                                                >
                                                    {event.title}
                                                </Typography>
                                                {densityMode !== DensityMode.UltraDense && (
                                                    <Typography
                                                        sx={{
                                                            fontSize: sizes.timeSize,
                                                            color: 'text.secondary',
                                                            backgroundColor: 'grey.50',
                                                            padding: densityMode === DensityMode.Dense ? '1px 6px' : '2px 8px',
                                                            borderRadius: 1,
                                                            whiteSpace: 'nowrap',
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {event._dateStr}
                                                        {densityMode === DensityMode.Normal && (
                                                            <Box component="span" sx={{
                                                                color: 'text.disabled',
                                                                ml: 0.25
                                                            }}>{timeZoneShort}</Box>
                                                        )}
                                                    </Typography>
                                                )}
                                            </Box>

                                            {/* Tags */}
                                            {tagsToShow.length > 0 && (
                                                <Box sx={{display: 'flex', flexWrap: 'wrap', gap: '4px'}}>
                                                    {tagsToShow.map((tag, tagIndex) => (
                                                        <Box
                                                            key={tagIndex}
                                                            component="span"
                                                            sx={{
                                                                fontSize: sizes.tagSize,
                                                                color: 'text.secondary',
                                                                backgroundColor: 'grey.50',
                                                                padding: densityMode === DensityMode.UltraDense ? '0 3px' : '2px 6px',
                                                                borderRadius: 1,
                                                                border: 1,
                                                                borderColor: 'divider',
                                                            }}
                                                        >
                                                            {tag}
                                                        </Box>
                                                    ))}
                                                    {remainingTags > 0 && densityMode !== DensityMode.Normal && (
                                                        <Box
                                                            component="span"
                                                            sx={{
                                                                fontSize: sizes.tagSize,
                                                                color: 'text.disabled',
                                                                backgroundColor: 'grey.50',
                                                                padding: densityMode === DensityMode.UltraDense ? '0 3px' : '2px 6px',
                                                                borderRadius: 1,
                                                                border: 1,
                                                                borderColor: 'divider',
                                                                fontStyle: 'italic',
                                                            }}
                                                        >
                                                            +{remainingTags}
                                                        </Box>
                                                    )}
                                                </Box>
                                            )}

                                            {/* Notes - only in Normal mode */}
                                            {event.notes && densityMode === DensityMode.Normal && (
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: '6px',
                                                        marginTop: '8px',
                                                        padding: '8px',
                                                        backgroundColor: 'grey.50',
                                                        borderRadius: 1,
                                                        fontSize: '0.75rem',
                                                        color: 'text.secondary',
                                                        fontStyle: 'italic',
                                                    }}
                                                >
                                                    <NotesIcon
                                                        sx={{color: 'text.disabled', fontSize: 16, flexShrink: 0}}/>
                                                    <span>{event.notes}</span>
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                ) : !loading ? (
                    /* Empty State */
                    <Box
                        sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 4,
                            textAlign: 'center',
                        }}
                    >
                        <PackageIcon sx={{fontSize: 48, color: 'text.disabled', mb: 2}}/>
                        <Typography variant="h6" sx={{color: 'text.primary', mb: 1}}>
                            No Journey Events
                        </Typography>
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>
                            No delivery journey events found for this job.
                        </Typography>
                    </Box>
                ) : null}
            </Box>
        </Box>
    );
};

export default TaskHistory;
