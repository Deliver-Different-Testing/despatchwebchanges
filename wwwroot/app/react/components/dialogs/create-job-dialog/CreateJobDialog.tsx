/**
 * Create Job Dialog
 *
 * Grouped by what the operator is deciding, not by field type: **Job** (who pays,
 * what it costs), **Route** (the two legs of the journey), **Service** (how it
 * moves) and an optional **References & notes**. The address, contact and notes
 * for one leg sit together — they used to be spread across three sections.
 *
 * A failed submit reports every incomplete field at once through a summary that
 * jumps to each one, rather than a toast per failure.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    Alert,
    Anchor,
    Badge,
    Box,
    Divider,
    Flex,
    Group,
    NumberInput,
    Paper,
    Select,
    SimpleGrid,
    Stack,
    Text,
    TextInput,
    Textarea,
    ThemeIcon,
    alpha,
} from '@mantine/core';
import {DateInput} from '@mantine/dates';
import {ArrowDown, ArrowRight, CircleAlert, Plus} from 'lucide-react';
import {IconFlag, IconMapPin, IconTruck} from '@tabler/icons-react';
import type {LucideIcon, TablerIcon} from '../../common/icon/Icon';
import {Icon} from '../../common/icon/Icon';
import {SearchSelect} from '../../common/search-select/SearchSelect';
import {MARKER_COLORS} from '../../common/dispatch-map/DispatchMap.types';
import type {CourierSuggestion} from '../../../interfaces';
import {
    AddressViewModel,
    CreateJobRequest,
    HereMapsLocationResult,
    HereMapsLookupResponse,
    Suggestion,
} from '../../../interfaces';
import {useAddressSearch} from '../../../hooks/useAddressApi';
import {useClientSearch, useVehicleSizes} from '../../../hooks/useJobApi';
import {useCourierSearch} from '../../../hooks/useCourierApi';
import {useSpeedList} from '../../../hooks/useRecurringJobsApi';
import {addressApi} from '../../../services/addressApi';
import {jobApi} from '../../../services/jobApi';
import {formatCurrency} from '../../../utils/currencyUtils';
import {dayjs, formatDateForApi, getIanaTimezone, getInputDateFormat} from '../../../utils/dateUtils';
import {getStateByAbbreviation} from '../../../utils/usStates';
import type {Dayjs} from 'dayjs';
import type {ShowToastFn} from '../../../services/toastService';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    dialogSize,
    sectionLabelProps,
    sectionPaperProps,
} from '../shared/mantine';

/** The string form `DateInput` exchanges values in. */
const ISO_DATE = 'YYYY-MM-DD';

const NOTES_MAX = 150;
const REFERENCE_MAX = 20;

/** How full a capped field has to be before its counter is worth the ink. */
const COUNTER_THRESHOLD = 0.75;

/**
 * Anchors for the summary shortcuts. They sit on a wrapper rather than the input
 * because `SearchSelect` owns its own input and takes no `id`.
 */
const FIELD = {
    client: 'create-job-client',
    charge: 'create-job-charge',
    weight: 'create-job-weight',
    pickupAddress: 'create-job-pickup-address',
    pickupContact: 'create-job-pickup-contact',
    deliveryAddress: 'create-job-delivery-address',
    deliveryContact: 'create-job-delivery-contact',
    podName: 'create-job-pod-name',
    vehicle: 'create-job-vehicle',
    speed: 'create-job-speed',
    jobDate: 'create-job-date',
} as const;

/** A field the operator still has to fill in, and where to find it. */
interface MissingField {
    anchor: string;
    label: string;
}

const isPositiveNumber = (value: string): boolean => {
    const parsed = parseFloat(value);
    return value !== '' && Number.isFinite(parsed) && parsed > 0;
};

/** Moves the operator to a field named in the error summary. */
const focusField = (anchor: string): void => {
    const host = document.getElementById(anchor);
    if (!host) return;
    host.scrollIntoView?.({block: 'center'});
    host.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, button')?.focus();
};

/** A section: the house quiet label, then the white card the fields sit on. */
const Section: React.FC<{
    title: string;
    aside?: React.ReactNode;
    children: React.ReactNode;
}> = ({title, aside, children}) => (
    <Box>
        <Group justify="space-between" align="center" mb="xs" wrap="nowrap">
            <Text {...sectionLabelProps} mb={0}>{title}</Text>
            {aside}
        </Group>
        <Paper {...sectionPaperProps}>{children}</Paper>
    </Box>
);

