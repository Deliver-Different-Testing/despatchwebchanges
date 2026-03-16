/**
 * React Task History Component
 *
 * Displays a timeline of delivery journey events for a job.
 * Supports multiple density modes for different viewing preferences.
 */

import React from 'react';
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

// Status colors
const STATUS_COLORS = {
    completed: {main: '#10b981', light: '#d1fae5'},
    current: {main: '#3b82f6', light: '#dbeafe'},
    todo: {main: '#ef4444', light: '#fef2f2'},
    pending: {main: '#f59e0b', light: '#fef3c7'},
    waiting: {main: '#9ca3af', light: '#f3f4f6'},
};

const defaultConfig: DeliveryHistoryConfig = {
    showSummaryStats: false,
    densityMode: DensityMode.Normal,
};

interface TaskHistoryState {
    deliveryEvents: DeliveryJourney[];
    loading: boolean;
    densityMode: DensityMode;
    shouldAnimate: boolean;
}

export class TaskHistory extends React.Component<TaskHistoryProps, TaskHistoryState> {
    static defaultProps: Partial<TaskHistoryProps> = {
        isUsCustomer: true,
    };

    private readonly timeZoneShort: string;
    private refreshIntervalRef: NodeJS.Timeout | null = null;
    private animationTimerRef: NodeJS.Timeout | null = null;

    constructor(props: TaskHistoryProps) {
        super(props);
        const config = {...defaultConfig, ...props.config};
        this.state = {
            deliveryEvents: [],
            loading: false,
            densityMode: config.densityMode || DensityMode.Normal,
            shouldAnimate: false,
        };

        const ianaTimeZone = getIanaTimezone(getTenantTimezone());
        this.timeZoneShort = getTimezoneAbbreviation(ianaTimeZone);
    }

    componentDidMount(): void {
        this.loadDeliveryJourney();
        this.startAnimationTimer();
        this.setupRefreshInterval();
    }

    componentDidUpdate(prevProps: TaskHistoryProps): void {
        if (prevProps.jobId !== this.props.jobId) {
            this.loadDeliveryJourney();
        }
    }

    componentWillUnmount(): void {
        if (this.refreshIntervalRef) {
            clearInterval(this.refreshIntervalRef);
        }
        if (this.animationTimerRef) {
            clearTimeout(this.animationTimerRef);
        }
    }

    private get config(): DeliveryHistoryConfig {
        return {...defaultConfig, ...this.props.config};
    }

    private get themeColors() {
        const {isUsCustomer} = this.props;
        if (isUsCustomer) {
            return {
                primary: '#2196f3',
                primaryLight: '#e3f2fd',
                headerBg: '#2196f3',
                headerText: '#ffffff',
            };
        }
        return {
            primary: '#f4c430',
            primaryLight: '#fef9e7',
            headerBg: '#f4c430',
            headerText: 'rgba(0, 0, 0, 0.87)',
        };
    }

    private startAnimationTimer = (): void => {
        this.animationTimerRef = setTimeout(() => {
            this.setState({shouldAnimate: true});
        }, 100);
    };

    private setupRefreshInterval = (): void => {
        this.refreshIntervalRef = setInterval(async () => {
            if (this.props.jobId) {
                await this.loadDeliveryJourney();
            }
        }, 120000);
    };

    private loadDeliveryJourney = async (): Promise<void> => {
        const {jobId, dispatchService, showErrorToast} = this.props;

        if (!jobId) {
            this.setState({deliveryEvents: []});
            return;
        }

        this.setState({loading: true});
        try {
            const journey = await dispatchService.getDeliveryJourney(jobId);
            this.setState({deliveryEvents: journey});
        } catch (error) {
            console.error('Error loading delivery journey:', error);
            showErrorToast?.('Failed to load delivery journey');
            this.setState({deliveryEvents: []});
        } finally {
            this.setState({loading: false});
        }
    };

    private cycleDensityMode = (): void => {
        this.setState(prevState => {
            const modes = [DensityMode.Normal, DensityMode.Dense, DensityMode.UltraDense];
            const currentIndex = modes.indexOf(prevState.densityMode);
            return {densityMode: modes[(currentIndex + 1) % modes.length]};
        });
    };

    private getDensityModeIcon = (): React.ReactNode => {
        const {densityMode} = this.state;
        switch (densityMode) {
            case DensityMode.Normal:
                return <ViewAgendaIcon />;
            case DensityMode.Dense:
                return <ViewCompactIcon />;
            case DensityMode.UltraDense:
                return <ViewCompactAltIcon />;
            default:
                return <ViewAgendaIcon />;
        }
    };

