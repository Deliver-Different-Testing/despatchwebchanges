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
        this.baseSize = 25;
        this.maxDimension = 75;
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
            const defaultSize = 1;
            this.normalizedLength = defaultSize * this.baseSize;
            this.normalizedWidth = defaultSize * this.baseSize;
            this.normalizedHeight = defaultSize * this.baseSize;
            this.scale = 0.7;
            return;
        }

        const maxInputDimension = Math.max(l, w, h);

        if (l === w && w === h) {
            this.scale = 0.7;
        } else {
            this.scale = Math.min(0.65, this.maxDimension / (maxInputDimension * this.baseSize));
        }

        this.normalizedLength = l * this.baseSize;
        this.normalizedWidth = w * this.baseSize;
        this.normalizedHeight = h * this.baseSize;
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