/** Wraps a field so the error summary has something to scroll to and focus. */
const Field: React.FC<{anchor: string; children: React.ReactNode}> = ({anchor, children}) => (
    <Box id={anchor} miw={0}>{children}</Box>
);

/**
 * A leg's marker: the same blue pickup / green delivery the dispatch map paints,
 * so the route reads the same way in the dialog as it does on the board.
 */
const LegHeader: React.FC<{color: string; glyph: TablerIcon; label: string}> = ({color, glyph, label}) => (
    <Group gap={8} wrap="nowrap">
        <ThemeIcon
            size={26}
            radius="md"
            style={{
                '--ti-bg': alpha(color, 0.14),
                '--ti-color': color,
            } as React.CSSProperties & Record<`--${string}`, string>}
        >
            <Icon tabler={glyph} size={15}/>
        </ThemeIcon>
        <Text fz={11} fw={700} tt="uppercase" lts={0.8} c="dimmed">{label}</Text>
    </Group>
);

/** The rail between the two legs — decorative; the leg headers carry the meaning. */
const RouteConnector: React.FC = () => {
    const chip = (glyph: LucideIcon) => (
        <ThemeIcon size={26} radius="xl" variant="light" color="gray">
            <Icon lucide={glyph} size={14}/>
        </ThemeIcon>
    );
    return (
        <>
            <Stack visibleFrom="sm" w={34} gap={6} align="center" aria-hidden>
                <Divider orientation="vertical" style={{flexGrow: 1}}/>
                {chip(ArrowRight)}
                <Divider orientation="vertical" style={{flexGrow: 1}}/>
            </Stack>
            <Group hiddenFrom="sm" gap={6} wrap="nowrap" aria-hidden>
                <Divider style={{flexGrow: 1}}/>
                {chip(ArrowDown)}
                <Divider style={{flexGrow: 1}}/>
            </Group>
        </>
    );
};

/** Stays hidden until the cap is within reach, so the resting form stays quiet. */
const CharCount: React.FC<{value: string; max: number}> = ({value, max}) => {
    if (value.length < max * COUNTER_THRESHOLD) return null;
    return (
        <Text fz="xs" ta="right" mt={4} c={value.length >= max ? 'red' : 'dimmed'}>
            {value.length}/{max}
        </Text>
    );
};

export interface CreateJobDialogProps {
    open: boolean;
    isUsTenant: boolean;
    onClose: () => void;
    onSubmit: (newJobId: number) => void;
    showToast: ShowToastFn;
}

