"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParcelVisualizationDirective = exports.ParcelVisualizationController = void 0;
const parcel_visualization_template_html_1 = __importDefault(require("./parcel-visualization.template.html"));
class ParcelVisualizationController {
    constructor() {
        this.baseSize = 100;
        this.maxDimension = 200;
    }
    $onChanges(changes) {
        this.updateDimensions();
    }
    updateDimensions() {
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
exports.ParcelVisualizationController = ParcelVisualizationController;
class ParcelVisualizationDirective {
    constructor() {
        this.restrict = "E";
        this.scope = {
            length: "@",
            width: "@",
            height: "@"
        };
        this.template = parcel_visualization_template_html_1.default;
        this.controllerAs = "ctrl";
        this.controller = ParcelVisualizationController;
    }
    static factory() {
        return () => new ParcelVisualizationDirective();
    }
}
exports.ParcelVisualizationDirective = ParcelVisualizationDirective;
