import app from "../../../app";
import template from "./parcel-visualization.template.html";

class ParcelVisualizationController implements angular.IController {
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
        this.baseSize = 100;
        this.maxDimension = 200;
    }

    $onChanges(changes: any): void {
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

export class ParcelVisualizationDirective implements angular.IDirective {
    restrict = "E";
    scope = {
        length: "@",
        width: "@",
        height: "@"
    };
    template = template;
    controllerAs = "ctrl";
    controller = ParcelVisualizationController;

    static factory(): angular.IDirectiveFactory {
        return () => new ParcelVisualizationDirective();
    }
}

app.directive("parcelVisualization", ParcelVisualizationDirective.factory());
