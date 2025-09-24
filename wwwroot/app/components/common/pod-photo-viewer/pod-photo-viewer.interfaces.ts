import {Coordinates} from "../../overview/overview.interfaces";

export interface PodPhoto {
    url: string;
    timestamp?: string;
    uploadedBy: string;
    coordinates?: Coordinates;
    contentType?: string;
    fileName?: string;
    s3Key?: string;
}
