/**
 * React Create Job Dialog
 *
 * MUI-based replacement for the AngularJS create-job-dialog.
 * Allows users to create a new job with client, addresses, contacts, vehicle, speed, and optional courier dispatch.
 */

import React, {useCallback, useEffect, useState} from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import ContactIcon from '@mui/icons-material/ContactPhone';
import RefIcon from '@mui/icons-material/Description';
import VehicleIcon from '@mui/icons-material/DirectionsCar';
import LocationIcon from '@mui/icons-material/LocationOn';
import NotesIcon from '@mui/icons-material/Notes';
import PersonIcon from '@mui/icons-material/Person';
import {DateInput} from '@mantine/dates';
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
import {dayjs, formatDateForApi, getIanaTimezone, getInputDateFormat} from '../../../utils/dateUtils';
import {getStateByAbbreviation} from '../../../utils/usStates';
import type {Dayjs} from 'dayjs';
import type {ShowToastFn} from '../../../services/toastService';
import {DialogShell, DialogHeader} from '../shared';

/** The string form `DateInput` exchanges values in. */
const ISO_DATE = 'YYYY-MM-DD';

// Section wrapper component for consistent styling
const FormSection: React.FC<{
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    isLast?: boolean;
}> = ({icon, title, children, isLast}) => (
    <Paper
        elevation={0}
        sx={{
            p: 2.5,
            mb: isLast ? 0 : 2.5,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
        }}
    >
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
            {React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, {sx: {color: 'text.secondary'}})}
            <Typography variant="subtitle1" sx={{
                fontWeight: 500
            }}>
                {title}
            </Typography>
        </Box>
        {children}
    </Paper>
);

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
    // Form state - Job Details
    const [selectedClient, setSelectedClient] = useState<Suggestion | null>(null);
    const [clientSearchText, setClientSearchText] = useState('');
    const [charge, setCharge] = useState<string>('');
    const [weight, setWeight] = useState<string>('');
    const [selectedCourier, setSelectedCourier] = useState<CourierSuggestion | null>(null);
    const [courierSearchText, setCourierSearchText] = useState('');
    const [jobDate, setJobDate] = useState<Dayjs>(dayjs().tz(getIanaTimezone()));

    // Form state - Addresses
    const [fromAddressSearchText, setFromAddressSearchText] = useState('');
    const [toAddressSearchText, setToAddressSearchText] = useState('');
    const [selectedPickupAddress, setSelectedPickupAddress] = useState<HereMapsLocationResult | null>(null);
    const [selectedDeliveryAddress, setSelectedDeliveryAddress] = useState<HereMapsLocationResult | null>(null);

    // Form state - Contacts
    const [pickupContact, setPickupContact] = useState('');
    const [deliveryContact, setDeliveryContact] = useState('');
    const [podName, setPodName] = useState('');

    // Form state - Vehicle & Speed
    const [selectedVehicle, setSelectedVehicle] = useState<Suggestion | null>(null);
    const [vehicleSearchText, setVehicleSearchText] = useState('');
    const [selectedSpeed, setSelectedSpeed] = useState<Suggestion | null>(null);
    const [speedSearchText, setSpeedSearchText] = useState('');

    // Form state - References & Notes
    const [refA, setRefA] = useState('');
    const [refB, setRefB] = useState('');
    const [jobNotes, setJobNotes] = useState('');
    const [pickupNotes, setPickupNotes] = useState('');
    const [deliveryNotes, setDeliveryNotes] = useState('');

    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [touched, setTouched] = useState(false);

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
            setVehicleSearchText('');
            setSelectedSpeed(null);
            setSpeedSearchText('');
            setRefA('');
            setRefB('');
            setJobNotes('');
            setPickupNotes('');
            setDeliveryNotes('');
            setIsLoading(false);
            setTouched(false);
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

    // Validation
    const validate = useCallback((): boolean => {
        if (!selectedClient) {
            showToast('Please select a client.', 'warning');
            return false;
        }
        const chargeNum = parseFloat(charge);
        if (!charge || isNaN(chargeNum) || chargeNum <= 0) {
            showToast('Please enter a valid charge amount.', 'warning');
            return false;
        }
        const weightNum = parseFloat(weight);
        if (!weight || isNaN(weightNum) || weightNum <= 0) {
            showToast(
                isUsTenant ? 'Please enter a valid weight (lb).' : 'Please enter a valid weight (kg).',
                'warning'
            );
            return false;
        }
        if (!jobDate || !jobDate.isValid()) {
            showToast('Please select a job date.', 'warning');
            return false;
        }
        if (!selectedPickupAddress) {
            showToast('Please select a pickup address.', 'warning');
            return false;
        }
        if (!selectedDeliveryAddress) {
            showToast('Please select a delivery address.', 'warning');
            return false;
        }
        if (!pickupContact.trim()) {
            showToast('Please enter a pickup contact name.', 'warning');
            return false;
        }
        if (!deliveryContact.trim()) {
            showToast('Please enter a delivery contact name.', 'warning');
            return false;
        }
        if (!podName.trim()) {
            showToast('Please enter a POD name.', 'warning');
            return false;
        }
        if (!selectedVehicle) {
            showToast('Please select a vehicle.', 'warning');
            return false;
        }
        if (!selectedSpeed) {
            showToast('Please select a speed.', 'warning');
            return false;
        }
        return true;
    }, [selectedClient, charge, weight, isUsTenant, jobDate, selectedPickupAddress, selectedDeliveryAddress,
        pickupContact, deliveryContact, podName, selectedVehicle, selectedSpeed, showToast]);

    // Submit handler
    const handleSubmit = useCallback(async () => {
        if (isLoading) return;

        setTouched(true);

        if (!validate()) return;

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
            const newJobId = await jobApi.quickCreateJob(job);

            // Handle optional courier dispatch
            if (selectedCourier) {
                try {
                    await jobApi.allocateJobToCourier(selectedCourier.id, [newJobId]);
                    showToast('Job created and dispatched successfully', 'success');
                } catch (dispatchError) {
                    console.error('[CreateJobDialog] Courier dispatch failed:', dispatchError);
                    showToast('Job created successfully, but could not be dispatched to the courier. The courier may be offline.', 'warning');
                }
            } else {
                showToast('Job created successfully', 'success');
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
    }, [isLoading, validate, processAddress, selectedPickupAddress, selectedDeliveryAddress,
        selectedClient, deliveryContact, podName, jobDate, pickupContact, refA, refB,
        deliveryNotes, pickupNotes, jobNotes, charge, weight, isUsTenant, selectedSpeed, selectedVehicle,
        selectedCourier, onSubmit, showToast]);

    // Filter vehicle/speed options locally
    const filteredVehicles = vehicleSizes.filter(v =>
        v.text.toLowerCase().includes(vehicleSearchText.toLowerCase())
    );
    const filteredSpeeds = speedOptions.filter(s =>
        s.text.toLowerCase().includes(speedSearchText.toLowerCase())
    );

    // Helper for showing required field error
    if (!open) return null;

    return (
        <DialogShell
            open={open}
            onClose={isLoading ? undefined : onClose}
            maxWidth="md"
            slotProps={{
                paper: {
                    sx: {
                        overflow: 'hidden',
                        maxWidth: 900,
                    },
                },
            }}
        >
            <DialogHeader
                icon={<AddBusinessIcon />}
                title="Add New Job"
                subtitle="Create a new dispatch job"
                onClose={onClose}
                closeDisabled={isLoading}
            />
            {/* Content */}
            <DialogContent sx={{p: 3, bgcolor: 'background.default'}}>
                {/* Job Details Section */}
                <FormSection icon={<PersonIcon />} title="Job Details">
                    <Box sx={{display: 'flex', gap: 2, mb: 2}}>
                        <Autocomplete
                            sx={{flex: 1}}
                            options={clientOptions}
                            getOptionLabel={(option) => option.text}
                            loading={isSearchingClients}
                            value={selectedClient}
                            inputValue={clientSearchText}
                            onInputChange={(_, value) => setClientSearchText(value)}
                            onChange={(_, value) => setSelectedClient(value)}
                            filterOptions={(x) => x}
                            isOptionEqualToValue={(a, b) => a.id === b.id}
                            renderInput={({slotProps: autoSlotProps, ...params}) => (
                                <TextField
                                    {...params}
                                    label="Client"
                                    placeholder="Start typing to search clients"
                                    required
                                    error={touched && !selectedClient}
                                    helperText={touched && !selectedClient ? 'Client is required.' : ''}
                                    slotProps={{
                                        ...autoSlotProps,
                                        input: {
                                            ...autoSlotProps.input,
                                            endAdornment: (
                                                <>
                                                    {isSearchingClients && <CircularProgress size={20} />}
                                                    {autoSlotProps.input.endAdornment}
                                                </>
                                            ),
                                        },
                                    }}
                                />
                            )}
                            noOptionsText={
                                clientSearchText.length < 3
                                    ? 'Type at least 3 characters to search...'
                                    : 'No clients found'
                            }
                        />
                        <TextField
                            sx={{flex: '0 0 180px'}}
                            label="Charge Amount"
                            type="number"
                            value={charge}
                            onChange={(e) => setCharge(e.target.value)}
                            required
                            error={touched && (!charge || parseFloat(charge) <= 0)}
                            helperText={touched && (!charge || parseFloat(charge) <= 0) ? 'Charge must be greater than 0.' : ''}
                            slotProps={{htmlInput: {step: '0.01', min: '0.01'}}}
                        />
                        <TextField
                            sx={{flex: '0 0 160px'}}
                            label={isUsTenant ? 'Weight (lb)' : 'Weight (kg)'}
                            type="number"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            required
                            error={touched && (!weight || parseFloat(weight) <= 0)}
                            helperText={touched && (!weight || parseFloat(weight) <= 0) ? 'Weight must be greater than 0.' : ''}
                            slotProps={{htmlInput: {step: 'any', min: '0', inputMode: 'decimal'}}}
                        />
                    </Box>
                    <Box sx={{display: 'flex', gap: 2}}>
                        <Autocomplete
                            sx={{flex: 1}}
                            options={courierOptions}
                            getOptionLabel={(option) => option.text}
                            loading={isSearchingCouriers}
                            value={selectedCourier}
                            inputValue={courierSearchText}
                            onInputChange={(_, value) => setCourierSearchText(value)}
                            onChange={(_, value) => setSelectedCourier(value)}
                            filterOptions={(x) => x}
                            isOptionEqualToValue={(a, b) => a.id === b.id}
                            renderInput={({slotProps: autoSlotProps, ...params}) => (
                                <TextField
                                    {...params}
                                    label="Courier"
                                    placeholder="Start typing to search couriers"
                                    slotProps={{
                                        ...autoSlotProps,
                                        input: {
                                            ...autoSlotProps.input,
                                            endAdornment: (
                                                <>
                                                    {isSearchingCouriers && <CircularProgress size={20} />}
                                                    {autoSlotProps.input.endAdornment}
                                                </>
                                            ),
                                        },
                                    }}
                                />
                            )}
                            noOptionsText={
                                courierSearchText.length < 2
                                    ? 'Type at least 2 characters to search...'
                                    : 'No couriers found'
                            }
                        />
                        {/* Mantine's `DateInput` is string-valued (`YYYY-MM-DD`), so the job
                            date stays a calendar date all the way to `formatDateForApi`. The
                            surrounding form is still MUI — see the plan's Phase 7b note. */}
                        <DateInput
                            label="Job Date"
                            required
                            value={jobDate?.isValid() ? jobDate.format(ISO_DATE) : null}
                            onChange={(value) => {
                                if (value) setJobDate(dayjs(value));
                            }}
                            valueFormat={getInputDateFormat()}
                            placeholder={getInputDateFormat()}
                            error={touched && (!jobDate || !jobDate.isValid()) ? 'Job date is required.' : undefined}
                            size="md"
                            style={{flex: '0 0 200px'}}
                        />
                    </Box>
                </FormSection>

                {/* Addresses Section */}
                <FormSection icon={<LocationIcon />} title="Addresses">
                    <Box sx={{display: 'flex', gap: 2}}>
                        <Autocomplete
                            sx={{flex: 1}}
                            options={fromAddressOptions}
                            getOptionLabel={(option) => option.address.label}
                            loading={isSearchingFromAddress}
                            inputValue={fromAddressSearchText}
                            onInputChange={(_, value) => setFromAddressSearchText(value)}
                            onChange={(_, value) => setSelectedPickupAddress(value)}
                            filterOptions={(x) => x}
                            isOptionEqualToValue={(a, b) => a.id === b.id}
                            renderInput={({slotProps: autoSlotProps, ...params}) => (
                                <TextField
                                    {...params}
                                    label="From Address"
                                    placeholder="Start typing to search addresses"
                                    required
                                    error={touched && !selectedPickupAddress}
                                    helperText={touched && !selectedPickupAddress ? 'Pickup address is required.' : ''}
                                    slotProps={{
                                        ...autoSlotProps,
                                        input: {
                                            ...autoSlotProps.input,
                                            endAdornment: (
                                                <>
                                                    {isSearchingFromAddress && <CircularProgress size={20} />}
                                                    {autoSlotProps.input.endAdornment}
                                                </>
                                            ),
                                        },
                                    }}
                                />
                            )}
                            noOptionsText={
                                fromAddressSearchText.length < 3
                                    ? 'Type at least 3 characters to search...'
                                    : 'No addresses found'
                            }
                        />
                        <Autocomplete
                            sx={{flex: 1}}
                            options={toAddressOptions}
                            getOptionLabel={(option) => option.address.label}
                            loading={isSearchingToAddress}
                            inputValue={toAddressSearchText}
                            onInputChange={(_, value) => setToAddressSearchText(value)}
                            onChange={(_, value) => setSelectedDeliveryAddress(value)}
                            filterOptions={(x) => x}
                            isOptionEqualToValue={(a, b) => a.id === b.id}
                            renderInput={({slotProps: autoSlotProps, ...params}) => (
                                <TextField
                                    {...params}
                                    label="To Address"
                                    placeholder="Start typing to search addresses"
                                    required
                                    error={touched && !selectedDeliveryAddress}
                                    helperText={touched && !selectedDeliveryAddress ? 'Delivery address is required.' : ''}
                                    slotProps={{
                                        ...autoSlotProps,
                                        input: {
                                            ...autoSlotProps.input,
                                            endAdornment: (
                                                <>
                                                    {isSearchingToAddress && <CircularProgress size={20} />}
                                                    {autoSlotProps.input.endAdornment}
                                                </>
                                            ),
                                        },
                                    }}
                                />
                            )}
                            noOptionsText={
                                toAddressSearchText.length < 3
                                    ? 'Type at least 3 characters to search...'
                                    : 'No addresses found'
                            }
                        />
                    </Box>
                </FormSection>

                {/* Contacts Section */}
                <FormSection icon={<ContactIcon />} title="Contacts">
                    <Box sx={{display: 'flex', gap: 2}}>
                        <TextField
                            sx={{flex: 1}}
                            label="Pickup Contact"
                            value={pickupContact}
                            onChange={(e) => setPickupContact(e.target.value)}
                            required
                            error={touched && !pickupContact.trim()}
                            helperText={touched && !pickupContact.trim() ? 'Pickup contact is required.' : ''}
                        />
                        <TextField
                            sx={{flex: 1}}
                            label="Delivery Contact"
                            value={deliveryContact}
                            onChange={(e) => setDeliveryContact(e.target.value)}
                            required
                            error={touched && !deliveryContact.trim()}
                            helperText={touched && !deliveryContact.trim() ? 'Delivery contact is required.' : ''}
                        />
                        <TextField
                            sx={{flex: 1}}
                            label="POD Name"
                            value={podName}
                            onChange={(e) => setPodName(e.target.value)}
                            required
                            error={touched && !podName.trim()}
                            helperText={touched && !podName.trim() ? 'POD name is required.' : ''}
                        />
                    </Box>
                </FormSection>

                {/* Vehicle & Speed Section */}
                <FormSection icon={<VehicleIcon />} title="Vehicle & Speed">
                    <Box sx={{display: 'flex', gap: 2}}>
                        <Autocomplete
                            sx={{flex: 1}}
                            options={filteredVehicles}
                            getOptionLabel={(option) => option.text}
                            value={selectedVehicle}
                            inputValue={vehicleSearchText}
                            onInputChange={(_, value) => setVehicleSearchText(value)}
                            onChange={(_, value) => setSelectedVehicle(value)}
                            isOptionEqualToValue={(a, b) => a.id === b.id}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Vehicle"
                                    required
                                    error={touched && !selectedVehicle}
                                    helperText={touched && !selectedVehicle ? 'Vehicle is required.' : ''}
                                />
                            )}
                            noOptionsText="No vehicles found"
                        />
                        <Autocomplete
                            sx={{flex: 1}}
                            options={filteredSpeeds}
                            getOptionLabel={(option) => option.text}
                            value={selectedSpeed}
                            inputValue={speedSearchText}
                            onInputChange={(_, value) => setSpeedSearchText(value)}
                            onChange={(_, value) => setSelectedSpeed(value)}
                            isOptionEqualToValue={(a, b) => a.id === b.id}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Speed"
                                    required
                                    error={touched && !selectedSpeed}
                                    helperText={touched && !selectedSpeed ? 'Speed is required.' : ''}
                                />
                            )}
                            noOptionsText="No speeds found"
                        />
                    </Box>
                </FormSection>

                {/* References Section */}
                <FormSection icon={<RefIcon />} title="References">
                    <Box sx={{display: 'flex', gap: 2}}>
                        <TextField
                            sx={{flex: 1}}
                            label="Reference A"
                            value={refA}
                            onChange={(e) => setRefA(e.target.value)}
                            slotProps={{htmlInput: {maxLength: 20}}}
                        />
                        <TextField
                            sx={{flex: 1}}
                            label="Reference B"
                            value={refB}
                            onChange={(e) => setRefB(e.target.value)}
                            slotProps={{htmlInput: {maxLength: 20}}}
                        />
                    </Box>
                </FormSection>

                {/* Notes Section */}
                <FormSection icon={<NotesIcon />} title="Notes" isLast>
                    <Box sx={{display: 'flex', gap: 2}}>
                        <TextField
                            sx={{flex: 1}}
                            label="Job Notes"
                            value={jobNotes}
                            onChange={(e) => setJobNotes(e.target.value)}
                            multiline
                            rows={3}
                            slotProps={{htmlInput: {maxLength: 150}}}
                        />
                        <TextField
                            sx={{flex: 1}}
                            label="Pickup Notes"
                            value={pickupNotes}
                            onChange={(e) => setPickupNotes(e.target.value)}
                            multiline
                            rows={3}
                            slotProps={{htmlInput: {maxLength: 150}}}
                        />
                        <TextField
                            sx={{flex: 1}}
                            label="Delivery Notes"
                            value={deliveryNotes}
                            onChange={(e) => setDeliveryNotes(e.target.value)}
                            multiline
                            rows={3}
                            slotProps={{htmlInput: {maxLength: 150}}}
                        />
                    </Box>
                </FormSection>
            </DialogContent>
            {/* Actions */}
            <DialogActions sx={{px: 3, py: 2, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider'}}>
                {isLoading && <CircularProgress size={28} sx={{mr: 1}} />}
                {!isLoading && (
                    <>
                        <Button onClick={onClose} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={isLoading}
                        >
                            Create Job
                        </Button>
                    </>
                )}
            </DialogActions>
        </DialogShell>
    );
};

export default CreateJobDialog;
