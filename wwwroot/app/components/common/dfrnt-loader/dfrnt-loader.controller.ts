import app from "../../../app";
import template from "./dfrnt-loader.template.html";
import "./dfrnt-loader.styles.less";

export class DfrntLoaderController implements angular.IController {
    isLoading?: boolean;
    iconName?: string;

    $onInit(): void {
        // Initialize component
        if (this.isLoading === undefined) {
            this.isLoading = false;
        }

        // Set default icon if not provided
        if (this.iconName === undefined) {
            this.iconName = 'person_pin_circle';
        }
    }
}

export const DfrntLoader: angular.IComponentOptions = {
    template: template,
    bindings: {
        isLoading: '<',
        iconName: '<'
    },
    controller: DfrntLoaderController,
    controllerAs: 'ctrl'
};

app.component('dfrntLoader', DfrntLoader);
