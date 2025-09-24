import angular, {IComponentOptions} from "angular";
import {PodPhoto} from "./pod-photo-viewer.interfaces";
import "./pod-photo-viewer.styles.less";
import BaseController from "../../base-controller";

class PODPhotoViewerController extends BaseController {
    photos: PodPhoto[] = [];
    timeZone?: string;
    isOpen: boolean = false;
    initialPhotoIndex: number = 0;
    onClose: () => void = () => {
    };
    currentIndex: number = 0;

    constructor() {
        super();
    }

    $onInit() {
        this.currentIndex = this.initialPhotoIndex;
    }

    nextPhoto() {
        this.currentIndex = (this.currentIndex + 1) % this.photos.length;
    }

    prevPhoto() {
        this.currentIndex = (this.currentIndex - 1 + this.photos.length) % this.photos.length;
    }

    closeViewer() {
        if (this.onClose) {
            this.onClose();
        }
    }

    setPhotoIndex(index: number) {
        this.currentIndex = index;
    }

    isPdfFile(photo: PodPhoto): boolean {
        if (!photo) return false;

        if ((photo as any).contentType) {
            return (photo as any).contentType === 'application/pdf';
        }

        // Check if filename has .pdf extension
        if ((photo as any).fileName) {
            return (photo as any).fileName.toLowerCase().endsWith('.pdf');
        }

        // Check if the s3Key indicates it's a PDF
        if ((photo as any).s3Key) {
            return (photo as any).s3Key.toLowerCase().endsWith('.pdf');
        }

        return false;
    }
}

export const PodPhotoViewerComponent: IComponentOptions = {
    template: require("./pod-photo-viewer.template.html"),
    bindings: {
        photos: '<',
        timeZone: '<',
        isOpen: '<',
        initialPhotoIndex: '<',
        onClose: '&'
    },
    controller: PODPhotoViewerController,
    controllerAs: "ctrl"
}
