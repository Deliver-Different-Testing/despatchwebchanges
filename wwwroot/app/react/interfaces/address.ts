/**
 * Address Dialog Interfaces
 *
 * TypeScript interfaces for the React Edit Address Dialog.
 * Mirrors the AngularJS interfaces from job.interface.ts
 */

// Base address model with 8 address lines
export interface AddressViewModel {
    addressLine1: string;  // Company/Building/Complex
    addressLine2: string;  // Unit/Suite
    addressLine3: string;  // Street Number
    addressLine4: string;  // Street Name
    addressLine5: string;  // City (US) or Suburb (NZ)
    addressLine6: string;  // State (US) or City (NZ)
    addressLine7: string;  // ZIP Code (US) or Post Code (NZ)
    addressLine8: string;  // Country
    latitude?: number;
    longitude?: number;
    fullAddress: string;
    toSuburbId?: number;
    cbd?: boolean;
    address?: string;
    our_suburb?: string;
}

// Extended address model for dialog with state abbreviation and shipment details
export interface EditAddressDialogViewModel extends AddressViewModel {
    stateAbbreviation?: string;
    shipmentDetails?: ShipmentDetails;
}

// Shipment details for the optional contact card
export interface ShipmentDetails {
    contactName?: string;
    contactMobile?: string;
    weight?: number;
    depth?: number;
    length?: number;
    height?: number;
    quantity?: number;
    jobNotes?: string;
}

// A tenant/user-configurable address format: an ordered subset of these named
// fields, each backed by one of the 8 fixed address lines above.
export type AddressFieldKey =
    | 'building'
    | 'unit'
    | 'streetNumber'
    | 'streetName'
    | 'cityOrSuburb'
    | 'stateOrCity'
    | 'postcode'
    | 'country';

// HERE Maps autocomplete result
export interface HereMapsPosition {
    lat: number;
    lng: number;
}

export interface HereMapsAddress {
    label: string;
    countryCode: string;
    countryName: string;
    stateCode?: string;
    state?: string;
    county?: string;
    city?: string;
    district?: string;
    street?: string;
    postalCode?: string;
    houseNumber?: string;
}

export interface HereMapsLocationResult {
    title: string;
    id: string;
    resultType: string;
    houseNumberType?: string;
    address: HereMapsAddress;
    position: HereMapsPosition;
    access: HereMapsPosition[];
}

// HERE Maps lookup response (detailed location info)
export interface HereMapsStreetInfo {
    baseName: string;
    streetType?: string;
    streetTypePrecedes?: boolean;
    streetTypeAttached?: boolean;
    prefix?: string;
    suffix?: string;
    direction?: string;
    language?: string;
}

export interface HereMapsMapReferences {
    pointAddress?: {
        addressId: string;
        buildingId?: string;
        buildingName?: string;
    };
}

export interface HereMapsLookupResponse {
    title: string;
    id: string;
    resultType?: string;
    address: HereMapsAddress;
    position: HereMapsPosition;
    streetInfo?: HereMapsStreetInfo[];
    mapReferences?: HereMapsMapReferences;
}

// US State info
export interface StateInfo {
    name: string;
    abbreviation: string;
}
