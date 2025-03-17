import {Coordinates} from "../../overview/overview.interfaces";

export interface PodPhoto {
    url: string;
    timestamp?: string;
    uploadedBy: string;
    coordinates?: Coordinates;
}
