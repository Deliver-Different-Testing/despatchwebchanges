export interface DfrntPageViewModel {
    id: number;
    name: string;
    centerLatitude: number;
    centerLongitude: number;
    selected: boolean;
}

export interface ClearListEnvelopeViewModel {
    minimumLatitude: number;
    minimumLongitude: number;
    maximumLatitude: number;
    maximumLongitude: number;
}

export interface EnvelopeCoordinate {
    longitude: number;
    latitude: number;
}
