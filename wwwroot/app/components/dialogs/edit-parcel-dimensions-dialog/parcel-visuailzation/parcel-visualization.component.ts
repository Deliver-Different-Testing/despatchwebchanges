import BaseController from "../../../base-controller";
import "./parcel-visualization.styles.less";

class ParcelVisualizationController extends BaseController {
    baseSize: number;
    fixedScale: number;
    normalizedLength?: number;
    normalizedWidth?: number;
    normalizedHeight?: number;
    length!: string;
    width!: string;
    height!: string;
    hasValidDimensions: boolean = false;

    constructor() {
        super();
        this.baseSize = 25;
        this.fixedScale = 0.7; // Fixed scale for all parcels
    }

    $onInit(): void {
        this.updateDimensions();
    }

    $onChanges(): void {
        this.updateDimensions();
    }

    updateDimensions(): void {
        const l = parseFloat(this.length) || 0;
        const w = parseFloat(this.width) || 0;
        const h = parseFloat(this.height) || 0;

        this.hasValidDimensions = l > 0 && w > 0 && h > 0;

        if (!this.hasValidDimensions) {
            // Set default size for invalid dimensions
            const defaultSize = 1;
            this.normalizedLength = defaultSize * this.baseSize;
            this.normalizedWidth = defaultSize * this.baseSize;
            this.normalizedHeight = defaultSize * this.baseSize;
            return;
        }

        // Use fixed relative proportions
        // We'll maintain the aspect ratio between the dimensions
        // but scale them to fit in a consistent visual space
        const aspectRatio = {
            length: l / Math.max(l, w, h),
            width: w / Math.max(l, w, h),
            height: h / Math.max(l, w, h)
        };

        // Set normalized dimensions with fixed base size
        // This ensures the parcel always takes up the same visual space
        const fixedReferenceSize = 3; // Reference size for all parcels
        this.normalizedLength = aspectRatio.length * fixedReferenceSize * this.baseSize;
        this.normalizedWidth = aspectRatio.width * fixedReferenceSize * this.baseSize;
        this.normalizedHeight = aspectRatio.height * fixedReferenceSize * this.baseSize;
    }

    calculateVolume(): number {
        const l = parseFloat(this.length) || 0;
        const w = parseFloat(this.width) || 0;
        const h = parseFloat(this.height) || 0;
        return l * w * h;
    }
}

const ParcelVisualizationComponent: angular.IComponentOptions = {
    template: require("./parcel-visualization.template.html"),
    controller: ParcelVisualizationController,
    controllerAs: "ctrl",
    bindings: {
        length: "@",
        width: "@",
        height: "@"
    }
}

export default ParcelVisualizationComponent;
