import app from "../../../app";
import angular from "angular";
import {PodPhoto} from "./pod-photo-viewer.interfaces";

// Html and style
import template from "./pod-photo-viewer.template.html";
import "./pod-photo-viewer.styles.less";

class PODPhotoViewerController implements angular.IController {
    static $inject = [];

    public photos: PodPhoto[] = [];
    public isOpen: boolean = false;
    public initialPhotoIndex: number = 0;
    public onClose: () => void = () => {
    };
    public currentIndex: number = 0;


    public nextPhoto(): void {
        this.currentIndex = (this.currentIndex + 1) % this.photos.length;
    }

    public prevPhoto(): void {
        this.currentIndex = (this.currentIndex - 1 + this.photos.length) % this.photos.length;
    }

    public closeViewer(): void {
        if (this.onClose) {
            this.onClose();
        }
    }

    public setPhotoIndex(index: number): void {
        this.currentIndex = index;
    }

    $onInit(): void {
        this.currentIndex = this.initialPhotoIndex;
    }
}

class PODPhotoViewerDirective implements angular.IDirective {
    restrict: 'E';
    template: string;
    scope: {
        photos: '<',
        isOpen: '<',
        initialPhotoIndex: '<',
        onClose: '&'
    };
    controller: any;
    controllerAs: string;
    bindToController: boolean;

    constructor() {
        this.restrict = 'E';
        this.template = template;
        this.scope = {
            photos: '<',
            isOpen: '<',
            initialPhotoIndex: '<',
            onClose: '&'
        };
        this.controller = PODPhotoViewerController;
        this.controllerAs = "ctrl";
        this.bindToController = true;
    }

    static factory(): angular.IDirectiveFactory {
        return () => new PODPhotoViewerDirective();
    }
}

app.directive("podPhotoViewer", PODPhotoViewerDirective.factory());