export const CreateJobDialog: React.FC<CreateJobDialogProps> = ({
    open,
    isUsTenant,
    onClose,
    onSubmit,
    showToast,
}) => {
    // Form state - Job
    const [selectedClient, setSelectedClient] = useState<Suggestion | null>(null);
    const [clientSearchText, setClientSearchText] = useState('');
    const [charge, setCharge] = useState<string>('');
    const [weight, setWeight] = useState<string>('');
    const [jobDate, setJobDate] = useState<Dayjs>(dayjs().tz(getIanaTimezone()));

    // Form state - Route
    const [fromAddressSearchText, setFromAddressSearchText] = useState('');
    const [toAddressSearchText, setToAddressSearchText] = useState('');
    const [selectedPickupAddress, setSelectedPickupAddress] = useState<HereMapsLocationResult | null>(null);
    const [selectedDeliveryAddress, setSelectedDeliveryAddress] = useState<HereMapsLocationResult | null>(null);
    const [pickupContact, setPickupContact] = useState('');
    const [deliveryContact, setDeliveryContact] = useState('');
    const [podName, setPodName] = useState('');
    const [pickupNotes, setPickupNotes] = useState('');
    const [deliveryNotes, setDeliveryNotes] = useState('');

    // Form state - Service
    const [selectedVehicle, setSelectedVehicle] = useState<Suggestion | null>(null);
    const [selectedSpeed, setSelectedSpeed] = useState<Suggestion | null>(null);
    const [selectedCourier, setSelectedCourier] = useState<CourierSuggestion | null>(null);
    const [courierSearchText, setCourierSearchText] = useState('');

    // Form state - References & notes
    const [refA, setRefA] = useState('');
    const [refB, setRefB] = useState('');
    const [jobNotes, setJobNotes] = useState('');

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [touched, setTouched] = useState(false);
    const [submitAttempt, setSubmitAttempt] = useState(0);
    const summaryRef = useRef<HTMLDivElement>(null);

    const weightLabel = isUsTenant ? 'Weight (lb)' : 'Weight (kg)';

    /* The tenant's currency marker, taken from the same formatter the rest of the
       app prices with rather than a symbol table of our own. */
    const currencySymbol = useMemo(() => formatCurrency(0).replace(/[\d\s.,\u00a0]/g, ''), []);

    // React Query hooks
    const {data: clientOptions = [], isFetching: isSearchingClients} = useClientSearch(
        clientSearchText,
        {enabled: open}
    );
    const {data: courierOptions = [], isFetching: isSearchingCouriers} = useCourierSearch(
        courierSearchText,
        {enabled: open}
    );
    const {data: fromAddressOptions = [], isFetching: isSearchingFromAddress} = useAddressSearch(
        fromAddressSearchText,
        {enabled: open}
    );
    const {data: toAddressOptions = [], isFetching: isSearchingToAddress} = useAddressSearch(
        toAddressSearchText,
        {enabled: open}
    );
    const {data: vehicleSizes = []} = useVehicleSizes({enabled: open});
    const {data: speedOptions = []} = useSpeedList({enabled: open});

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedClient(null);
            setClientSearchText('');
            setCharge('');
            setWeight('');
            setSelectedCourier(null);
            setCourierSearchText('');
            setJobDate(dayjs().tz(getIanaTimezone()));
            setFromAddressSearchText('');
            setToAddressSearchText('');
            setSelectedPickupAddress(null);
            setSelectedDeliveryAddress(null);
            setPickupContact('');
            setDeliveryContact('');
            setPodName('');
            setSelectedVehicle(null);
            setSelectedSpeed(null);
            setRefA('');
            setRefB('');
            setJobNotes('');
            setPickupNotes('');
            setDeliveryNotes('');
            setIsLoading(false);
            setTouched(false);
            setSubmitAttempt(0);
        }
    }, [open]);

    // Map HERE Maps lookup response to AddressViewModel
    const processAddress = useCallback(async (
        item: HereMapsLocationResult
    ): Promise<{address: AddressViewModel; lat: number; lng: number} | null> => {
        try {
            if (!item?.id) return null;

            const location: HereMapsLookupResponse = await addressApi.getLocationDetailsById(item.id);
            if (!location) return null;

            const addr = location.address;

            // Street name from streetInfo (same logic as EditAddressDialog)
            let streetName = addr.street || '';
            if (location.streetInfo && location.streetInfo.length > 0) {
                const si = location.streetInfo[0];
                let formatted = '';
                if (si.prefix) formatted += si.prefix + ' ';
                if (si.streetTypePrecedes && si.streetType) formatted += si.streetType + ' ';
                formatted += si.baseName;
                if (!si.streetTypePrecedes && si.streetType) formatted += ' ' + si.streetType;
                if (si.suffix) formatted += ' ' + si.suffix;
                streetName = formatted.trim();
            }

            let line5: string;
            let line6: string;
            let line7: string;

            if (isUsTenant) {
                line5 = addr.city || '';
                line6 = addr.stateCode || addr.state || '';
                // Map state abbreviation to full name for addressLine6
                if (addr.stateCode) {
                    const stateObj = getStateByAbbreviation(addr.stateCode);
                    if (stateObj) {
                        line6 = stateObj.name;
                    }
                }
                // ZIP: first 5 digits
                const zipMatch = addr.postalCode?.match(/^(\d{5})/);
                line7 = zipMatch ? zipMatch[1] : (addr.postalCode || '');
            } else {
                line5 = addr.district || '';
                line6 = addr.city || '';
                line7 = addr.postalCode || '';
            }

            const addressVm: AddressViewModel = {
                addressLine1: location.title || '',
                addressLine2: '',
                addressLine3: addr.houseNumber || '',
                addressLine4: streetName,
                addressLine5: line5,
                addressLine6: line6,
                addressLine7: line7,
                addressLine8: addr.countryName || '',
                latitude: location.position.lat,
                longitude: location.position.lng,
                fullAddress: addr.label || location.title || '',
            };

            return {address: addressVm, lat: location.position.lat, lng: location.position.lng};
        } catch (error) {
            console.error('[CreateJobDialog] Error processing address:', error);
            return null;
        }
    }, [isUsTenant]);

    /* Every gap at once — the operator fixes the form in one pass instead of
       resubmitting to discover the next missing field. */
    const missingFields = useMemo<MissingField[]>(() => {
        const missing: MissingField[] = [];
        if (!selectedClient) missing.push({anchor: FIELD.client, label: 'Client'});
        if (!isPositiveNumber(charge)) missing.push({anchor: FIELD.charge, label: 'Charge Amount'});
        if (!isPositiveNumber(weight)) missing.push({anchor: FIELD.weight, label: weightLabel});
        if (!jobDate?.isValid()) missing.push({anchor: FIELD.jobDate, label: 'Job Date'});
        if (!selectedPickupAddress) missing.push({anchor: FIELD.pickupAddress, label: 'Pickup Address'});
        if (!pickupContact.trim()) missing.push({anchor: FIELD.pickupContact, label: 'Pickup Contact'});
        if (!selectedDeliveryAddress) missing.push({anchor: FIELD.deliveryAddress, label: 'Delivery Address'});
        if (!deliveryContact.trim()) missing.push({anchor: FIELD.deliveryContact, label: 'Delivery Contact'});
        if (!podName.trim()) missing.push({anchor: FIELD.podName, label: 'POD Name'});
        if (!selectedVehicle) missing.push({anchor: FIELD.vehicle, label: 'Vehicle'});
        if (!selectedSpeed) missing.push({anchor: FIELD.speed, label: 'Speed'});
        return missing;
    }, [selectedClient, charge, weight, weightLabel, jobDate, selectedPickupAddress, pickupContact,
        selectedDeliveryAddress, deliveryContact, podName, selectedVehicle, selectedSpeed]);

    const showSummary = touched && missingFields.length > 0;

    // The summary is the response to pressing Create Job, so bring it into view.
    useEffect(() => {
        if (submitAttempt > 0) summaryRef.current?.scrollIntoView?.({block: 'nearest'});
    }, [submitAttempt]);

    // Submit handler
    const handleSubmit = useCallback(async () => {
        if (isLoading) return;

        setTouched(true);

        if (missingFields.length > 0) {
            setSubmitAttempt(attempt => attempt + 1);
            return;
        }

        setIsLoading(true);

        try {
            // Process pickup address
            const pickupResult = await processAddress(selectedPickupAddress!);
            if (!pickupResult) {
                showToast('An error occurred processing the pickup address. Please try again.', 'error');
                return;
            }

            // Process delivery address
            const deliveryResult = await processAddress(selectedDeliveryAddress!);
            if (!deliveryResult) {
                showToast('An error occurred processing the delivery address. Please try again.', 'error');
                return;
            }

            const job: CreateJobRequest = {
                clientId: selectedClient!.id,
                deliverToContact: deliveryContact.trim(),
                podName: podName.trim(),
                pickUpAddress: pickupResult.address,
                deliveryAddress: deliveryResult.address,
                date: formatDateForApi(jobDate),
                fromContactName: pickupContact.trim(),
                refA,
                refB,
                deliveryNotes,
                pickupNotes,
                jobNotes,
                van: false,
                truck: false,
                pedal: false,
                attention: false,
                vanOk: false,
                reprice: false,
                void: false,
                done: false,
                charge: parseFloat(charge),
                fromLat: pickupResult.lat,
                fromLong: pickupResult.lng,
                toLat: deliveryResult.lat,
                toLong: deliveryResult.lng,
                speedId: selectedSpeed!.id,
                vehicleId: selectedVehicle!.id,
                weightKg: isUsTenant ? null : parseFloat(weight),
                weightLb: isUsTenant ? parseFloat(weight) : null,
            };

            // Create the job
            const {jobId: newJobId, jobNumber} = await jobApi.quickCreateJob(job);

            // Hand the operator the job number to paste elsewhere. The job exists either
            // way, so a clipboard refusal (insecure context, unfocused document) only
            // changes what the toast says.
            let copied = false;
            try {
                await navigator.clipboard.writeText(jobNumber);
                copied = true;
            } catch (clipboardError) {
                console.warn('[CreateJobDialog] Could not copy the job number:', clipboardError);
            }
            const copySuffix = copied ? ' (job number copied)' : '';

            // Handle optional courier dispatch
            if (selectedCourier) {
                try {
                    await jobApi.allocateJobToCourier(selectedCourier.id, [newJobId]);
                    showToast(`Job ${jobNumber} created and dispatched successfully${copySuffix}`, 'success');
                } catch (dispatchError) {
                    console.error('[CreateJobDialog] Courier dispatch failed:', dispatchError);
                    showToast(`Job ${jobNumber} created successfully, but could not be dispatched to the courier. The courier may be offline.`, 'warning');
                }
            } else {
                showToast(`Job ${jobNumber} created successfully${copySuffix}`, 'success');
            }

            onSubmit(newJobId);
        } catch (error) {
            console.error('[CreateJobDialog] Job creation failed:', error);
            const serverMessage = (() => {
                const data = (error as {response?: {data?: unknown}})?.response?.data;
                if (typeof data === 'string' && data.trim()) return data;
                if (data && typeof data === 'object' && 'message' in data && typeof (data as {message: unknown}).message === 'string') {
                    return (data as {message: string}).message;
                }
                return null;
            })();
            showToast(serverMessage || 'Failed to create job. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, missingFields, processAddress, selectedPickupAddress, selectedDeliveryAddress,
        selectedClient, deliveryContact, podName, jobDate, pickupContact, refA, refB,
        deliveryNotes, pickupNotes, jobNotes, charge, weight, isUsTenant, selectedSpeed, selectedVehicle,
        selectedCourier, onSubmit, showToast]);

    // Filter vehicle/speed options locally
    /* Mantine's Select filters a loaded list itself, so the two pickers need no
       search text of their own — only the id round-trip back to the option. */
    const toOptions = (items: Suggestion[]) => items.map(i => ({value: String(i.id), label: i.text}));
    const findById = (items: Suggestion[], id: string | null) =>
        items.find(i => String(i.id) === id) ?? null;

    if (!open) return null;

    return (
        <DialogShell
            opened={open}
            onClose={isLoading ? () => undefined : onClose}
            size={dialogSize.lg}
            label="Add New Job"
        >
            <DialogHeader
                icon={<Icon tabler={IconTruck}/>}
                title="Add New Job"
                subtitle="Create a new dispatch job"
                onClose={onClose}
                closeDisabled={isLoading}
            />
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Stack gap="lg">
                    {showSummary && (
                        <Alert
                            ref={summaryRef}
                            color="red"
                            variant="light"
                            icon={<Icon lucide={CircleAlert}/>}
                            title={`Complete ${missingFields.length} field${missingFields.length === 1 ? '' : 's'} to create this job`}
                        >
                            <Group gap={6}>
                                {missingFields.map(field => (
                                    <Anchor
                                        key={field.anchor}
                                        component="button"
                                        type="button"
                                        fz="sm"
                                        onClick={() => focusField(field.anchor)}
                                    >
                                        {field.label}
                                    </Anchor>
                                ))}
                            </Group>
                        </Alert>
                    )}

                    <Section title="Job">
                        <Stack gap="md">
                            {/*
                              * SearchSelect, not Mantine's Autocomplete: these four
                              * pickers carry an object and search the server, where
                              * Autocomplete is string-valued and filters only what it
                              * already holds.
                              */}
                            <Field anchor={FIELD.client}>
                                <SearchSelect
                                    label="Client"
                                    placeholder="Start typing to search clients"
                                    withAsterisk
                                    minSearchLength={3}
                                    value={selectedClient}
                                    onChange={setSelectedClient}
                                    options={clientOptions}
                                    loading={isSearchingClients}
                                    onSearchChange={setClientSearchText}
                                    getOptionKey={(o) => o.id}
                                    getOptionLabel={(o) => o.text}
                                    error={touched && !selectedClient ? 'Client is required.' : undefined}
                                />
                            </Field>
                            <SimpleGrid cols={{base: 1, sm: 3}} spacing="md">
                                <Field anchor={FIELD.charge}>
                                    <NumberInput
                                        label="Charge Amount"
                                        withAsterisk
                                        min={0.01}
                                        step={0.01}
                                        decimalScale={2}
                                        leftSection={<Text fz="sm" c="dimmed">{currencySymbol}</Text>}
                                        leftSectionWidth={Math.max(32, 14 + currencySymbol.length * 9)}
                                        leftSectionPointerEvents="none"
                                        value={charge}
                                        onChange={(value) => setCharge(String(value))}
                                        error={touched && !isPositiveNumber(charge)
                                            ? 'Charge must be greater than 0.' : undefined}
                                    />
                                </Field>
                                <Field anchor={FIELD.weight}>
                                    <NumberInput
                                        label={weightLabel}
                                        withAsterisk
                                        min={0}
                                        value={weight}
                                        onChange={(value) => setWeight(String(value))}
                                        error={touched && !isPositiveNumber(weight)
                                            ? 'Weight must be greater than 0.' : undefined}
                                    />
                                </Field>
                                {/* `DateInput` is string-valued (`YYYY-MM-DD`), so the job date
                                    stays a calendar date all the way to `formatDateForApi`. */}
                                <Field anchor={FIELD.jobDate}>
                                    <DateInput
                                        label="Job Date"
                                        withAsterisk
                                        value={jobDate?.isValid() ? jobDate.format(ISO_DATE) : null}
                                        onChange={(value) => {
                                            if (value) setJobDate(dayjs(value));
                                        }}
                                        valueFormat={getInputDateFormat()}
                                        placeholder={getInputDateFormat()}
                                        error={touched && !jobDate?.isValid() ? 'Job date is required.' : undefined}
                                    />
                                </Field>
                            </SimpleGrid>
                        </Stack>
                    </Section>

                    <Section title="Route">
                        <Flex direction={{base: 'column', sm: 'row'}} gap="md" align="stretch">
                            <Stack flex={1} miw={0} gap="md">
                                <LegHeader color={MARKER_COLORS.PICKUP} glyph={IconMapPin} label="Pickup"/>
                                <Field anchor={FIELD.pickupAddress}>
                                    <SearchSelect
                                        label="Pickup Address"
                                        placeholder="Start typing to search addresses"
                                        withAsterisk
                                        minSearchLength={3}
                                        value={selectedPickupAddress}
                                        onChange={setSelectedPickupAddress}
                                        options={fromAddressOptions}
                                        loading={isSearchingFromAddress}
                                        onSearchChange={setFromAddressSearchText}
                                        getOptionKey={(o) => o.id}
                                        getOptionLabel={(o) => o.address.label}
                                        error={touched && !selectedPickupAddress ? 'Pickup address is required.' : undefined}
                                    />
                                </Field>
                                <Field anchor={FIELD.pickupContact}>
                                    <TextInput
                                        label="Pickup Contact"
                                        withAsterisk
                                        value={pickupContact}
                                        onChange={(e) => setPickupContact(e.currentTarget.value)}
                                        error={touched && !pickupContact.trim() ? 'Pickup contact is required.' : undefined}
                                    />
                                </Field>
                                <Box>
                                    <Textarea
                                        label="Pickup Notes"
                                        autosize
                                        minRows={2}
                                        maxRows={4}
                                        maxLength={NOTES_MAX}
                                        value={pickupNotes}
                                        onChange={(e) => setPickupNotes(e.currentTarget.value)}
                                    />
                                    <CharCount value={pickupNotes} max={NOTES_MAX}/>
                                </Box>
                            </Stack>

                            <RouteConnector/>

                            <Stack flex={1} miw={0} gap="md">
                                <LegHeader color={MARKER_COLORS.DELIVERY} glyph={IconFlag} label="Delivery"/>
                                <Field anchor={FIELD.deliveryAddress}>
                                    <SearchSelect
                                        label="Delivery Address"
                                        placeholder="Start typing to search addresses"
                                        withAsterisk
                                        minSearchLength={3}
                                        value={selectedDeliveryAddress}
                                        onChange={setSelectedDeliveryAddress}
                                        options={toAddressOptions}
                                        loading={isSearchingToAddress}
                                        onSearchChange={setToAddressSearchText}
                                        getOptionKey={(o) => o.id}
                                        getOptionLabel={(o) => o.address.label}
                                        error={touched && !selectedDeliveryAddress ? 'Delivery address is required.' : undefined}
                                    />
                                </Field>
                                <SimpleGrid cols={{base: 1, md: 2}} spacing="md">
                                    <Field anchor={FIELD.deliveryContact}>
                                        <TextInput
                                            label="Delivery Contact"
                                            withAsterisk
                                            value={deliveryContact}
                                            onChange={(e) => setDeliveryContact(e.currentTarget.value)}
                                            error={touched && !deliveryContact.trim() ? 'Delivery contact is required.' : undefined}
                                        />
                                    </Field>
                                    <Field anchor={FIELD.podName}>
                                        <TextInput
                                            label="POD Name"
                                            withAsterisk
                                            value={podName}
                                            onChange={(e) => setPodName(e.currentTarget.value)}
                                            error={touched && !podName.trim() ? 'POD name is required.' : undefined}
                                        />
                                    </Field>
                                </SimpleGrid>
                                <Box>
                                    <Textarea
                                        label="Delivery Notes"
                                        autosize
                                        minRows={2}
                                        maxRows={4}
                                        maxLength={NOTES_MAX}
                                        value={deliveryNotes}
                                        onChange={(e) => setDeliveryNotes(e.currentTarget.value)}
                                    />
                                    <CharCount value={deliveryNotes} max={NOTES_MAX}/>
                                </Box>
                            </Stack>
                        </Flex>
                    </Section>

                    <Section title="Service">
                        <Stack gap="md">
                        <SimpleGrid cols={{base: 1, sm: 2}} spacing="md">
                            <Field anchor={FIELD.vehicle}>
                                <Select
                                    label="Vehicle"
                                    withAsterisk
                                    searchable
                                    nothingFoundMessage="No vehicles found"
                                    comboboxProps={{keepMounted: false}}
                                    data={toOptions(vehicleSizes)}
                                    value={selectedVehicle ? String(selectedVehicle.id) : null}
                                    onChange={(value) => setSelectedVehicle(findById(vehicleSizes, value))}
                                    error={touched && !selectedVehicle ? 'Vehicle is required.' : undefined}
                                />
                            </Field>
                            <Field anchor={FIELD.speed}>
                                <Select
                                    label="Speed"
                                    withAsterisk
                                    searchable
                                    nothingFoundMessage="No speeds found"
                                    comboboxProps={{keepMounted: false}}
                                    data={toOptions(speedOptions)}
                                    value={selectedSpeed ? String(selectedSpeed.id) : null}
                                    onChange={(value) => setSelectedSpeed(findById(speedOptions, value))}
                                    error={touched && !selectedSpeed ? 'Speed is required.' : undefined}
                                />
                            </Field>
                        </SimpleGrid>
                        <SearchSelect
                            label="Courier"
                            placeholder="Start typing to search couriers"
                            description="Dispatch now, or leave empty to assign later."
                            minSearchLength={2}
                            value={selectedCourier}
                            onChange={setSelectedCourier}
                            options={courierOptions}
                            loading={isSearchingCouriers}
                            onSearchChange={setCourierSearchText}
                            getOptionKey={(o) => o.id}
                            getOptionLabel={(o) => o.text}
                        />
                        </Stack>
                    </Section>

                    <Section
                        title="References & notes"
                        aside={<Badge variant="light" color="gray" size="sm">Optional</Badge>}
                    >
                        <Stack gap="md">
                            <SimpleGrid cols={{base: 1, sm: 2}} spacing="md">
                                <TextInput
                                    label="Reference A"
                                    maxLength={REFERENCE_MAX}
                                    value={refA}
                                    onChange={(e) => setRefA(e.currentTarget.value)}
                                />
                                <TextInput
                                    label="Reference B"
                                    maxLength={REFERENCE_MAX}
                                    value={refB}
                                    onChange={(e) => setRefB(e.currentTarget.value)}
                                />
                            </SimpleGrid>
                            <Box>
                                <Textarea
                                    label="Job Notes"
                                    autosize
                                    minRows={3}
                                    maxRows={6}
                                    maxLength={NOTES_MAX}
                                    value={jobNotes}
                                    onChange={(e) => setJobNotes(e.currentTarget.value)}
                                />
                                <CharCount value={jobNotes} max={NOTES_MAX}/>
                            </Box>
                        </Stack>
                    </Section>
                </Stack>
            </Box>
            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSubmit}
                confirmLabel="Create Job"
                confirmIcon={<Icon lucide={Plus} size={16}/>}
                submitting={isLoading}
            />
        </DialogShell>
    );
};

export default CreateJobDialog;
