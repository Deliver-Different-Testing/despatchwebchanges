import "./pod-photo-viewer.styles.less";
import {PodPhoto} from "./pod-photo-viewer.interfaces";
import BaseController from "../../base-controller";

class PODPhotoViewerController extends BaseController {
    static $inject = [
        '$timeout',
        '$interval',
        '$log',
    ];

    photos: PodPhoto[] = [];
    timeZone?: string;
    isOpen: boolean = false;
    initialPhotoIndex: number = 0;
    onClose: () => void = () => {};
    currentIndex: number = 0;

    // PDF viewer specific properties
    pdfData: Uint8Array | null = null;
    pdfSrc: string = '';
    showPdfViewer: boolean = false;

    constructor(
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private $log: angular.ILogService) {
        super();
        this.initServices($timeout, $interval);
    }

    $onInit() {
        this.currentIndex = this.initialPhotoIndex;
    }

    $onChanges(changes: any) {
        if (changes.isOpen && this.isOpen) {
            this.loadCurrentPhoto();
        }
    }

    nextPhoto() {
        this.currentIndex = (this.currentIndex + 1) % this.photos.length;
        this.loadCurrentPhoto();
    }

    prevPhoto() {
        this.currentIndex = (this.currentIndex - 1 + this.photos.length) % this.photos.length;
        this.loadCurrentPhoto();
    }

    closeViewer() {
        this.showPdfViewer = false;
        this.pdfData = null; 
        this.pdfSrc = '';
        if (this.onClose) {
            this.onClose();
        }
    }

    setPhotoIndex(index: number) {
        this.currentIndex = index;
        this.loadCurrentPhoto();
    }

    isPdfFile(photo: PodPhoto): boolean {
        if (!photo) return false;

        // Check if filename has .pdf extension
        if (photo.fileName) {
            return photo.fileName.toLowerCase().endsWith('.pdf');
        }

        // Check if the s3Key indicates it's a PDF
        if (photo.s3Key) {
            return photo.s3Key.toLowerCase().endsWith('.pdf');
        }

        // Check if the data URL indicates it's a PDF
        if (photo.url && photo.url.startsWith('data:application/pdf')) {
            return true;
        }

        // Check for the PDF magic number in base64
        return !!(photo.url && photo.url.includes('JVBERi0'));
    }

    private loadCurrentPhoto() {
        const currentPhoto = this.photos[this.currentIndex];
        if (!currentPhoto) return;

        if (this.isPdfFile(currentPhoto)) {
            this.loadPdfData(currentPhoto);
        } else {
            this.showPdfViewer = false;
            this.pdfData = null;
            this.pdfSrc = '';
        }
    }

    private loadPdfData(photo: PodPhoto) {
        try {
            // Handle different data formats
            let base64Data: string;

            if (photo.url.startsWith('data:application/pdf;base64,')) {
                // Remove data URL prefix
                base64Data = photo.url.replace('data:application/pdf;base64,', '');
            } else if (photo.url.startsWith('data:')) {
                // Handle other data URL formats
                const commaIndex = photo.url.indexOf(',');
                if (commaIndex !== -1) {
                    base64Data = photo.url.substring(commaIndex + 1);
                } else {
                    base64Data = photo.url;
                }
            } else {
                // Assume it's already base64
                base64Data = photo.url;
            }

            // Convert base64 to Uint8Array for better PDF.js compatibility
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            this.pdfData = bytes;

            // Create blob URL as fallback
            const blob = new Blob([bytes], {type: 'application/pdf'});
            this.pdfSrc = URL.createObjectURL(blob);

            this.registerTimeout(() => {
                this.showPdfViewer = true;
            }, 100);

        } catch (error) {
            this.$log.error('Error loading PDF data:', error);
            // Fallback to data URL
            this.pdfSrc = `data:application/pdf;base64,${photo.url}`;
            this.registerTimeout(() => {
                this.showPdfViewer = true;
            }, 100);
        }
    }

    downloadPdf(photo: PodPhoto): void {
        if (!photo || !this.isPdfFile(photo)) return;

        const dataUrl = `data:application/pdf;base64,${photo.url}`;
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = (photo as any).fileName || 'document.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    onPdfInit() {
        this.$log.log('PDF viewer initialized');
    }

    onPdfPageLoad(pageNum: number) {
        this.$log.log('PDF page loaded:', pageNum);
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