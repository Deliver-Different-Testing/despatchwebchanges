/**
 * Flight Agent Confirmation Dialog
 *
 * React replacement for the AngularJS flight-agent-conformation-dialog.
 * Handles both flight and agent assignment confirmation with cargo processing calculations.
 */

import React, {useCallback, useEffect, useState} from 'react';
import {ActionIcon, Alert, Badge, Box, Button, Checkbox, Divider, Group, Loader, Paper, Stack, Text, Textarea, TextInput, Title} from '@mantine/core';
import {DateTimePicker} from '@mantine/dates';
import {ArrowRight, Ban, CircleAlert, CircleCheck, Clock, Pencil, TriangleAlert, User} from 'lucide-react';
import {IconPackage, IconPlane, IconTruck} from '@tabler/icons-react';
import {Icon} from '../../common/icon/Icon';
import dayjs, {Dayjs} from 'dayjs';
import duration from 'dayjs/plugin/duration';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import {
    AvailableTime,
    CargoIndicator,
    CargoStatus,
    FlightAgentConfirmationDialogProps,
    FlightAgentDialogResult,
    FlightCargoProcessing,
    FlightSegment,
} from './types';
import {
    AgentEmailFields,
    type AgentEmailState,
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    dialogSize,
    sectionPaperProps,
} from '../shared/mantine';

/**
 * `DateTimePicker` is string-valued, so these two fields are wall-clock end to end —
 * no instant is constructed and no zone is applied.
 */
const PICKER_VALUE_FORMAT = 'YYYY-MM-DD HH:mm';
const PICKER_DISPLAY_FORMAT = 'DD MMM YYYY HH:mm';

const pickerValue = (value: Dayjs | null): string | null =>
    value?.isValid() ? value.format(PICKER_VALUE_FORMAT) : null;

const applyPicked = (value: string | null, set: (next: Dayjs) => void): void => {
    const parsed = value ? dayjs(value) : null;
    if (parsed?.isValid()) {
        set(parsed);
    }
};

/** Glyphs the cargo calculation can name. */
const STATUS_ICONS: Record<string, typeof Clock> = {
    check_circle: CircleCheck,
    cancel: Ban,
    warning: TriangleAlert,
    error: CircleAlert,
    schedule: Clock,
};

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

