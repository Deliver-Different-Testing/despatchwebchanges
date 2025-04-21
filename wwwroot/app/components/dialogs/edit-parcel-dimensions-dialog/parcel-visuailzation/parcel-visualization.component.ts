import BaseController from "../../../base-controller";
import "./parcel-visualization.styles.less";

class ParcelVisualizationController extends BaseController {
    baseSize: number;
    maxDimension: number;
    scale?: number;
    normalizedLength?: number;
    normalizedWidth?: number;
    normalizedHeight?: number;
    length!: string;
    width!: string;
    height!: string;
    hasValidDimensions: boolean = false;

    constructor() {
        super();
        // Adjusted base size to better fit in dialog
        this.baseSize = 50;
        this.maxDimension = 100;
    }

    $onInit(): void {
        this.updateDimensions();
    }

    $onChanges(): void {
        this.updateDimensions();
    }

    updateDimensions(): void {
        // Parse dimensions, defaulting to 0 if invalid
        const l = parseFloat(this.length) || 0;
        const w = parseFloat(this.width) || 0;
        const h = parseFloat(this.height) || 0;

        // Check if we have valid dimensions (all greater than 0)
        this.hasValidDimensions = l > 0 && w > 0 && h > 0;

        if (!this.hasValidDimensions) {
            // Set minimal placeholder dimensions for invalid values
            const defaultSize = 1;
            this.normalizedLength = defaultSize * this.baseSize;
            this.normalizedWidth = defaultSize * this.baseSize;
            this.normalizedHeight = defaultSize * this.baseSize;
            this.scale = 0.5; // Reduced scale for placeholder
            return;
        }

        // Calculate appropriate scale based on largest dimension
        // This ensures the parcel fits properly in the visualization area
        const maxInputDimension = Math.max(l, w, h);
        this.scale = Math.min(0.9, this.maxDimension / (maxInputDimension * this.baseSize));

        // Normalize dimensions relative to base size
        this.normalizedLength = l * this.baseSize;
        this.normalizedWidth = w * this.baseSize;
        this.normalizedHeight = h * this.baseSize;
    }

    // Calculate volume for display
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
