// State management for the viewer
import {PodPhoto} from "./pod-photo-viewer.types";

export interface ViewerState {
    isOpen: boolean;
    photos: PodPhoto[];
    initialPhotoIndex: number;
    timeZone?: string;
    onCloseCallback?: () => void;
}
