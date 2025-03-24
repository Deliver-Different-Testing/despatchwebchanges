import "./dfrnt-loader.styles.less";

class DfrntLoaderController implements angular.IController {
    isLoading?: boolean;
    iconName?: string;

    $onInit() {
        if (!this.isLoading) {
            this.isLoading = false;
        }

        if (!this.iconName) {
            this.iconName = 'person_pin_circle';
        }
    }
}

const DfrntLoaderComponent: angular.IComponentOptions = {
    template: require("./dfrnt-loader.template.html"),
    bindings: {
        isLoading: '<',
        iconName: '<'
    },
    controller: DfrntLoaderController,
    controllerAs: 'ctrl'
};
export default DfrntLoaderComponent;