    private getDensityModeLabel = (): string => {
        const {densityMode} = this.state;
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

    private handleRefresh = async (): Promise<void> => {
        const {showInfoToast, showSuccessToast} = this.props;

        showInfoToast?.('Refreshing delivery journey...');
        this.setState({deliveryEvents: [], shouldAnimate: false});

        setTimeout(async () => {
            await this.loadDeliveryJourney();
            this.setState({shouldAnimate: true});
            showSuccessToast?.('Delivery journey updated');
        }, 300);
    };

    private handleEventClick = (event: React.MouseEvent, deliveryEvent: DeliveryJourney): void => {
        event.preventDefault();
        event.stopPropagation();
        this.props.onDeliveryEventClick?.(deliveryEvent);
    };

    private getIconColor = (index: number): string => {
        return ICON_COLORS[index % ICON_COLORS.length];
    };

    private getStatusColor = (status: string): {main: string; light: string} => {
        return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.waiting;
    };

    private getDensitySizes = () => {
        const {densityMode} = this.state;
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
    };

    render(): React.ReactNode {
        const {jobId} = this.props;
        const {deliveryEvents, loading, densityMode, shouldAnimate} = this.state;
        const themeColors = this.themeColors;
        const sizes = this.getDensitySizes();

        // No job selected state
        if (!jobId) {
            return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    backgroundColor: '#fff',
                    borderRadius: '8px',
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
                    <SelectAllIcon sx={{fontSize: 48, color: '#9ca3af', mb: 2}} />
                    <Typography variant="h6" sx={{color: '#1f2937', mb: 1}}>
                        Select a Job
                    </Typography>
                    <Typography variant="body2" sx={{color: '#6b7280'}}>
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
                backgroundColor: '#fff',
                borderRadius: '8px',
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
                    backgroundColor: themeColors.headerBg,
                    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
                }}
            >
                <Box sx={{display: 'flex', gap: 0.25}}>
                    <Tooltip title={this.getDensityModeLabel()}>
                        <IconButton
                            size="small"
                            onClick={this.cycleDensityMode}
                            sx={{
                                color: themeColors.headerText,
                                '&:hover': {backgroundColor: 'rgba(255, 255, 255, 0.15)'},
                            }}
                        >
                            {this.getDensityModeIcon()}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Refresh">
                        <IconButton
                            size="small"
                            onClick={this.handleRefresh}
                            disabled={loading}
                            sx={{
                                color: themeColors.headerText,
                                '&:hover': {backgroundColor: 'rgba(255, 255, 255, 0.15)'},
                                '@keyframes spin': {
                                    from: {transform: 'rotate(0deg)'},
                                    to: {transform: 'rotate(360deg)'},
                                },
                                '& svg': loading ? {animation: 'spin 1s linear infinite'} : {},
                            }}
                        >
                            <SyncIcon />
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
                                    backgroundColor: '#e5e7eb',
                                }}
                            />

                            {/* Events */}
                            {deliveryEvents.map((event, index) => {
                                const statusColor = this.getStatusColor(event.status);
                                const iconColor = this.getIconColor(index);
                                const isLast = index === deliveryEvents.length - 1;
                                const tagsToShow = event.tags?.slice(0, sizes.tagLimit) || [];
                                const remainingTags = (event.tags?.length || 0) - sizes.tagLimit;

                                return (
                                    <Box
                                        key={event.id}
                                        onClick={(e) => this.handleEventClick(e, event)}
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
                                                borderColor: themeColors.primary,
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
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
                                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                                    '& svg': {
                                                        color: 'white',
                                                        fontSize: sizes.iconSize,
                                                    },
                                                }}
                                            >
                                                <CircleIcon sx={{fontSize: sizes.iconSize}} />
                                            </Box>
                                            {!isLast && (
                                                <Box
                                                    sx={{
                                                        width: densityMode === DensityMode.UltraDense ? 1 : 2,
                                                        flex: 1,
                                                        minHeight: densityMode === DensityMode.UltraDense ? 8 : 16,
                                                        backgroundColor: '#e5e7eb',
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
                                                backgroundColor: '#fff',
                                                border: '1px solid #e5e7eb',
                                                borderLeft: `3px solid ${statusColor.main}`,
                                                borderRadius: '8px',
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
                                                    alignItems: densityMode === DensityMode.UltraDense ? 'flex-start' : 'flex-start',
                                                    flexDirection: densityMode === DensityMode.UltraDense ? 'column' : 'row',
                                                    gap: densityMode === DensityMode.UltraDense ? '2px' : '8px',
                                                    marginBottom: '6px',
                                                }}
                                            >
                                                <Typography
                                                    sx={{
                                                        fontSize: sizes.titleSize,
                                                        fontWeight: densityMode === DensityMode.UltraDense ? 500 : 600,
                                                        color: '#1f2937',
                                                        lineHeight: 1.3,
                                                    }}
                                                >
                                                    {event.title}
                                                </Typography>
                                                {densityMode !== DensityMode.UltraDense && (
                                                    <Typography
                                                        sx={{
                                                            fontSize: sizes.timeSize,
                                                            color: '#6b7280',
                                                            backgroundColor: '#f9fafb',
                                                            padding: densityMode === DensityMode.Dense ? '1px 6px' : '2px 8px',
                                                            borderRadius: '4px',
                                                            whiteSpace: 'nowrap',
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {event._dateStr}
                                                        {densityMode === DensityMode.Normal && (
                                                            <span style={{color: '#9ca3af', marginLeft: 2}}>{this.timeZoneShort}</span>
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
                                                                color: '#6b7280',
                                                                backgroundColor: '#f9fafb',
                                                                padding: densityMode === DensityMode.UltraDense ? '0 3px' : '2px 6px',
                                                                borderRadius: '4px',
                                                                border: '1px solid #e5e7eb',
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
                                                                color: '#9ca3af',
                                                                backgroundColor: '#f9fafb',
                                                                padding: densityMode === DensityMode.UltraDense ? '0 3px' : '2px 6px',
                                                                borderRadius: '4px',
                                                                border: '1px solid #e5e7eb',
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
                                                        backgroundColor: '#f9fafb',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        color: '#6b7280',
                                                        fontStyle: 'italic',
                                                    }}
                                                >
                                                    <NotesIcon sx={{color: '#9ca3af', fontSize: 16, flexShrink: 0}} />
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
                        <PackageIcon sx={{fontSize: 48, color: '#9ca3af', mb: 2}} />
                        <Typography variant="h6" sx={{color: '#1f2937', mb: 1}}>
                            No Journey Events
                        </Typography>
                        <Typography variant="body2" sx={{color: '#6b7280'}}>
                            No delivery journey events found for this job.
                        </Typography>
                    </Box>
                ) : null}
            </Box>
        </Box>
        );
    }
}

export default TaskHistory;
