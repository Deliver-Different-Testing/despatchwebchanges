/**
 * React Edit Address Dialog
 *
 * A modern replacement for the AngularJS edit-address-dialog using MUI components.
 * Allows users to search addresses, edit address fields, and optionally add shipment details.
 * Supports both US and NZ address formats with interactive HERE Maps integration.
 */

import React, {useState, useCallback, useEffect, useRef} from 'react';
import {
    Dialog,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    Typography,
    Box,
    TextField,
    Autocomplete,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Paper,
    CircularProgress,
    Collapse,
    alpha,
} from '@mui/material';
import {
    Close as CloseIcon,
    LocationOn as LocationIcon,
    Search as SearchIcon,
    Save as SaveIcon,
    LocalShipping as ShippingIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Map as MapIcon,
} from '@mui/icons-material';
import {
    EditAddressDialogViewModel,
    ShipmentDetails,
    HereMapsLocationResult,
    HereMapsLookupResponse,
} from '../../../interfaces';
import {useAddressSearch, useHereMapsApiKey} from '../../../hooks';
import {addressApi} from '../../../services/addressApi';
import {US_STATES} from '../../../utils/usStates';

// Default center coordinates (US)
const DEFAULT_CENTER = {lat: 39.8283, lng: -98.5795};
const DEFAULT_ZOOM = 4;
const SELECTED_ZOOM = 15;

export interface EditAddressDialogProps {
    open: boolean;
    addressDetails: EditAddressDialogViewModel | null;
    title: string;
    submitLabel: string;
    showContactInfo: boolean;
    isUsTenant: boolean;
    onClose: () => void;
    onSave: (address: EditAddressDialogViewModel) => void;
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

interface ValidationErrors {
    addressLine1?: string;
    addressLine4?: string;
    addressLine5?: string;
    addressLine6?: string;
    addressLine7?: string;
}

export const EditAddressDialog: React.FC<EditAddressDialogProps> = ({
    open,
    addressDetails,
    title,
    submitLabel,
    showContactInfo,
    isUsTenant,
    onClose,
    onSave,
    showToast,
}) => {
    // Form state - address fields
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');
    const [addressLine3, setAddressLine3] = useState('');
    const [addressLine4, setAddressLine4] = useState('');
    const [addressLine5, setAddressLine5] = useState('');
    const [addressLine6, setAddressLine6] = useState('');
    const [addressLine7, setAddressLine7] = useState('');
    const [addressLine8, setAddressLine8] = useState('');
    const [latitude, setLatitude] = useState<number | undefined>();
    const [longitude, setLongitude] = useState<number | undefined>();
    const [stateAbbreviation, setStateAbbreviation] = useState('');

    // Form state - shipment details
    const [contactName, setContactName] = useState('');
    const [contactMobile, setContactMobile] = useState('');
    const [weight, setWeight] = useState<number | undefined>();
    const [quantity, setQuantity] = useState<number | undefined>();
    const [length, setLength] = useState<number | undefined>();
    const [depth, setDepth] = useState<number | undefined>();
    const [height, setHeight] = useState<number | undefined>();
    const [jobNotes, setJobNotes] = useState('');

    // UI state
    const [addressSearchText, setAddressSearchText] = useState('');
    const [isContactCardExpanded, setIsContactCardExpanded] = useState(showContactInfo);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingAddress, setIsLoadingAddress] = useState(false);

    // Map state
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const platformRef = useRef<any>(null);
    const markerRef = useRef<any>(null);

    // React Query hooks
    const {data: addressOptions = [], isFetching: isSearchingAddresses} = useAddressSearch(
        addressSearchText,
        {enabled: open}
    );

    const {data: hereMapsApiKey} = useHereMapsApiKey({enabled: open});

