/**
 * Flight Agent Confirmation Dialog
 *
 * React replacement for the AngularJS flight-agent-conformation-dialog.
 * Handles both flight and agent assignment confirmation with cargo processing calculations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Typography,
    Box,
    TextField,
    CircularProgress,
    Paper,
    Checkbox,
    FormControlLabel,
    Alert,
    Chip,
    Divider,
} from '@mui/material';
import {
    Close as CloseIcon,
    Flight as FlightIcon,
    Person as PersonIcon,
    Schedule as ScheduleIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Edit as EditIcon,
    ArrowForward as ArrowForwardIcon,
    LocalShipping as LocalShippingIcon,
    Inventory as InventoryIcon,
    AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import duration from 'dayjs/plugin/duration';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import {
    FlightAgentConfirmationDialogProps,
    FlightCargoProcessing,
    CargoStatus,
    CargoIndicator,
    AvailableTime,
    FlightAgentDialogResult,
    FlightSegment,
} from './types';

dayjs.extend(isBetween);
dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(timezone);

// Helper to get DG class name
function getDangerousGoodsClassName(dgClass?: number): string | undefined {
    if (dgClass === undefined || dgClass === null) return undefined;
    const classNames: Record<number, string> = {
        1: 'Explosives',
        2: 'Gases',
        3: 'Flammable Liquids',
        4: 'Flammable Solids',
        5: 'Oxidizers',
        6: 'Toxic Substances',
        7: 'Radioactive Material',
        8: 'Corrosives',
        9: 'Miscellaneous',
    };
    return classNames[dgClass] || `Class ${dgClass}`;
}

// Format time as HH:mm
function formatTime(time: Dayjs): string {
    return time.format('HH:mm');
}

// Format duration in minutes to readable string
function formatDuration(minutes: number): string {
    if (minutes < 60) {
        return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
}

export const FlightAgentConfirmationDialog: React.FC<FlightAgentConfirmationDialogProps> = ({
    open,
    mode,
    jobId,
    jobNumber,
    flight,
    agent,
    existingAwb,
    dgClass,
    stopJobCount,
    timezone: tz,
    onClose,
    onConfirm,
    onCalculateCargoTimes,
    showToast,
}) => {
    // Form state
    const [awb, setAwb] = useState('');
    const [assignToStopJobs, setAssignToStopJobs] = useState(false);
    const [deliveryNotes, setDeliveryNotes] = useState('');
    const [packageReadyTime, setPackageReadyTime] = useState<Dayjs | null>(null);
    const [deliveryByTime, setDeliveryByTime] = useState<Dayjs | null>(null);
    const [packageTimeEditEnabled, setPackageTimeEditEnabled] = useState(false);

    // Cargo processing state
    const [cargoProcessing, setCargoProcessing] = useState<FlightCargoProcessing | null>(null);
    const [isCalculatingTimes, setIsCalculatingTimes] = useState(false);

    // Status display state
    const [cargoStatus, setCargoStatus] = useState<CargoStatus | null>(null);
    const [cargoIndicator, setCargoIndicator] = useState<CargoIndicator | null>(null);
    const [availableTime, setAvailableTime] = useState<AvailableTime | null>(null);

    // Warning state
    const [showWarning, setShowWarning] = useState(false);
    const [warningMessage, setWarningMessage] = useState('');
    const [nextMorningTime, setNextMorningTime] = useState('');

    // Flight info
    const [departureAirport, setDepartureAirport] = useState('');
    const [arrivalAirport, setArrivalAirport] = useState('');
    const [departureTime, setDepartureTime] = useState<Dayjs | null>(null);
    const [arrivalTime, setArrivalTime] = useState<Dayjs | null>(null);
    const [flightNumber, setFlightNumber] = useState('');
    const [departureTimeZone, setDepartureTimeZone] = useState('');
    const [arrivalTimeZone, setArrivalTimeZone] = useState('');

    // Computed values
    const isAwbDisabled = !!existingAwb;
    const showIncludeStopJobs = mode === 'agent' && (stopJobCount ?? 0) > 0;
    const dgClassName = getDangerousGoodsClassName(dgClass);

    // Dialog title
    const dialogTitle = mode === 'flight'
        ? `Assign Flight${flight ? ` - ${flight.flightNumber}` : ''}`
        : `Assign Agent${agent ? ` - ${agent.text}` : ''}`;

    // Initialize loading states
    const initializeLoadingStates = useCallback(() => {
        setCargoStatus({
            class: 'cargo-loading',
            icon: 'schedule',
            hours: 'Loading...',
            text: 'Loading cargo information...',
        });
        setCargoIndicator({
            class: 'cargo-indicator loading',
            icon: 'schedule',
            text: 'Loading...',
        });
        setAvailableTime({
            class: 'time-loading',
            icon: 'schedule',
            text: 'Loading...',
            subtext: 'Calculating times...',
        });
    }, []);

    // Check if package ready time is within cargo hours
    const isPackageReadyWithinCargoHours = useCallback((): boolean => {
        if (!cargoProcessing || !packageReadyTime) return false;

        const packageDate = packageReadyTime.format('YYYY-MM-DD');
        const openingTimeOnPackageDate = dayjs(
            `${packageDate} ${cargoProcessing.cargoOpeningTime.format('HH:mm:ss')}`
        );
        const closingTimeOnPackageDate = dayjs(
            `${packageDate} ${cargoProcessing.cargoClosingTime.format('HH:mm:ss')}`
        );

        return packageReadyTime.isBetween(openingTimeOnPackageDate, closingTimeOnPackageDate, null, '[]');
    }, [cargoProcessing, packageReadyTime]);

    // Calculate next morning time
    const calculateNextMorningTime = useCallback((pkgTime: Dayjs): Dayjs => {
        if (!cargoProcessing) return pkgTime;

        const nextMorning = pkgTime.add(1, 'day');
        const cargoOpening = cargoProcessing.cargoOpeningTime;

        return nextMorning
            .hour(cargoOpening.hour())
            .minute(cargoOpening.minute())
            .second(0)
            .millisecond(0);
    }, [cargoProcessing]);

    // Update cargo status display
    const updateCargoStatus = useCallback((isWithinHours: boolean, pkgTime: Dayjs) => {
        if (!cargoProcessing) return;

        const openTime = formatTime(cargoProcessing.cargoOpeningTime);
        const closeTime = formatTime(cargoProcessing.cargoClosingTime);
        const hours = `${openTime} - ${closeTime}`;

        if (isWithinHours) {
            setCargoStatus({
                class: 'cargo-open',
                icon: 'check_circle',
                hours,
                text: 'Open when package ready',
            });
            setCargoIndicator({
                class: 'cargo-indicator valid',
                icon: 'check_circle',
                text: 'Within cargo hours',
            });
            setShowWarning(false);
        } else {
            setCargoStatus({
                class: 'cargo-closed',
                icon: 'cancel',
                hours,
                text: 'Closed when package ready',
            });
            setCargoIndicator({
                class: 'cargo-indicator invalid',
                icon: 'cancel',
                text: 'After cargo closes',
            });

            // Setup warning
            setShowWarning(true);
            const timeStr = pkgTime.format('HH:mm');
            const closingTime = cargoProcessing.cargoClosingTime.format('HH:mm');
            setWarningMessage(
                `Package available at ${timeStr} but cargo facility closes at ${closingTime}. Choose an option:`
            );

            const nextMorning = calculateNextMorningTime(pkgTime);
            setNextMorningTime(`${nextMorning.format('MMM D')}, ${nextMorning.format('HH:mm')} (Cargo Opens)`);
        }
    }, [cargoProcessing, calculateNextMorningTime]);

    // Evaluate delivery scenario
    const evaluateDeliveryScenario = useCallback(() => {
        if (!deliveryByTime) {
            setAvailableTime({
                class: 'time-warning',
                icon: 'warning',
                text: 'Set delivery time',
                subtext: 'Time not calculated',
            });
            return;
        }

        if (!packageReadyTime) {
            setAvailableTime({
                class: 'time-critical',
                icon: 'error',
                text: 'Invalid times',
                subtext: 'Package ready time not available',
            });
            return;
        }

        const diffMinutes = deliveryByTime.diff(packageReadyTime, 'minute');

        if (diffMinutes < 0) {
            setAvailableTime({
                class: 'time-critical',
                icon: 'cancel',
                text: 'Invalid timing',
                subtext: 'Delivery before package ready',
            });
        } else if (diffMinutes < 30) {
            setAvailableTime({
                class: 'time-critical',
                icon: 'cancel',
                text: `${diffMinutes} minutes`,
                subtext: 'Insufficient time',
            });
        } else if (diffMinutes < 90) {
            setAvailableTime({
                class: 'time-warning',
                icon: 'warning',
                text: `${diffMinutes} minutes`,
                subtext: 'Tight timeline',
            });
        } else {
            setAvailableTime({
                class: 'time-sufficient',
                icon: 'check_circle',
                text: formatDuration(diffMinutes),
                subtext: 'Sufficient time',
            });
        }
    }, [deliveryByTime, packageReadyTime]);

    // Evaluate current scenario
    const evaluateCurrentScenario = useCallback(() => {
        if (isCalculatingTimes || !packageReadyTime || !cargoProcessing) return;

        const isWithinHours = isPackageReadyWithinCargoHours();
        updateCargoStatus(isWithinHours, packageReadyTime);
        evaluateDeliveryScenario();
    }, [isCalculatingTimes, packageReadyTime, cargoProcessing, isPackageReadyWithinCargoHours, updateCargoStatus, evaluateDeliveryScenario]);

    // Calculate cargo processing times
    const calculateCargoProcessingTimes = useCallback(async (lastFlight: FlightSegment) => {
        if (!lastFlight.arrivalAirportId) {
            showToast('No arrival airport ID found for cargo processing calculation', 'warning');
            return;
        }

        setIsCalculatingTimes(true);
        initializeLoadingStates();

        try {
            const result = await onCalculateCargoTimes(
                jobId,
                lastFlight.carrierFsCode,
                lastFlight.arrivalTime,
                lastFlight.arrivalAirportTimeZone
            );

            if (!result) {
                setCargoStatus({
                    class: 'cargo-error',
                    icon: 'error',
                    hours: 'Error',
                    text: 'Failed to load cargo information',
                });
                setCargoIndicator({
                    class: 'cargo-indicator invalid',
                    icon: 'error',
                    text: 'Unable to verify cargo hours',
                });
                setAvailableTime({
                    class: 'time-critical',
                    icon: 'error',
                    text: 'Error',
                    subtext: 'Unable to calculate times',
                });
                showToast('Failed to calculate cargo processing times', 'error');
                setIsCalculatingTimes(false);
                return;
            }

            setCargoProcessing(result);

            const arrivalWithProcessing = result.arrivalTime.add(result.processingTimeMins, 'minute');
            const today = dayjs();
            const arrivalTimeToday = today.hour(arrivalWithProcessing.hour()).minute(arrivalWithProcessing.minute());
            const openingTimeToday = today.hour(result.cargoOpeningTime.hour()).minute(result.cargoOpeningTime.minute());

            const pkgReadyTime = arrivalTimeToday.isAfter(openingTimeToday)
                ? arrivalWithProcessing
                : result.cargoOpeningTime;

            setPackageReadyTime(pkgReadyTime);

            if (result.deliverByTime) {
                setDeliveryByTime(result.deliverByTime);
            }

            setIsCalculatingTimes(false);
        } catch (error) {
            console.error('Error calculating cargo processing times:', error);
            showToast('Failed to calculate cargo processing times', 'error');
            setIsCalculatingTimes(false);
        }
    }, [jobId, onCalculateCargoTimes, showToast, initializeLoadingStates]);

    // Process flight data
    const processFlightData = useCallback(async () => {
        if (!flight?.flightSegments || flight.flightSegments.length === 0) {
            showToast('No flight segments available', 'error');
            return;
        }

        const sortedSegments = [...flight.flightSegments].sort((a, b) => a.segmentOrder - b.segmentOrder);
        const firstFlight = sortedSegments[0];
        const lastFlight = sortedSegments[sortedSegments.length - 1];

        setDepartureAirport(firstFlight.departureAirportFsCode);
        setArrivalAirport(lastFlight.arrivalAirportFsCode);
        setDepartureTime(firstFlight.departureTime);
        setArrivalTime(lastFlight.arrivalTime);
        setFlightNumber(flight.flightNumber);
        setDepartureTimeZone(firstFlight.departureAirportTimeZone);
        setArrivalTimeZone(lastFlight.arrivalAirportTimeZone);

        await calculateCargoProcessingTimes(lastFlight);
    }, [flight, calculateCargoProcessingTimes, showToast]);

    // Initialize dialog when opened
    useEffect(() => {
        if (open) {
            // Reset state
            setAwb(existingAwb || '');
            setAssignToStopJobs(false);
            setDeliveryNotes('');
            setPackageTimeEditEnabled(false);
            setShowWarning(false);
            setCargoProcessing(null);
            setPackageReadyTime(null);
            setDeliveryByTime(null);

            // Process flight data if in flight mode
            if (mode === 'flight' && flight) {
                initializeLoadingStates();
                processFlightData();
            }
        }
    }, [open, mode, flight, existingAwb, processFlightData, initializeLoadingStates]);

    // Re-evaluate when times change
    useEffect(() => {
        if (open && cargoProcessing && packageReadyTime) {
            evaluateCurrentScenario();
        }
    }, [open, cargoProcessing, packageReadyTime, deliveryByTime, evaluateCurrentScenario]);

    // Handlers
    const handleSetNextMorning = () => {
        if (!packageReadyTime || !cargoProcessing) return;
        const nextMorning = calculateNextMorningTime(packageReadyTime);
        setPackageReadyTime(nextMorning);
    };

    const handleSetBaggagePickup = () => {
        setDeliveryNotes(
            'COLLECT FROM BAGGAGE CAROUSEL - Package available after cargo hours. ' +
            'Check baggage claim area for collection. Contact ground services if assistance needed.'
        );
        setShowWarning(false);
    };

    const handleSetDeliveryTime = () => {
        if (!deliveryByTime && packageReadyTime?.isValid()) {
            setDeliveryByTime(packageReadyTime.add(4, 'hour'));
        }
    };

    const handleConfirm = () => {
        const result: FlightAgentDialogResult = {
            shouldAssign: true,
            awb: awb || undefined,
            shouldAssignToStopJobs: assignToStopJobs,
            packageReadyTime: packageReadyTime ?? undefined,
            packageDeliverByTime: deliveryByTime ?? undefined,
            packageDeliveryNotes: deliveryNotes || undefined,
        };
        onConfirm(result);
    };

    // Get status icon component
    const getStatusIcon = (iconName: string, className: string) => {
        const color = className.includes('valid') || className.includes('sufficient') || className.includes('open')
            ? 'success'
            : className.includes('warning')
                ? 'warning'
                : className.includes('critical') || className.includes('invalid') || className.includes('closed') || className.includes('error')
                    ? 'error'
                    : 'inherit';

        switch (iconName) {
            case 'check_circle':
                return <CheckCircleIcon color={color as any} />;
            case 'cancel':
                return <CancelIcon color={color as any} />;
            case 'warning':
                return <WarningIcon color={color as any} />;
            case 'error':
                return <ErrorIcon color={color as any} />;
            case 'schedule':
                return <ScheduleIcon color="inherit" />;
            default:
                return <ScheduleIcon color="inherit" />;
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    elevation: 24,
                    sx: {
                        borderRadius: 2,
                        overflow: 'hidden',
                        maxHeight: '90vh',
                    },
                }}
            >
                {/* Header */}
                <Box
                    sx={(theme) => ({
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                        color: 'white',
                        px: 3,
                        py: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                    })}
                >
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 1.5,
                            bgcolor: 'rgba(255,255,255,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {mode === 'flight' ? <FlightIcon sx={{ fontSize: 24 }} /> : <PersonIcon sx={{ fontSize: 24 }} />}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight={600}>
                            {dialogTitle}
                        </Typography>
                        {mode === 'flight' && departureAirport && arrivalAirport && (
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                {departureAirport} → {arrivalAirport}
                            </Typography>
                        )}
                    </Box>
                    <IconButton
                        onClick={onClose}
                        sx={{
                            color: 'white',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Content */}
                <DialogContent sx={{ p: 3, bgcolor: '#fafafa' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Flight Route Section */}
                        {mode === 'flight' && flight && (
                            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    {/* Departure */}
                                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                                        <Typography variant="h4" fontWeight={700} color="primary">
                                            {departureAirport}
                                        </Typography>
                                        {departureTime && (
                                            <Typography variant="body2" color="text.secondary">
                                                {departureTime.format('MMM D, HH:mm')}
                                            </Typography>
                                        )}
                                    </Box>

                                    {/* Arrow and Flight Number */}
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 3 }}>
                                        <Chip
                                            icon={<FlightIcon />}
                                            label={flightNumber}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                        <ArrowForwardIcon sx={{ fontSize: 32, color: 'text.secondary', mt: 1 }} />
                                    </Box>

                                    {/* Arrival */}
                                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                                        <Typography variant="h4" fontWeight={700} color="primary">
                                            {arrivalAirport}
                                        </Typography>
                                        {arrivalTime && (
                                            <Typography variant="body2" color="text.secondary">
                                                {arrivalTime.format('MMM D, HH:mm')}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </Paper>
                        )}

                        {/* Cargo Processing Section (Flight mode only) */}
                        {mode === 'flight' && (
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                {/* Cargo Facility Hours */}
                                <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <LocalShippingIcon color="action" fontSize="small" />
                                        <Typography variant="subtitle2" color="text.secondary">
                                            Cargo Facility
                                        </Typography>
                                    </Box>
                                    {isCalculatingTimes ? (
                                        <CircularProgress size={20} />
                                    ) : cargoStatus ? (
                                        <>
                                            <Typography variant="h6" fontWeight={600}>
                                                {cargoStatus.hours}
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                {getStatusIcon(cargoStatus.icon, cargoStatus.class)}
                                                <Typography variant="body2" color="text.secondary">
                                                    {cargoStatus.text}
                                                </Typography>
                                            </Box>
                                        </>
                                    ) : null}
                                </Paper>

                                {/* Processing Time */}
                                <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <AccessTimeIcon color="action" fontSize="small" />
                                        <Typography variant="subtitle2" color="text.secondary">
                                            Processing Time
                                        </Typography>
                                    </Box>
                                    {isCalculatingTimes ? (
                                        <CircularProgress size={20} />
                                    ) : cargoProcessing ? (
                                        <Typography variant="h6" fontWeight={600}>
                                            {cargoProcessing.processingTimeMins} min
                                        </Typography>
                                    ) : null}
                                </Paper>

                                {/* Package Ready */}
                                <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <InventoryIcon color="action" fontSize="small" />
                                            <Typography variant="subtitle2" color="text.secondary">
                                                Package Ready
                                            </Typography>
                                        </Box>
                                        <IconButton size="small" onClick={() => setPackageTimeEditEnabled(!packageTimeEditEnabled)}>
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                    {isCalculatingTimes ? (
                                        <CircularProgress size={20} />
                                    ) : packageTimeEditEnabled ? (
                                        <DateTimePicker
                                            value={packageReadyTime}
                                            onChange={(newValue) => newValue && setPackageReadyTime(newValue)}
                                            slotProps={{
                                                textField: { size: 'small', fullWidth: true },
                                            }}
                                        />
                                    ) : packageReadyTime ? (
                                        <>
                                            <Typography variant="h6" fontWeight={600}>
                                                {packageReadyTime.format('HH:mm')}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {packageReadyTime.format('MMM D, YYYY')}
                                            </Typography>
                                            {cargoIndicator && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                    {getStatusIcon(cargoIndicator.icon, cargoIndicator.class)}
                                                    <Typography variant="body2" color="text.secondary">
                                                        {cargoIndicator.text}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </>
                                    ) : null}
                                </Paper>
                            </Box>
                        )}

                        {/* Warning Card */}
                        {showWarning && (
                            <Alert
                                severity="warning"
                                sx={{ '& .MuiAlert-message': { width: '100%' } }}
                            >
                                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                    Package Available After Cargo Hours
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 2 }}>
                                    {warningMessage}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={handleSetNextMorning}
                                    >
                                        Set to {nextMorningTime}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={handleSetBaggagePickup}
                                    >
                                        Baggage Carousel
                                    </Button>
                                </Box>
                            </Alert>
                        )}

                        {/* Delivery Section (Flight mode only) */}
                        {mode === 'flight' && (
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                {/* Deliver By */}
                                <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Deliver By
                                    </Typography>
                                    <DateTimePicker
                                        value={deliveryByTime}
                                        onChange={(newValue) => setDeliveryByTime(newValue)}
                                        slotProps={{
                                            textField: { size: 'small', fullWidth: true },
                                        }}
                                    />
                                    {!deliveryByTime && (
                                        <Button
                                            size="small"
                                            onClick={handleSetDeliveryTime}
                                            sx={{ mt: 1 }}
                                        >
                                            Set Default (+4 hours)
                                        </Button>
                                    )}
                                </Paper>

                                {/* Available Time */}
                                <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider' }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Available Time
                                    </Typography>
                                    {isCalculatingTimes ? (
                                        <CircularProgress size={20} />
                                    ) : availableTime ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {getStatusIcon(availableTime.icon, availableTime.class)}
                                            <Box>
                                                <Typography variant="h6" fontWeight={600}>
                                                    {availableTime.text}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {availableTime.subtext}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    ) : null}
                                </Paper>
                            </Box>
                        )}

                        <Divider />

                        {/* Delivery Notes */}
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Delivery Instructions"
                            placeholder="Add any delivery notes or instructions..."
                            value={deliveryNotes}
                            onChange={(e) => setDeliveryNotes(e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'white' } }}
                        />

                        {/* AWB and Stop Jobs */}
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                            <TextField
                                label="AWB Number"
                                value={awb}
                                onChange={(e) => setAwb(e.target.value)}
                                disabled={isAwbDisabled}
                                size="small"
                                sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: 'white' } }}
                            />
                            {showIncludeStopJobs && (
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={assignToStopJobs}
                                            onChange={(e) => setAssignToStopJobs(e.target.checked)}
                                        />
                                    }
                                    label={`Assign to ${stopJobCount} stop job${(stopJobCount ?? 0) > 1 ? 's' : ''}`}
                                />
                            )}
                        </Box>

                        {/* Dangerous Goods Alert */}
                        {dgClassName && (
                            <Alert severity="warning">
                                <Typography variant="subtitle2">
                                    Dangerous Goods: {dgClassName}
                                </Typography>
                            </Alert>
                        )}
                    </Box>
                </DialogContent>

                {/* Actions */}
                <DialogActions
                    sx={(theme) => ({
                        px: 3,
                        py: 2,
                        bgcolor: 'white',
                        borderTop: `1px solid ${theme.palette.divider}`,
                        gap: 1,
                    })}
                >
                    <Button onClick={onClose} variant="outlined" sx={{ minWidth: 100 }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        variant="contained"
                        color="primary"
                        disabled={mode === 'flight' && isCalculatingTimes}
                        sx={{ minWidth: 140 }}
                    >
                        Confirm Assignment
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default FlightAgentConfirmationDialog;
