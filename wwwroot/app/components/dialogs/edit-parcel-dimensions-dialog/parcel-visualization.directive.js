/**
 * @fileoverview Directive for visualizing parcel dimensions
 * @module ParcelVisualizationDirective
 */

/**
 * Controller for the Parcel Visualization
 */
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

/**
 * Directive definition for parcel visualization
 */
function parcelVisualizationDirective() {
    return {
        restrict: "E",
        scope: {
            length: "@",
            width: "@",
            height: "@"
        },
        template: `
            <svg width="100%" height="300" viewBox="0 0 400 300">
                <g ng-attr-transform="translate(200, 150) rotate(30) scale({{ $ctrl.scale }})">
                    <!-- Front face -->
                    <rect
                        ng-attr-width="{{ $ctrl.normalizedWidth }}"
                        ng-attr-height="{{ $ctrl.normalizedHeight }}"
                        fill="#E3F2FD"
                        stroke="#2196F3"
                        stroke-width="2"
                        x="0"
                        y="0">
                    </rect>

                    <!-- Top face -->
                    <path
                        ng-attr-d="M0,0 l{{ $ctrl.normalizedLength * -0.5 }},{{ $ctrl.normalizedLength * -0.3 }} h{{ $ctrl.normalizedWidth }} l{{ $ctrl.normalizedLength * 0.5 }},{{ $ctrl.normalizedLength * 0.3 }} z"
                        fill="#BBDEFB"
                        stroke="#2196F3"
                        stroke-width="2">
                    </path>

                    <!-- Side face -->
                    <path
                        ng-attr-d="M{{ $ctrl.normalizedWidth }},0 l{{ $ctrl.normalizedLength * 0.5 }},{{ $ctrl.normalizedLength * -0.3 }} v{{ $ctrl.normalizedHeight }} l{{ $ctrl.normalizedLength * -0.5 }},{{ $ctrl.normalizedLength * 0.3 }} z"
                        fill="#90CAF9"
                        stroke="#2196F3"
                        stroke-width="2">
                    </path>

                    <!-- Dimension labels -->
                    <text
                        ng-attr-x="{{ $ctrl.normalizedWidth / 2 }}"
                        ng-attr-y="{{ $ctrl.normalizedHeight + 25 }}"
                        text-anchor="middle"
                        fill="#1976D2"
                        class="dimension-label">
                        Width: {{ width }}"
                    </text>
                    
                    <text
                        ng-attr-x="{{ $ctrl.normalizedWidth + ($ctrl.normalizedLength * 0.5) + 10 }}"
                        ng-attr-y="{{ $ctrl.normalizedHeight / 2 }}"
                        text-anchor="start"
                        fill="#1976D2"
                        class="dimension-label">
                        Height: {{ height }}"
                    </text>
                    
                    <text
                        ng-attr-x="{{ $ctrl.normalizedWidth / 2 }}"
                        ng-attr-y="{{ $ctrl.normalizedLength * -0.3 - 10 }}"
                        text-anchor="middle"
                        fill="#1976D2"
                        class="dimension-label">
                        Length: {{ length }}"
                    </text>
                </g>
            </svg>
        `,
        controllerAs: "$ctrl",
        controller: ParcelVisualizationController
    };
}

angular.module("uDispatch")
    .directive("parcelVisualization", parcelVisualizationDirective);