// Format time as HH:mm with validation
function formatTime(time: Dayjs): string {
    if (!time || !time.isValid()) return '--:--';
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
                                                                                                flight,
                                                                                                agent,
                                                                                                existingAwb,
                                                                                                dgClass,
                                                                                                stopJobCount,
                                                                                                onClose,
                                                                                                onConfirm,
                                                                                                onCalculateCargoTimes,
                                                                                                showToast,
                                                                                            }) => {
    // Form state
    const [awb, setAwb] = useState('');
    const [assignToStopJobs, setAssignToStopJobs] = useState(false);
    const [deliveryNotes, setDeliveryNotes] = useState('');

    // Agent-email template (editable per-send; owned by AgentEmailFields, reported back here)
    const [agentEmail, setAgentEmail] = useState<AgentEmailState>({willEmail: false, subject: '', body: ''});
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
    const [_departureTimeZone, setDepartureTimeZone] = useState('');
    const [_arrivalTimeZone, setArrivalTimeZone] = useState('');

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

        // Use direct timestamp comparison instead of isBetween plugin to avoid bundling issues
        const pkgTime = packageReadyTime.valueOf();
        return pkgTime >= openingTimeOnPackageDate.valueOf() && pkgTime <= closingTimeOnPackageDate.valueOf();
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
            setAgentEmail({willEmail: false, subject: '', body: ''});
            setPackageTimeEditEnabled(false);
            setShowWarning(false);
            setCargoProcessing(null);
            setPackageReadyTime(null);
            setDeliveryByTime(null);

            // Process flight data if in flight mode
            if (mode === 'flight' && flight) {
                initializeLoadingStates();
                void processFlightData();
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
        const sendsAgentEmail = mode === 'agent' && agentEmail.willEmail;
        const result: FlightAgentDialogResult = {
            shouldAssign: true,
            awb: awb || undefined,
            shouldAssignToStopJobs: assignToStopJobs,
            packageReadyTime: packageReadyTime ?? undefined,
            packageDeliverByTime: deliveryByTime ?? undefined,
            packageDeliveryNotes: deliveryNotes || undefined,
            emailSubject: sendsAgentEmail ? agentEmail.subject : undefined,
            emailBody: sendsAgentEmail ? agentEmail.body : undefined,
        };
        onConfirm(result);
    };

    /*
     * The status glyph is chosen from a name the calculation supplies, so this is a
     * registry rather than a call site: it keeps its own table of direct imports and
     * stamps the name it resolved. Lucide emits no test hook of its own, where MUI
     * auto-generated data-testid="CheckCircleIcon".
     */
    const getStatusIcon = (iconName: string, className: string) => {
        const color = className.includes('valid') || className.includes('sufficient') || className.includes('open')
            ? 'green'
            : className.includes('warning')
                ? 'yellow'
                : className.includes('critical') || className.includes('invalid') || className.includes('closed') || className.includes('error')
                    ? 'red'
                    : undefined;

        const glyph = STATUS_ICONS[iconName] ?? Clock;
        // 'schedule' is neutral by definition — it reports a time, not a verdict.
        const tone = iconName === 'schedule' || !STATUS_ICONS[iconName] ? undefined : color;

        return <Icon lucide={glyph} color={tone && `var(--mantine-color-${tone}-filled)`} data-status-icon={iconName}/>;
    };

    return (
        <DialogShell
            opened={open}
            onClose={onClose}
            size={dialogSize.md}
            label={dialogTitle}
        >
            <DialogHeader
                icon={mode === 'flight' ? <Icon tabler={IconPlane}/> : <Icon lucide={User}/>}
                title={dialogTitle}
                subtitle={
                    mode === 'flight' && departureAirport && arrivalAirport
                        ? `${departureAirport} → ${arrivalAirport}`
                        : undefined
                }
                onClose={onClose}
            />

            {/* Content */}
            <Stack bg={dialogContentBg} p={24} gap={24}>
                {/* Flight Route Section */}
                {mode === 'flight' && flight && (
                    <Paper {...sectionPaperProps}>
                        <Group justify="space-between" wrap="nowrap">
                            {/* Departure. The airport codes stay Ink rather than
                                taking the brand tint — both brand primaries are too
                                light to carry text on this surface. */}
                            <Box ta="center" style={{flex: 1}}>
                                <Title order={3} fw={700}>{departureAirport}</Title>
                                {departureTime && (
                                    <Text fz="sm" c="dimmed">
                                        {departureTime.format('MMM D, HH:mm')}
                                    </Text>
                                )}
                            </Box>

                            {/* Arrow and Flight Number */}
                            <Stack align="center" gap={4} px={24}>
                                <Badge
                                    size="lg"
                                    variant="light"
                                    leftSection={<Icon tabler={IconPlane} size={14}/>}
                                >
                                    {flightNumber}
                                </Badge>
                                <Icon lucide={ArrowRight} size={32} color="var(--mantine-color-dimmed)"/>
                            </Stack>

                            {/* Arrival */}
                            <Box ta="center" style={{flex: 1}}>
                                <Title order={3} fw={700}>{arrivalAirport}</Title>
                                {arrivalTime && (
                                    <Text fz="sm" c="dimmed">
                                        {arrivalTime.format('MMM D, HH:mm')}
                                    </Text>
                                )}
                            </Box>
                        </Group>
                    </Paper>
                )}

                {/* Cargo Processing Section (Flight mode only) */}
                {mode === 'flight' && (
                    <Group gap={16} align="stretch" grow>
                        {/* Cargo Facility Hours */}
                        <Paper {...sectionPaperProps}>
                            <Group gap={8} mb={8} c="dimmed">
                                <Icon tabler={IconTruck} size={18}/>
                                <Text fz="sm">Cargo Facility</Text>
                            </Group>
                            {isCalculatingTimes ? (
                                <Loader size={20} aria-label="Calculating cargo facility hours"/>
                            ) : cargoStatus ? (
                                <>
                                    <Text fz="lg" fw={600}>{cargoStatus.hours}</Text>
                                    <Group gap={4} mt={4}>
                                        {getStatusIcon(cargoStatus.icon, cargoStatus.class)}
                                        <Text fz="sm" c="dimmed">{cargoStatus.text}</Text>
                                    </Group>
                                </>
                            ) : null}
                        </Paper>

                        {/* Processing Time */}
                        <Paper {...sectionPaperProps}>
                            <Group gap={8} mb={8} c="dimmed">
                                <Icon lucide={Clock} size={18}/>
                                <Text fz="sm">Processing Time</Text>
                            </Group>
                            {isCalculatingTimes ? (
                                <Loader size={20} aria-label="Calculating processing time"/>
                            ) : cargoProcessing ? (
                                <Text fz="lg" fw={600}>{cargoProcessing.processingTimeMins} min</Text>
                            ) : null}
                        </Paper>

                        {/* Package Ready */}
                        <Paper {...sectionPaperProps}>
                            <Group justify="space-between" wrap="nowrap" mb={8}>
                                <Group gap={8} c="dimmed">
                                    <Icon tabler={IconPackage} size={18}/>
                                    <Text fz="sm">Package Ready</Text>
                                </Group>
                                <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    aria-label="Edit package ready time"
                                    onClick={() => setPackageTimeEditEnabled(!packageTimeEditEnabled)}
                                >
                                    <Icon lucide={Pencil} size={16}/>
                                </ActionIcon>
                            </Group>
                            {isCalculatingTimes ? (
                                <Loader size={20} aria-label="Calculating package ready time"/>
                            ) : packageTimeEditEnabled ? (
                                <DateTimePicker
                                    aria-label="Package ready"
                                    value={pickerValue(packageReadyTime)}
                                    onChange={(value) => applyPicked(value, setPackageReadyTime)}
                                    valueFormat={PICKER_DISPLAY_FORMAT}
                                    timePickerProps={{format: '24h', withDropdown: true}}
                                    size="sm"
                                />
                            ) : packageReadyTime ? (
                                <>
                                    <Text fz="lg" fw={600}>{packageReadyTime.format('HH:mm')}</Text>
                                    <Text fz="sm" c="dimmed">{packageReadyTime.format('MMM D, YYYY')}</Text>
                                    {cargoIndicator && (
                                        <Group gap={4} mt={4}>
                                            {getStatusIcon(cargoIndicator.icon, cargoIndicator.class)}
                                            <Text fz="sm" c="dimmed">{cargoIndicator.text}</Text>
                                        </Group>
                                    )}
                                </>
                            ) : null}
                        </Paper>
                    </Group>
                )}

                {/* Warning Card */}
                {showWarning && (
                    <Alert color="yellow" variant="light" title="Package Available After Cargo Hours">
                        <Text fz="sm" mb={16}>{warningMessage}</Text>
                        <Group gap={8}>
                            <Button variant="default" size="xs" onClick={handleSetNextMorning}>
                                Set to {nextMorningTime}
                            </Button>
                            <Button variant="default" size="xs" onClick={handleSetBaggagePickup}>
                                Baggage Carousel
                            </Button>
                        </Group>
                    </Alert>
                )}

                {/* Delivery Section (Flight mode only) */}
                {mode === 'flight' && (
                    <Group gap={16} align="stretch" grow>
                        {/* Deliver By */}
                        <Paper {...sectionPaperProps}>
                            <Text fz="sm" c="dimmed" mb={8}>Deliver By</Text>
                            <DateTimePicker
                                aria-label="Deliver by"
                                value={pickerValue(deliveryByTime)}
                                onChange={(value) => applyPicked(value, setDeliveryByTime)}
                                valueFormat={PICKER_DISPLAY_FORMAT}
                                timePickerProps={{format: '24h', withDropdown: true}}
                                size="sm"
                            />
                            {!deliveryByTime && (
                                <Button variant="subtle" size="xs" mt={8} onClick={handleSetDeliveryTime}>
                                    Set Default (+4 hours)
                                </Button>
                            )}
                        </Paper>

                        {/* Available Time */}
                        <Paper {...sectionPaperProps}>
                            <Text fz="sm" c="dimmed" mb={8}>Available Time</Text>
                            {isCalculatingTimes ? (
                                <Loader size={20} aria-label="Calculating available time"/>
                            ) : availableTime ? (
                                <Group gap={8} wrap="nowrap">
                                    {getStatusIcon(availableTime.icon, availableTime.class)}
                                    <Box>
                                        <Text fz="lg" fw={600}>{availableTime.text}</Text>
                                        <Text fz="sm" c="dimmed">{availableTime.subtext}</Text>
                                    </Box>
                                </Group>
                            ) : null}
                        </Paper>
                    </Group>
                )}

                <Divider/>

                {mode === 'agent' && agent && (
                    <AgentEmailFields
                        key={`${agent.id}-${jobId}`}
                        agentId={agent.id}
                        jobId={jobId}
                        onChange={setAgentEmail}
                    />
                )}

                {/* Delivery Notes */}
                <Textarea
                    rows={3}
                    label="Delivery Instructions"
                    placeholder="Add any delivery notes or instructions..."
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.currentTarget.value)}
                />

                {/* AWB and Stop Jobs */}
                <Group gap={16} align="flex-end" wrap="nowrap">
                    <TextInput
                        label="AWB Number"
                        style={{flex: 1}}
                        value={awb}
                        onChange={(e) => setAwb(e.currentTarget.value)}
                        disabled={isAwbDisabled}
                    />
                    {showIncludeStopJobs && (
                        <Checkbox
                            checked={assignToStopJobs}
                            onChange={(e) => setAssignToStopJobs(e.currentTarget.checked)}
                            label={`Assign to ${stopJobCount} stop job${(stopJobCount ?? 0) > 1 ? 's' : ''}`}
                        />
                    )}
                </Group>

                {/* Dangerous Goods Alert */}
                {dgClassName && (
                    <Alert color="yellow" variant="light">
                        <Text fz="sm" fw={600}>Dangerous Goods: {dgClassName}</Text>
                    </Alert>
                )}
            </Stack>

            <DialogFooter
                onCancel={onClose}
                onConfirm={handleConfirm}
                confirmLabel="Confirm Assignment"
                confirmDisabled={mode === 'flight' && isCalculatingTimes}
            />
        </DialogShell>
    );
};

export default FlightAgentConfirmationDialog;
