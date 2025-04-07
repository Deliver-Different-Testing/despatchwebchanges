import BaseController from "../../../base-controller";

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

    constructor() {
        super();

        this.baseSize = 100;
        this.maxDimension = 200;
    }

    $onChanges(): void {
        this.updateDimensions();
    }

    updateDimensions(): void {
        const l = parseFloat(this.length) || 1;
        const w = parseFloat(this.width) || 1;
        const h = parseFloat(this.height) || 1;

        // Calculate scale to fit within SVG
        const maxInputDimension = Math.max(l, w, h);
        this.scale = Math.min(1, this.maxDimension / (maxInputDimension * this.baseSize));

        // Normalize dimensions relative to base size
        this.normalizedLength = l * this.baseSize;
        this.normalizedWidth = w * this.baseSize;
        this.normalizedHeight = h * this.baseSize;
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
