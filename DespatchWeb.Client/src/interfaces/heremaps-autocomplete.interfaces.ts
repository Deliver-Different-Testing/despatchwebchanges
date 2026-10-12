export interface IPosition {
    lat: number;
    lng: number;
}

export interface IMapView {
    west: number;
    south: number;
    east: number;
    north: number;
}

export interface IFieldScore {
    streets?: number[];
    houseNumber?: number;
    placeName?: number;
}

export interface IScoring {
    queryScore: number;
    fieldScore: IFieldScore;
}

export interface IAddress {
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

export interface ICategory {
    id: string;
    name: string;
    primary?: boolean;
}

export interface IFoodType {
    id: string;
    name: string;
    primary?: boolean;
}

export interface IHereMapsLocationResult {
    title: string;
    id: string;
    resultType: string;
    houseNumberType?: string;
    address: IAddress;
    position: IPosition;
    access: IPosition[];
    mapView: IMapView;
    estimatedPointAddress?: boolean;
    scoring: IScoring;
    categories?: ICategory[];
    foodTypes?: IFoodType[];
}