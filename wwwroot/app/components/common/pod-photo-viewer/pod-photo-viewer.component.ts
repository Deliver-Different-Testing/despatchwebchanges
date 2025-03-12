import app from "../../../app";
import angular from "angular";
import {PodPhoto} from "./pod-photo-viewer.interfaces";
import "./pod-photo-viewer.styles.less";

class PODPhotoViewerController implements angular.IController {
    static $inject = [];

    photos: PodPhoto[] = [];
    isOpen: boolean = false;
    initialPhotoIndex: number = 0;
    onClose: () => void = () => {
    };
    currentIndex: number = 0;

    constructor() {
        this._bindFunctions()
    }

    private _bindFunctions() {
        this.$onInit = this.$onInit.bind(this);
        this.nextPhoto = this.nextPhoto.bind(this);
        this.prevPhoto = this.prevPhoto.bind(this);
        this.closeViewer = this.closeViewer.bind(this);
        this.setPhotoIndex = this.setPhotoIndex.bind(this);
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

const PodPhotoViewerComponent: angular.IComponentOptions = {
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

app.component("podPhotoViewer", PodPhotoViewerComponent);
