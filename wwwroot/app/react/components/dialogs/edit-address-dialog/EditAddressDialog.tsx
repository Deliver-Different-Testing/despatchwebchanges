/**
 * React Edit Address Dialog
 *
 * A modern replacement for the AngularJS edit-address-dialog using MUI components.
 * Allows users to search addresses, edit address fields, and optionally add shipment details.
 * Supports both US and NZ address formats with interactive HERE Maps integration.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Box, Button, Collapse, Group, Loader, NumberInput, Paper, Select, Stack, Text, TextInput, Textarea} from '@mantine/core';
import {ChevronDown, ChevronUp, Lock, Map as MapGlyph, Save, Search} from 'lucide-react';
import {IconMapPin, IconTruck} from '@tabler/icons-react';
import {Icon} from '../../common/icon/Icon';
import {SearchSelect} from '../../common/search-select/SearchSelect';
import {
    EditAddressDialogViewModel,
    HereMapsLocationResult,
    HereMapsLookupResponse,
    ShipmentDetails,
} from '../../../interfaces';
import {useAddressSearch, useHereMapsApiKey} from '../../../hooks/useAddressApi';
import {addressApi} from '../../../services/addressApi';
import {US_STATES, normalizeToStateAbbreviation} from '../../../utils/usStates';
import type {ShowToastFn} from '../../../services/toastService';
import {MapZoomViewControls} from '../../common/dispatch-map';
import {safeRemoveObject} from '../../common/here-map/hereMapUtils';
import {AddressType} from '../../../../enums/address-type.enum';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    dialogSize,
    sectionPaperProps,
} from '../shared/mantine';

// Match the pickup/delivery flag colors used on the other maps so the pin
// inherits the same visual language as the job-detail headers.
const PICKUP_MARKER_ICON_URL = 'https://img.icons8.com/ios-filled/50/2196f3/marker.png';
const DELIVERY_MARKER_ICON_URL = 'https://img.icons8.com/ios-filled/50/4caf50/marker.png';

/**
 * Minimal HERE Maps type definitions for the SDK objects used in this component.
 * The full HERE Maps SDK is loaded via a script tag and has no TypeScript definitions.
 */
interface HereMapsMapInstance {
    dispose(): void;
    removeObject(obj: unknown): void;
    addObject(obj: unknown): void;
    setCenter(coords: {lat: number; lng: number}): void;
    setZoom(zoom: number): void;
    getViewPort(): {resize(): void};
    addEventListener(event: string, callback: (evt: HereMapsTapEvent) => void): void;
    screenToGeo(x: number, y: number): {lat: number; lng: number};
}

interface HereMapsTapEvent {
    currentPointer: {viewportX: number; viewportY: number};
}

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
    /**
     * Which leg of the job this address belongs to. Drives the map pin
     * colour — blue for pickup, green for delivery. Defaults to pickup
     * when unspecified.
     */
    addressType?: AddressType;
    /** When true the dialog opens in view-only mode: fields disabled, no Save. */
    readOnly?: boolean;
    onClose: () => void;
    onSave: (address: EditAddressDialogViewModel) => void;
    showToast: ShowToastFn;
}

