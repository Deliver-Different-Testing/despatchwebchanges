"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PodPhotoViewerComponent = void 0;
require("./pod-photo-viewer.styles.less");
class PODPhotoViewerController {
    constructor() {
        this.photos = [];
        this.isOpen = false;
        this.initialPhotoIndex = 0;
        this.onClose = () => {
        };
        this.currentIndex = 0;
        this._bindFunctions();
    }
    _bindFunctions() {
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
    setPhotoIndex(index) {
        this.currentIndex = index;
    }
}
PODPhotoViewerController.$inject = [];
exports.PodPhotoViewerComponent = {
    template: require("./pod-photo-viewer.template.html"),
    bindings: {
        photos: '<',
        isOpen: '<',
        initialPhotoIndex: '<',
        onClose: '&'
    },
    controller: PODPhotoViewerController,
    controllerAs: "ctrl"
};
