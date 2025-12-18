import {PodPhoto} from "./pod-photo-viewer.interfaces";
import "./pod-photo-viewer.styles.less";
import BaseController from "../../base-controller";

class PODPhotoViewerController extends BaseController {
    photos: PodPhoto[] = [];
    isOpen: boolean;
    initialPhotoIndex: number = 0;
    onClose: () => void = () => {};
    currentIndex: number = 0;

    // Cached formatted timezone
    formattedTimeZone: string = '';

    constructor() {
        super();

        this.isOpen = false;
        this.formattedTimeZone = this.getShortTimeZoneString();
    }

    $onInit() {
        this.currentIndex = this.initialPhotoIndex;
    }

    get currentPhoto(): PodPhoto | undefined {
        return this.photos?.[this.currentIndex];
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
}

export const PodPhotoViewerComponent: angular.IComponentOptions = {
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