interface ValidationErrors {
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
    addressType = AddressType.Pickup,
    readOnly = false,
    onClose,
    onSave,
    showToast,
}) => {
    const markerIconUrl = addressType === AddressType.Delivery
        ? DELIVERY_MARKER_ICON_URL
        : PICKUP_MARKER_ICON_URL;
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
    const [dialogFullyOpen, setDialogFullyOpen] = useState(false);

    // Map state
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<HereMapsMapInstance | null>(null);
    const platformRef = useRef<unknown>(null);
    const markerRef = useRef<unknown>(null);
    const handleMapClickRef = useRef<(lat: number, lng: number) => Promise<void>>(undefined);
    // MapZoomViewControls needs live map/platform/defaultLayers references;
    // ref-only storage wouldn't trigger the overlay to render once the SDK
    // finishes initialising, so we mirror them into state.
    const [mapInstance, setMapInstance] = useState<unknown>(null);
    const [platformInstance, setPlatformInstance] = useState<unknown>(null);
    const [defaultLayers, setDefaultLayers] = useState<unknown>(null);

    // React Query hooks
    const {data: addressOptions = [], isFetching: isSearchingAddresses} = useAddressSearch(
        addressSearchText,
        {enabled: open}
    );

    const {data: hereMapsApiKey} = useHereMapsApiKey({enabled: open});

    /*
     * The map needs a laid-out container, so it waits a frame after the dialog
     * opens rather than building during the first render.
     *
     * This deliberately does not hang off the modal's transition callback, which
     * is where the MUI version got it. Mantine drives the transition through
     * useDidUpdate, so a dialog that mounts already open — which is every dialog
     * reactDialogHost renders — never reports that it opened, and the map would
     * never be built. Pinned in shared.test.tsx.
     */
    useEffect(() => {
        if (!open) {
            setDialogFullyOpen(false);
            return;
        }
        const frame = requestAnimationFrame(() => setDialogFullyOpen(true));
        return () => cancelAnimationFrame(frame);
    }, [open]);

    // Initialize map when API key is available
    useEffect(() => {
        if (!dialogFullyOpen || !hereMapsApiKey || !mapContainerRef.current) return;
        if (mapInstanceRef.current) return; // Already initialized

        // Check if HERE Maps SDK is loaded
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HERE Maps SDK loaded via script tag with no TypeScript definitions
        const H = (window as Record<string, any>).H;
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

            // Add map behaviors (pan, zoom). Don't add HERE's native UI here —
            // the React MapZoomViewControls overlay below replaces it so the
            // controls match the other maps in the app.
            new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

            mapInstanceRef.current = map;
            setMapInstance(map);
            setPlatformInstance(platform);
            setDefaultLayers(defaultLayers);

            // Dialog transition is already complete so container has final dimensions
            map.getViewPort().resize();

            // Add initial marker if coordinates exist
            if (latitude && longitude) {
                addMarker(latitude, longitude);
            }

            // Add click listener
            map.addEventListener('tap', async (evt: HereMapsTapEvent) => {
                const coord = map.screenToGeo(
                    evt.currentPointer.viewportX,
                    evt.currentPointer.viewportY
                );
                await handleMapClickRef.current?.(coord.lat, coord.lng);
            });

            // Handle window resize
            const handleResize = () => {
                map.getViewPort().resize();
            };
            window.addEventListener('resize', handleResize, { passive: true });

            return () => {
                window.removeEventListener('resize', handleResize);
            };
        } catch (error) {
            console.error('[EditAddressDialog] Error initializing HERE Maps:', error);
            showToast('Error loading map. Please try again.', 'error');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map init only after dialog transition/apiKey; lat/lng/addMarker change during drag
    }, [dialogFullyOpen, hereMapsApiKey]);

    // Cleanup map on dialog close
    useEffect(() => {
        if (!open) {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.dispose();
                mapInstanceRef.current = null;
                platformRef.current = null;
                markerRef.current = null;
            }
            setMapInstance(null);
            setPlatformInstance(null);
            setDefaultLayers(null);
            setDialogFullyOpen(false);
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
            setStateAbbreviation(
                normalizeToStateAbbreviation(addressDetails.stateAbbreviation || addressDetails.addressLine6),
            );
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HERE Maps SDK loaded via script tag with no TypeScript definitions
        const H = (window as Record<string, any>).H;
        if (!mapInstanceRef.current || !H) return;

        // Remove existing marker
        if (markerRef.current) {
            safeRemoveObject(mapInstanceRef.current, markerRef.current);
        }

        // Colored pin matching the pickup/delivery palette on the other maps.
        const icon = new H.map.Icon(markerIconUrl, {size: {w: 50, h: 50}});
        const marker = new H.map.Marker({lat, lng}, {icon});
        mapInstanceRef.current.addObject(marker);
        markerRef.current = marker;

        // Center map on marker
        mapInstanceRef.current.setCenter({lat, lng});
        mapInstanceRef.current.setZoom(SELECTED_ZOOM);
    }, [markerIconUrl]);

    // Map HERE Maps lookup response to form fields
    const handleAddressFieldsFromLookup = useCallback((location: HereMapsLookupResponse) => {
        const address = location.address;

        // Line 1: Company/Building — use building name from HERE if available,
        // fall back to title for 'place' results (company/venue names),
        // otherwise clear so stale company names from pre-populated addresses don't persist
        const buildingName = location.mapReferences?.pointAddress?.buildingName;
        const placeName = location.resultType === 'place' ? location.title : '';
        setAddressLine1(buildingName || placeName || '');

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

        // Line 8: Country
        setAddressLine8(address.countryName || '');

        // Update coordinates
        setLatitude(location.position.lat);
        setLongitude(location.position.lng);
    }, [isUsTenant]);

    // Handle map click - reverse geocode and update address
    handleMapClickRef.current = useCallback(async (lat: number, lng: number) => {
        if (readOnly) return;
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
    }, [addMarker, handleAddressFieldsFromLookup, showToast]);

    // Handle address selection from autocomplete
    const handleAddressSelect = useCallback(async (location: HereMapsLocationResult | null) => {
        if (!location) return;

        try {
            setIsLoadingAddress(true);
            setAddressSearchText(location.address.label);

            // Get detailed location info (some results like localities may not have an id)
            if (location.id) {
                const detailedLocation = await addressApi.getLocationDetailsById(location.id);

                if (detailedLocation) {
                    handleAddressFieldsFromLookup(detailedLocation);

                    // Update map
                    const lat = detailedLocation.position.lat;
                    const lng = detailedLocation.position.lng;
                    setLatitude(lat);
                    setLongitude(lng);
                    addMarker(lat, lng);
                    return;
                }
            }

            // Use basic location info when no id or lookup returned null
            if (location.position) {
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
    }, [addMarker, handleAddressFieldsFromLookup, showToast]);

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
    }, [addressLine4, addressLine5, addressLine6, addressLine7, stateAbbreviation, isUsTenant]);

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

    return (
        <DialogShell
            opened={open}
            onClose={onClose}
            size={dialogSize.md}
            label={title}
        >
            <DialogHeader
                icon={readOnly ? <Icon lucide={Lock}/> : <Icon tabler={IconMapPin}/>}
                title={title}
                subtitle={readOnly ? 'View only — this job is locked' : 'Search and update the address details'}
                onClose={onClose}
                closeDisabled={isSubmitting}
            />
            {/* Content */}
            <Stack bg={dialogContentBg} p={24} gap={20}>
                {/* Address Search Section */}
                <Paper {...sectionPaperProps}>
                    <Group gap={8} mb={16} c="dimmed">
                        <Icon lucide={Search}/>
                        <Text fz="md" fw={500} c="var(--mantine-color-text)">Address Lookup</Text>
                    </Group>

                    {/* Object-valued and searched on the server, which is the case
                        Mantine's Autocomplete cannot cover. */}
                    <SearchSelect
                        label="Search Address"
                        placeholder="Type at least 3 characters to search..."
                        disabled={readOnly}
                        minSearchLength={3}
                        value={null}
                        onChange={handleAddressSelect}
                        options={addressOptions}
                        loading={isSearchingAddresses || isLoadingAddress}
                        onSearchChange={setAddressSearchText}
                        getOptionKey={(o) => o.id}
                        getOptionLabel={(o) => o.address.label}
                    />

                    {isLoadingAddress && (
                        <Group gap={8} mt={8}>
                            <Loader size={16} aria-label="Loading address details"/>
                            <Text fz="sm" c="dimmed">Loading address details...</Text>
                        </Group>
                    )}
                </Paper>

                {/* Address Details Section */}
                <Paper {...sectionPaperProps}>
                    <Group gap={8} mb={16} c="dimmed">
                        <Icon tabler={IconMapPin}/>
                        <Text fz="md" fw={500} c="var(--mantine-color-text)">Address Details</Text>
                    </Group>

                    <Stack gap={16}>
                        {/* Line 1: Company/Building/Complex */}
                        <TextInput
                            label="Company/Building/Complex"
                            value={addressLine1}
                            onChange={(e) => setAddressLine1(e.currentTarget.value)}
                            disabled={isLoadingAddress || readOnly}
                        />

                        {/* Line 2-4: Unit, Street Number, Street Name */}
                        <Group gap={16} align="flex-start" wrap="nowrap">
                            <TextInput
                                label={isUsTenant ? 'Unit/Suite' : 'Unit/Flat/Suite'}
                                value={addressLine2}
                                onChange={(e) => setAddressLine2(e.currentTarget.value)}
                                disabled={isLoadingAddress || readOnly}
                                style={{flex: '0 0 25%'}}
                            />
                            <TextInput
                                label="Street Number"
                                value={addressLine3}
                                onChange={(e) => setAddressLine3(e.currentTarget.value)}
                                disabled={isLoadingAddress || readOnly}
                                style={{flex: '0 0 20%'}}
                            />
                            <TextInput
                                label="Street Name"
                                value={addressLine4}
                                onChange={(e) => setAddressLine4(e.currentTarget.value)}
                                error={validationErrors.addressLine4}
                                disabled={isLoadingAddress || readOnly}
                                style={{flex: 1}}
                            />
                        </Group>

                        {/* US Format: City, State, ZIP */}
                        {isUsTenant && (
                            <Group gap={16} align="flex-start" wrap="nowrap">
                                <TextInput
                                    label="City"
                                    withAsterisk
                                    value={addressLine5}
                                    onChange={(e) => setAddressLine5(e.currentTarget.value)}
                                    error={validationErrors.addressLine5}
                                    disabled={isLoadingAddress || readOnly}
                                    style={{flex: '0 0 45%'}}
                                />
                                <Select
                                    label="State"
                                    withAsterisk
                                    searchable
                                    comboboxProps={{keepMounted: false}}
                                    value={stateAbbreviation || null}
                                    onChange={(value) => handleStateChange(value ?? '')}
                                    data={US_STATES.map((state) => ({
                                        value: state.abbreviation,
                                        label: state.name,
                                    }))}
                                    error={validationErrors.addressLine6}
                                    disabled={isLoadingAddress || readOnly}
                                    style={{flex: '0 0 30%'}}
                                />
                                <TextInput
                                    label="ZIP Code"
                                    withAsterisk
                                    value={addressLine7}
                                    onChange={(e) => setAddressLine7(e.currentTarget.value)}
                                    error={validationErrors.addressLine7}
                                    disabled={isLoadingAddress || readOnly}
                                    style={{flex: 1}}
                                />
                            </Group>
                        )}

                        {/* NZ Format: Suburb, City, Post Code */}
                        {!isUsTenant && (
                            <Group gap={16} align="flex-start" wrap="nowrap">
                                <TextInput
                                    label="Suburb"
                                    value={addressLine5}
                                    onChange={(e) => setAddressLine5(e.currentTarget.value)}
                                    disabled={isLoadingAddress || readOnly}
                                    style={{flex: '0 0 40%'}}
                                />
                                <TextInput
                                    label="City"
                                    withAsterisk
                                    value={addressLine6}
                                    onChange={(e) => setAddressLine6(e.currentTarget.value)}
                                    error={validationErrors.addressLine6}
                                    disabled={isLoadingAddress || readOnly}
                                    style={{flex: '0 0 40%'}}
                                />
                                <TextInput
                                    label="Post Code"
                                    withAsterisk
                                    value={addressLine7}
                                    onChange={(e) => setAddressLine7(e.currentTarget.value)}
                                    error={validationErrors.addressLine7}
                                    disabled={isLoadingAddress || readOnly}
                                    style={{flex: 1}}
                                />
                            </Group>
                        )}

                        {/* Line 8: Country */}
                        <TextInput
                            label="Country"
                            value={addressLine8}
                            onChange={(e) => setAddressLine8(e.currentTarget.value)}
                            disabled={isLoadingAddress || readOnly}
                        />

                        {/* Coordinates */}
                        <Group gap={16} align="flex-start" grow>
                            <NumberInput
                                label="Latitude"
                                value={latitude ?? ''}
                                onChange={(value) => setLatitude(value === '' ? undefined : Number(value))}
                                disabled={isLoadingAddress || readOnly}
                                decimalScale={6}
                            />
                            <NumberInput
                                label="Longitude"
                                value={longitude ?? ''}
                                onChange={(value) => setLongitude(value === '' ? undefined : Number(value))}
                                disabled={isLoadingAddress || readOnly}
                                decimalScale={6}
                            />
                        </Group>
                    </Stack>
                </Paper>

                {/* Shipment Details Card */}
                {showContactInfo && (
                    <Paper {...sectionPaperProps} p={0}>
                        {/*
                          * A real button, not a div with onClick: this toggles a
                          * region, so it needs to be reachable by keyboard and to
                          * report its state. `subtle` carries the hover the MUI
                          * version hand-rolled.
                          */}
                        <Button
                            variant="subtle"
                            color="gray"
                            fullWidth
                            justify="space-between"
                            h={52}
                            aria-expanded={isContactCardExpanded}
                            leftSection={<Icon tabler={IconTruck}/>}
                            rightSection={<Icon lucide={isContactCardExpanded ? ChevronUp : ChevronDown}/>}
                            onClick={() => setIsContactCardExpanded(!isContactCardExpanded)}
                        >
                            <Text fz="md" fw={500}>Shipment Details</Text>
                        </Button>

                        <Collapse expanded={isContactCardExpanded}>
                            <Stack gap={16} px={20} pb={20}>
                                {/* Contact Info */}
                                <Group gap={16} align="flex-start" grow>
                                    <TextInput
                                        label="Contact Name"
                                        value={contactName}
                                        onChange={(e) => setContactName(e.currentTarget.value)}
                                        disabled={readOnly}
                                    />
                                    <TextInput
                                        label="Contact Phone"
                                        type="tel"
                                        value={contactMobile}
                                        onChange={(e) => setContactMobile(e.currentTarget.value)}
                                        disabled={readOnly}
                                    />
                                </Group>

                                {/* Weight and Quantity */}
                                <Group gap={16} align="flex-start" grow>
                                    <NumberInput
                                        label={`Weight (${isUsTenant ? 'lbs' : 'kg'})`}
                                        min={0}
                                        step={0.1}
                                        value={weight ?? ''}
                                        onChange={(value) => setWeight(value === '' ? undefined : Number(value))}
                                        disabled={readOnly}
                                    />
                                    <NumberInput
                                        label="Quantity"
                                        min={1}
                                        allowDecimal={false}
                                        value={quantity ?? ''}
                                        onChange={(value) => setQuantity(value === '' ? undefined : Number(value))}
                                        disabled={readOnly}
                                    />
                                </Group>

                                {/* Dimensions */}
                                <Group gap={16} align="flex-start" grow>
                                    <NumberInput
                                        label={`Length (${isUsTenant ? 'in' : 'cm'})`}
                                        min={0}
                                        step={0.1}
                                        value={length ?? ''}
                                        onChange={(value) => setLength(value === '' ? undefined : Number(value))}
                                        disabled={readOnly}
                                    />
                                    <NumberInput
                                        label={`Width (${isUsTenant ? 'in' : 'cm'})`}
                                        min={0}
                                        step={0.1}
                                        value={depth ?? ''}
                                        onChange={(value) => setDepth(value === '' ? undefined : Number(value))}
                                        disabled={readOnly}
                                    />
                                    <NumberInput
                                        label={`Height (${isUsTenant ? 'in' : 'cm'})`}
                                        min={0}
                                        step={0.1}
                                        value={height ?? ''}
                                        onChange={(value) => setHeight(value === '' ? undefined : Number(value))}
                                        disabled={readOnly}
                                    />
                                </Group>

                                {/* Notes */}
                                <Textarea
                                    label="Notes"
                                    placeholder="Additional notes or special instructions..."
                                    rows={3}
                                    maxLength={150}
                                    value={jobNotes}
                                    onChange={(e) => setJobNotes(e.currentTarget.value)}
                                    disabled={readOnly}
                                />
                            </Stack>
                        </Collapse>
                    </Paper>
                )}

                {/* Map Section */}
                <Paper {...sectionPaperProps}>
                    <Group gap={8} mb={16} c="dimmed">
                        <Icon lucide={MapGlyph}/>
                        <Text fz="md" fw={500} c="var(--mantine-color-text)">Location Preview</Text>
                        {!readOnly && (
                            <Text fz="sm" c="dimmed" ml="auto">Click on the map to set coordinates</Text>
                        )}
                    </Group>

                    {/*
                      * `isolation: isolate` is load-bearing, and inline on purpose.
                      * HERE renders its bubbles and marker tooltips inside the map
                      * container at z-index ~1001, which paints over any sibling
                      * control rail — here MapZoomViewControls — unless this wrapper
                      * establishes its own stacking context. See CLAUDE.md.
                      */}
                    <Box
                        data-testid="edit-address-map-wrapper"
                        style={{
                            isolation: 'isolate',
                            position: 'relative',
                            width: '100%',
                            height: 300,
                            borderRadius: 'var(--mantine-radius-sm)',
                            overflow: 'hidden',
                            background: 'var(--mantine-color-gray-1)',
                        }}
                    >
                        <div ref={mapContainerRef} style={{width: '100%', height: '100%'}}/>
                        {mapInstance ? (
                            <MapZoomViewControls
                                map={mapInstance}
                                platform={platformInstance}
                                defaultLayers={defaultLayers}
                                showTraffic={false}
                                showIncidents={false}
                            />
                        ) : null}
                    </Box>
                </Paper>
            </Stack>
            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSave}
                confirmLabel={isSubmitting ? 'Saving...' : submitLabel}
                cancelLabel={readOnly ? 'Close' : 'Cancel'}
                confirmIcon={<Icon lucide={Save}/>}
                confirmDisabled={isSubmitting}
                submitting={isSubmitting}
                hideConfirm={readOnly}
            />
        </DialogShell>
    );
};

export default EditAddressDialog;
