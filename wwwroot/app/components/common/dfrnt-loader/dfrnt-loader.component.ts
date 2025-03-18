import "./dfrnt-loader.styles.less";

class DfrntLoaderController implements angular.IController {
    isLoading?: boolean;
    iconName?: string;

    $onInit(): void {
        if (this.isLoading === undefined) {
            this.isLoading = false;
        }

        if (this.iconName === undefined) {
            this.iconName = 'person_pin_circle';
        }
    }
}

export const DfrntLoaderComponent: angular.IComponentOptions = {
    template: require("./dfrnt-loader.template.html"),
    bindings: {
        isLoading: '<',
        iconName: '<'
    },
    controller: DfrntLoaderController,
    controllerAs: 'ctrl'
};
