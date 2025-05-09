"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DfrntLoaderComponent = void 0;
require("./dfrnt-loader.styles.less");
class DfrntLoaderController {
    $onInit() {
        if (this.isLoading === undefined) {
            this.isLoading = false;
        }
        if (this.iconName === undefined) {
            this.iconName = 'person_pin_circle';
        }
    }
}
exports.DfrntLoaderComponent = {
    template: require("./dfrnt-loader.template.html"),
    bindings: {
        isLoading: '<',
        iconName: '<'
    },
    controller: DfrntLoaderController,
    controllerAs: 'ctrl'
};
