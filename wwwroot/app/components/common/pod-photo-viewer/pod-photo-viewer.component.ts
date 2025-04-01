import angular, {IComponentOptions} from "angular";
import {PodPhoto} from "./pod-photo-viewer.interfaces";
import "./pod-photo-viewer.styles.less";
import BaseController from "../../base-controller";

class PODPhotoViewerController extends BaseController {
    photos: PodPhoto[] = [];
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
}

export const PodPhotoViewerComponent: IComponentOptions = {
    template: require("./pod-photo-viewer.template.html"),
    bindings: {
        photos: '<',
        isOpen: '<',
        initialPhotoIndex: '<',
        onClose: '&'
    },
    controller: PODPhotoViewerController,
    controllerAs: "ctrl"
}
