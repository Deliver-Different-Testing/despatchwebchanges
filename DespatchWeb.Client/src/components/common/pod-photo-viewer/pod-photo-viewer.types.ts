export interface Coordinates {
    lat: number;
    lng: number;
}

export interface PodPhoto {
    url: string;
    timestamp?: string;
    uploadedBy: string;
    coordinates?: Coordinates;
    contentType?: string;
    fileName?: string;
    s3Key?: string;
}

export interface PodPhotoViewerProps {
    photos: PodPhoto[];
    isOpen: boolean;
    initialPhotoIndex?: number;
    timeZone?: string;
    onClose: () => void;
}