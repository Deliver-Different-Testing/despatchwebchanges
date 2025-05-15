export interface Position {
    lat: number;
    lng: number;
}

export interface MapView {
    west: number;
    south: number;
    east: number;
    north: number;
}

export interface FieldScore {
    streets?: number[];
    houseNumber?: number;
    placeName?: number;
}

export interface Scoring {
    queryScore: number;
    fieldScore: FieldScore;
}

export interface Address {
    label: string;
    countryCode: string;
    countryName: string;
    stateCode: string;
    state: string;
    county: string;
    city: string;
    district: string;
    street: string;
    postalCode: string;
    houseNumber: string;
}

export interface Category {
    id: string;
    name: string;
    primary?: boolean;
}

export interface FoodType {
    id: string;
    name: string;
    primary?: boolean;
}

export interface HereMapsLocationResult {
    title: string;
    id: string;
    resultType: string;
    houseNumberType?: string;
    address: Address;
    position: Position;
    access: Position[];
    mapView: MapView;
    estimatedPointAddress?: boolean;
    scoring: Scoring;
    categories?: Category[];
    foodTypes?: FoodType[];
}