import "./no-data.styles.less";

class NoDataController implements angular.IController {
    // Component bindings
    title?: string;
    message?: string;
    icon?: string;
    actionText?: string;

    $onInit() {
        // Set default values
        this.title = this.title || 'No Data';
        this.message = this.message || 'No items to display.';
        this.icon = this.icon || 'info';
        this.actionText = this.actionText || 'Refresh';
    }
}

const NoDataComponent: angular.IComponentOptions = {
    template: require("./no-data.template.html"),
    bindings: {
        title: '@?',
        message: '@?',
        icon: '@?',
        actionText: '@?',
        onAction: '&?'
    },
    controller: NoDataController,
    controllerAs: 'ctrl'
}

export default NoDataComponent;
