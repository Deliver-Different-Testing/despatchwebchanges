import {PodPhoto} from "./pod-photo-viewer.interfaces";
import "./pod-photo-viewer.styles.less";
import BaseController from "../../base-controller";
import {IComponentOptions} from "angular";

class PODPhotoViewerController extends BaseController {
    static $inject = [
        '$timeout',
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

    constructor(private $timeout: angular.ITimeoutService,
                private $log: angular.ILogService) {
        super();
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
            // Convert base64 to Uint8Array for better PDF.js compatibility
            const binaryString = atob(photo.url);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            this.pdfData = bytes;

            // Create blob URL as fallback
            const blob = new Blob([bytes], { type: 'application/pdf' });
            this.pdfSrc = URL.createObjectURL(blob);

            // Use $timeout to ensure DOM is updated
            this.$timeout(() => {
                this.showPdfViewer = true;
            }, 100);

        } catch (error) {
            this.$log.error('Error loading PDF data:', error);
            // Fallback to data URL
            this.pdfSrc = `data:application/pdf;base64,${photo.url}`;
            this.$timeout(() => {
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