    // Initialize map when API key is available
    useEffect(() => {
        if (!open || !hereMapsApiKey || !mapContainerRef.current) return;
        if (mapInstanceRef.current) return; // Already initialized

        // Check if HERE Maps SDK is loaded
        const H = (window as any).H;
        if (!H) {
            console.error('[EditAddressDialog] HERE Maps SDK not loaded');
            return;
        }

        try {
            // Initialize platform
            const platform = new H.service.Platform({apikey: hereMapsApiKey});
            platformRef.current = platform;

            // Use HARP engine type and raster tiles (avoids CSP blob URL issues)
            const engineType = H.Map.EngineType['HARP'];
            const defaultLayers = platform.createDefaultLayers({engineType});

            // Initialize map
            const initialCenter = latitude && longitude
                ? {lat: latitude, lng: longitude}
                : DEFAULT_CENTER;
            const initialZoom = latitude && longitude ? SELECTED_ZOOM : DEFAULT_ZOOM;

            const map = new H.Map(
                mapContainerRef.current,
                defaultLayers.raster.normal.map,
                {
                    zoom: initialZoom,
                    center: initialCenter,
                    engineType,
                }
            );

            // Add map behaviors (pan, zoom)
            new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

            // Add UI controls
            H.ui.UI.createDefault(map, defaultLayers);

            mapInstanceRef.current = map;

            // Add initial marker if coordinates exist
            if (latitude && longitude) {
                addMarker(latitude, longitude);
            }

            // Add click listener
            map.addEventListener('tap', async (evt: any) => {
                const coord = map.screenToGeo(
                    evt.currentPointer.viewportX,
                    evt.currentPointer.viewportY
                );
                await handleMapClick(coord.lat, coord.lng);
            });

            // Handle window resize
            const handleResize = () => {
                map.getViewPort().resize();
            };
            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
            };
        } catch (error) {
            console.error('[EditAddressDialog] Error initializing HERE Maps:', error);
            showToast('Error loading map. Please try again.', 'error');
        }
    }, [open, hereMapsApiKey, latitude, longitude]);

    // Cleanup map on dialog close
    useEffect(() => {
        if (!open && mapInstanceRef.current) {
            mapInstanceRef.current.dispose();
            mapInstanceRef.current = null;
            platformRef.current = null;
            markerRef.current = null;
        }
    }, [open]);

    // Reset form when dialog opens
    useEffect(() => {
        if (open && addressDetails) {
            setAddressLine1(addressDetails.addressLine1 || '');
            setAddressLine2(addressDetails.addressLine2 || '');
            setAddressLine3(addressDetails.addressLine3 || '');
            setAddressLine4(addressDetails.addressLine4 || '');
            setAddressLine5(addressDetails.addressLine5 || '');
            setAddressLine6(addressDetails.addressLine6 || '');
            setAddressLine7(addressDetails.addressLine7 || '');
            setAddressLine8(addressDetails.addressLine8 || '');
            setLatitude(addressDetails.latitude);
            setLongitude(addressDetails.longitude);
            setStateAbbreviation(addressDetails.stateAbbreviation || addressDetails.addressLine6 || '');
            setAddressSearchText(addressDetails.fullAddress || '');

            // Shipment details
            if (addressDetails.shipmentDetails) {
                setContactName(addressDetails.shipmentDetails.contactName || '');
                setContactMobile(addressDetails.shipmentDetails.contactMobile || '');
                setWeight(addressDetails.shipmentDetails.weight);
                setQuantity(addressDetails.shipmentDetails.quantity);
                setLength(addressDetails.shipmentDetails.length);
                setDepth(addressDetails.shipmentDetails.depth);
                setHeight(addressDetails.shipmentDetails.height);
                setJobNotes(addressDetails.shipmentDetails.jobNotes || '');
            }

            setValidationErrors({});
            setIsSubmitting(false);
            setIsContactCardExpanded(showContactInfo);
        } else if (open && !addressDetails) {
            // Reset all fields for new address
            setAddressLine1('');
            setAddressLine2('');
            setAddressLine3('');
            setAddressLine4('');
            setAddressLine5('');
            setAddressLine6('');
            setAddressLine7('');
            setAddressLine8('');
            setLatitude(undefined);
            setLongitude(undefined);
            setStateAbbreviation('');
            setAddressSearchText('');
            setContactName('');
            setContactMobile('');
            setWeight(undefined);
            setQuantity(undefined);
            setLength(undefined);
            setDepth(undefined);
            setHeight(undefined);
            setJobNotes('');
            setValidationErrors({});
            setIsSubmitting(false);
            setIsContactCardExpanded(showContactInfo);
        }
    }, [open, addressDetails, showContactInfo]);

    // Add or update marker on map
    const addMarker = useCallback((lat: number, lng: number) => {
        const H = (window as any).H;
        if (!mapInstanceRef.current || !H) return;

        // Remove existing marker
        if (markerRef.current) {
            mapInstanceRef.current.removeObject(markerRef.current);
        }

        // Create new marker
        const marker = new H.map.Marker({lat, lng});
        mapInstanceRef.current.addObject(marker);
        markerRef.current = marker;

        // Center map on marker
        mapInstanceRef.current.setCenter({lat, lng});
        mapInstanceRef.current.setZoom(SELECTED_ZOOM);
    }, []);

    // Handle map click - reverse geocode and update address
    const handleMapClick = useCallback(async (lat: number, lng: number) => {
        setLatitude(lat);
        setLongitude(lng);
        addMarker(lat, lng);

        try {
            setIsLoadingAddress(true);
            const results = await addressApi.fetchNearestAddress(lat, lng);

            if (results && results.length > 0) {
                const location = results[0];
                setAddressSearchText(location.address.label);

                // Get detailed location info
                if (location.id) {
                    const detailedLocation = await addressApi.getLocationDetailsById(location.id);
                    if (detailedLocation) {
                        handleAddressFieldsFromLookup(detailedLocation);
                    }
                }
            }
        } catch (error) {
            console.error('[EditAddressDialog] Error fetching nearest address:', error);
            showToast('Error retrieving address information.', 'error');
        } finally {
            setIsLoadingAddress(false);
        }
    }, [addMarker, showToast]);

    // Handle address selection from autocomplete
    const handleAddressSelect = useCallback(async (location: HereMapsLocationResult | null) => {
        if (!location) return;

        try {
            setIsLoadingAddress(true);
            setAddressSearchText(location.address.label);

            // Get detailed location info
            const detailedLocation = await addressApi.getLocationDetailsById(location.id);

            if (detailedLocation) {
                handleAddressFieldsFromLookup(detailedLocation);

                // Update map
                const lat = detailedLocation.position.lat;
                const lng = detailedLocation.position.lng;
                setLatitude(lat);
                setLongitude(lng);
                addMarker(lat, lng);
            } else {
                // Use basic location info
                setLatitude(location.position.lat);
                setLongitude(location.position.lng);
                addMarker(location.position.lat, location.position.lng);
            }
        } catch (error) {
            console.error('[EditAddressDialog] Error processing selected address:', error);
            showToast('Error processing selected address.', 'error');
        } finally {
            setIsLoadingAddress(false);
        }
    }, [addMarker, showToast]);

    // Map HERE Maps lookup response to form fields
    const handleAddressFieldsFromLookup = useCallback((location: HereMapsLookupResponse) => {
        const address = location.address;

        // Line 1: Company/Building
        setAddressLine1(location.title || location.mapReferences?.pointAddress?.buildingName || '');

        // Line 2: Unit/Suite - not directly available
        setAddressLine2('');

        // Line 3: Street Number
        setAddressLine3(address.houseNumber || '');

        // Line 4: Street Name
        if (location.streetInfo && location.streetInfo.length > 0) {
            const streetInfo = location.streetInfo[0];
            let formattedStreet = '';

            if (streetInfo.prefix) {
                formattedStreet += streetInfo.prefix + ' ';
            }

            if (streetInfo.streetTypePrecedes && streetInfo.streetType) {
                formattedStreet += streetInfo.streetType + ' ';
            }

            formattedStreet += streetInfo.baseName;

            if (!streetInfo.streetTypePrecedes && streetInfo.streetType) {
                formattedStreet += ' ' + streetInfo.streetType;
            }

            if (streetInfo.suffix) {
                formattedStreet += ' ' + streetInfo.suffix;
            }

            setAddressLine4(formattedStreet.trim());
        } else {
            setAddressLine4(address.street || '');
        }

        if (isUsTenant) {
            // US Format
            setAddressLine5(address.city || '');
            setAddressLine6(address.stateCode || address.state || '');

            // Handle state abbreviation
            if (address.stateCode) {
                setStateAbbreviation(address.stateCode);
            } else if (address.state) {
                const state = US_STATES.find(s => s.name.toLowerCase() === address.state?.toLowerCase());
                if (state) {
                    setStateAbbreviation(state.abbreviation);
                    setAddressLine6(state.abbreviation);
                }
            }

            // ZIP Code (first 5 digits)
            if (address.postalCode) {
                const zipMatch = address.postalCode.match(/^(\d{5})/);
                setAddressLine7(zipMatch ? zipMatch[1] : address.postalCode);
            } else {
                setAddressLine7('');
            }
        } else {
            // NZ Format
            setAddressLine5(address.district || '');
            setAddressLine6(address.city || '');
            setAddressLine7(address.postalCode || '');
        }

        // Line 8: Additional notes - typically empty from lookup
        setAddressLine8('');

        // Update coordinates
        setLatitude(location.position.lat);
        setLongitude(location.position.lng);
    }, [isUsTenant]);

    // Construct full address from form fields
    const constructFullAddress = useCallback((): string => {
        return [
            addressLine1,
            addressLine2,
            addressLine3,
            addressLine4,
            addressLine5,
            addressLine6,
            addressLine7,
            addressLine8,
        ]
            .filter(line => line && line.trim() !== '')
            .join(', ');
    }, [addressLine1, addressLine2, addressLine3, addressLine4, addressLine5, addressLine6, addressLine7, addressLine8]);

    // Validation
    const validateForm = useCallback((): boolean => {
        const errors: ValidationErrors = {};

        if (!addressLine1) {
            errors.addressLine1 = 'Company/Building/Complex is required';
        }

        if (!addressLine4) {
            errors.addressLine4 = 'Street name is required';
        }

        if (isUsTenant) {
            if (!addressLine5) {
                errors.addressLine5 = 'City is required';
            }
            if (!stateAbbreviation) {
                errors.addressLine6 = 'State is required';
            }
            if (!addressLine7) {
                errors.addressLine7 = 'ZIP code is required';
            }
        } else {
            if (!addressLine6) {
                errors.addressLine6 = 'City is required';
            }
            if (!addressLine7) {
                errors.addressLine7 = 'Post code is required';
            }
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, [addressLine1, addressLine4, addressLine5, addressLine6, addressLine7, stateAbbreviation, isUsTenant]);

    // Handle save
    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        const shipmentDetails: ShipmentDetails | undefined = showContactInfo
            ? {
                contactName,
                contactMobile,
                weight,
                quantity,
                length,
                depth,
                height,
                jobNotes,
            }
            : undefined;

        const updatedAddress: EditAddressDialogViewModel = {
            addressLine1,
            addressLine2,
            addressLine3,
            addressLine4,
            addressLine5,
            addressLine6: isUsTenant ? stateAbbreviation : addressLine6,
            addressLine7,
            addressLine8,
            latitude,
            longitude,
            fullAddress: constructFullAddress(),
            stateAbbreviation: isUsTenant ? stateAbbreviation : undefined,
            shipmentDetails,
            toSuburbId: addressDetails?.toSuburbId,
            cbd: addressDetails?.cbd,
            address: addressDetails?.address,
            our_suburb: addressDetails?.our_suburb,
        };

        onSave(updatedAddress);
    };

    // Handle state selection for US addresses
    const handleStateChange = (abbreviation: string) => {
        setStateAbbreviation(abbreviation);
        setAddressLine6(abbreviation);
    };

    if (!open) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        borderRadius: 2,
                        overflow: 'hidden',
                        maxWidth: 800,
                    },
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
                    <LocationIcon sx={{fontSize: 24}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" fontWeight={600}>
                        {title}
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    disabled={isSubmitting}
                    sx={{
                        color: 'white',
                        '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'},
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 3, bgcolor: '#fafafa'}}>
                {/* Address Search Section */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 2.5,
                        mb: 2.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'white',
                    }}
                >
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                        <SearchIcon sx={{color: 'text.secondary'}} />
                        <Typography variant="subtitle1" fontWeight={500}>
                            Address Lookup
                        </Typography>
                    </Box>

                    <Autocomplete
                        options={addressOptions}
                        getOptionLabel={(option) => option.address.label}
                        loading={isSearchingAddresses || isLoadingAddress}
                        inputValue={addressSearchText}
                        onInputChange={(_, value) => setAddressSearchText(value)}
                        onChange={(_, value) => handleAddressSelect(value)}
                        filterOptions={(x) => x} // Disable client-side filtering
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        renderInput={({InputProps: autoInputProps, ...params}) => (
                            <TextField
                                {...params}
                                label="Search Address"
                                placeholder="Type at least 3 characters to search..."
                                slotProps={{
                                    input: {
                                        ...autoInputProps,
                                        endAdornment: (
                                            <>
                                                {(isSearchingAddresses || isLoadingAddress) && (
                                                    <CircularProgress size={20} />
                                                )}
                                                {autoInputProps.endAdornment}
                                            </>
                                        ),
                                    },
                                }}
                            />
                        )}
                        noOptionsText={
                            addressSearchText.length < 3
                                ? 'Type at least 3 characters to search...'
                                : 'No addresses found'
                        }
                    />

                    {isLoadingAddress && (
                        <Box sx={{mt: 1, display: 'flex', alignItems: 'center', gap: 1}}>
                            <CircularProgress size={16} />
                            <Typography variant="body2" color="text.secondary">
                                Loading address details...
                            </Typography>
                        </Box>
                    )}
                </Paper>

                {/* Address Details Section */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 2.5,
                        mb: 2.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'white',
                    }}
                >
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                        <LocationIcon sx={{color: 'text.secondary'}} />
                        <Typography variant="subtitle1" fontWeight={500}>
                            Address Details
                        </Typography>
                    </Box>

                    {/* Line 1: Company/Building/Complex */}
                    <TextField
                        label="Company/Building/Complex"
                        value={addressLine1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                        error={!!validationErrors.addressLine1}
                        helperText={validationErrors.addressLine1}
                        fullWidth
                        required
                        disabled={isLoadingAddress}
                        sx={{mb: 2}}
                    />

                    {/* Line 2-4: Unit, Street Number, Street Name */}
                    <Box sx={{display: 'flex', gap: 2, mb: 2}}>
                        <TextField
                            label={isUsTenant ? 'Unit/Suite' : 'Unit/Flat/Suite'}
                            value={addressLine2}
                            onChange={(e) => setAddressLine2(e.target.value)}
                            disabled={isLoadingAddress}
                            sx={{flex: '0 0 25%'}}
                        />
                        <TextField
                            label="Street Number"
                            value={addressLine3}
                            onChange={(e) => setAddressLine3(e.target.value)}
                            disabled={isLoadingAddress}
                            sx={{flex: '0 0 20%'}}
                        />
                        <TextField
                            label="Street Name"
                            value={addressLine4}
                            onChange={(e) => setAddressLine4(e.target.value)}
                            error={!!validationErrors.addressLine4}
                            helperText={validationErrors.addressLine4}
                            disabled={isLoadingAddress}
                            sx={{flex: 1}}
                        />
                    </Box>

                    {/* US Format: City, State, ZIP */}
                    {isUsTenant && (
                        <Box sx={{display: 'flex', gap: 2, mb: 2}}>
                            <TextField
                                label="City"
                                value={addressLine5}
                                onChange={(e) => setAddressLine5(e.target.value)}
                                error={!!validationErrors.addressLine5}
                                helperText={validationErrors.addressLine5}
                                disabled={isLoadingAddress}
                                required
                                sx={{flex: '0 0 50%'}}
                            />
                            <FormControl sx={{flex: '0 0 25%'}} error={!!validationErrors.addressLine6}>
                                <InputLabel>State *</InputLabel>
                                <Select
                                    value={stateAbbreviation}
                                    onChange={(e) => handleStateChange(e.target.value)}
                                    label="State *"
                                    disabled={isLoadingAddress}
                                >
                                    {US_STATES.map((state) => (
                                        <MenuItem key={state.abbreviation} value={state.abbreviation}>
                                            {state.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField
                                label="ZIP Code"
                                value={addressLine7}
                                onChange={(e) => setAddressLine7(e.target.value)}
                                error={!!validationErrors.addressLine7}
                                helperText={validationErrors.addressLine7}
                                disabled={isLoadingAddress}
                                required
                                sx={{flex: '0 0 auto', maxWidth: 120}}
                                inputProps={{pattern: '[0-9]{5}(-[0-9]{4})?'}}
                            />
                        </Box>
                    )}

                    {/* NZ Format: Suburb, City, Post Code */}
                    {!isUsTenant && (
                        <Box sx={{display: 'flex', gap: 2, mb: 2}}>
                            <TextField
                                label="Suburb"
                                value={addressLine5}
                                onChange={(e) => setAddressLine5(e.target.value)}
                                disabled={isLoadingAddress}
                                sx={{flex: '0 0 40%'}}
                            />
                            <TextField
                                label="City"
                                value={addressLine6}
                                onChange={(e) => setAddressLine6(e.target.value)}
                                error={!!validationErrors.addressLine6}
                                helperText={validationErrors.addressLine6}
                                disabled={isLoadingAddress}
                                required
                                sx={{flex: '0 0 40%'}}
                            />
                            <TextField
                                label="Post Code"
                                value={addressLine7}
                                onChange={(e) => setAddressLine7(e.target.value)}
                                error={!!validationErrors.addressLine7}
                                helperText={validationErrors.addressLine7}
                                disabled={isLoadingAddress}
                                required
                                sx={{flex: '0 0 auto', maxWidth: 110}}
                                inputProps={{pattern: '[0-9]{4}'}}
                            />
                        </Box>
                    )}

                    {/* Line 8: Additional Notes */}
                    <TextField
                        label={isUsTenant ? 'Additional Notes' : 'Address Extras'}
                        value={addressLine8}
                        onChange={(e) => setAddressLine8(e.target.value)}
                        placeholder={
                            isUsTenant
                                ? 'Gate code, delivery instructions, etc.'
                                : 'Rural delivery, additional directions, etc.'
                        }
                        disabled={isLoadingAddress}
                        fullWidth
                        sx={{mb: 2}}
                    />

                    {/* Coordinates */}
                    <Box sx={{display: 'flex', gap: 2}}>
                        <TextField
                            label="Latitude"
                            type="number"
                            value={latitude ?? ''}
                            onChange={(e) => setLatitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                            disabled={isLoadingAddress}
                            inputProps={{step: 'any'}}
                            sx={{flex: 1}}
                        />
                        <TextField
                            label="Longitude"
                            type="number"
                            value={longitude ?? ''}
                            onChange={(e) => setLongitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                            disabled={isLoadingAddress}
                            inputProps={{step: 'any'}}
                            sx={{flex: 1}}
                        />
                    </Box>
                </Paper>

                {/* Shipment Details Card */}
                {showContactInfo && (
                    <Paper
                        elevation={0}
                        sx={{
                            mb: 2.5,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'white',
                            overflow: 'hidden',
                        }}
                    >
                        <Box
                            sx={{
                                px: 2.5,
                                py: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                '&:hover': {bgcolor: alpha('#000', 0.02)},
                            }}
                            onClick={() => setIsContactCardExpanded(!isContactCardExpanded)}
                        >
                            <ShippingIcon sx={{color: 'text.secondary', mr: 1}} />
                            <Typography variant="subtitle1" fontWeight={500} sx={{flex: 1}}>
                                Shipment Details
                            </Typography>
                            {isContactCardExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </Box>

                        <Collapse in={isContactCardExpanded}>
                            <Box sx={{px: 2.5, pb: 2.5}}>
                                {/* Contact Info */}
                                <Box sx={{display: 'flex', gap: 2, mb: 2}}>
                                    <TextField
                                        label="Contact Name"
                                        value={contactName}
                                        onChange={(e) => setContactName(e.target.value)}
                                        fullWidth
                                    />
                                    <TextField
                                        label="Contact Phone"
                                        value={contactMobile}
                                        onChange={(e) => setContactMobile(e.target.value)}
                                        type="tel"
                                        fullWidth
                                    />
                                </Box>

                                {/* Weight and Quantity */}
                                <Box sx={{display: 'flex', gap: 2, mb: 2}}>
                                    <TextField
                                        label={`Weight (${isUsTenant ? 'lbs' : 'kg'})`}
                                        type="number"
                                        value={weight ?? ''}
                                        onChange={(e) => setWeight(e.target.value ? parseFloat(e.target.value) : undefined)}
                                        inputProps={{min: 0, step: 0.1}}
                                        fullWidth
                                    />
                                    <TextField
                                        label="Quantity"
                                        type="number"
                                        value={quantity ?? ''}
                                        onChange={(e) => setQuantity(e.target.value ? parseInt(e.target.value) : undefined)}
                                        inputProps={{min: 1}}
                                        fullWidth
                                    />
                                </Box>

                                {/* Dimensions */}
                                <Box sx={{display: 'flex', gap: 2, mb: 2}}>
                                    <TextField
                                        label={`Length (${isUsTenant ? 'in' : 'cm'})`}
                                        type="number"
                                        value={length ?? ''}
                                        onChange={(e) => setLength(e.target.value ? parseFloat(e.target.value) : undefined)}
                                        inputProps={{min: 0, step: 0.1}}
                                        fullWidth
                                    />
                                    <TextField
                                        label={`Width (${isUsTenant ? 'in' : 'cm'})`}
                                        type="number"
                                        value={depth ?? ''}
                                        onChange={(e) => setDepth(e.target.value ? parseFloat(e.target.value) : undefined)}
                                        inputProps={{min: 0, step: 0.1}}
                                        fullWidth
                                    />
                                    <TextField
                                        label={`Height (${isUsTenant ? 'in' : 'cm'})`}
                                        type="number"
                                        value={height ?? ''}
                                        onChange={(e) => setHeight(e.target.value ? parseFloat(e.target.value) : undefined)}
                                        inputProps={{min: 0, step: 0.1}}
                                        fullWidth
                                    />
                                </Box>

                                {/* Notes */}
                                <TextField
                                    label="Notes"
                                    value={jobNotes}
                                    onChange={(e) => setJobNotes(e.target.value)}
                                    placeholder="Additional notes or special instructions..."
                                    multiline
                                    rows={3}
                                    inputProps={{maxLength: 150}}
                                    fullWidth
                                />
                            </Box>
                        </Collapse>
                    </Paper>
                )}

                {/* Map Section */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 2.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'white',
                    }}
                >
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                        <MapIcon sx={{color: 'text.secondary'}} />
                        <Typography variant="subtitle1" fontWeight={500}>
                            Location Preview
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ml: 'auto'}}>
                            Click on the map to set coordinates
                        </Typography>
                    </Box>

                    <Box
                        ref={mapContainerRef}
                        sx={{
                            width: '100%',
                            height: 300,
                            borderRadius: 1,
                            overflow: 'hidden',
                            bgcolor: 'grey.100',
                        }}
                    />
                </Paper>
            </DialogContent>

            {/* Actions */}
            <DialogActions
                sx={(theme) => ({
                    px: 3,
                    py: 2,
                    bgcolor: '#fafafa',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    gap: 1,
                })}
            >
                <Button
                    onClick={onClose}
                    variant="outlined"
                    disabled={isSubmitting}
                    sx={{minWidth: 100}}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting}
                    startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                    sx={{minWidth: 140}}
                >
                    {isSubmitting ? 'Saving...' : submitLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EditAddressDialog;
