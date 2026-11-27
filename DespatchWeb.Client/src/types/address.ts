/**
 * Address Dialog Interfaces
 *
 * TypeScript interfaces for the React Edit Address Dialog.
 * Mirrors the AngularJS interfaces from job.interface.ts
 */

import type {IAddressViewModel} from "./interfaces/job.interface";

// Base address model with 8 address lines
export type AddressViewModel = IAddressViewModel;

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

// A pickup or delivery format: which fields show, split across the two display
// lines a job-list cell renders (line 1 = primary, line 2 = dimmed second line).
export interface AddressLineFormat {
    line1: AddressFieldKey[];
    line2: AddressFieldKey[];
}

// Pickup and delivery are configured independently. `null` on a side means "no
// override here" — the effective format falls back to the tenant default, then
// to the legacy hardcoded NZ/US format.
export interface AddressFormatSides {
    pickup: AddressLineFormat | null;
    delivery: AddressLineFormat | null;
}

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
