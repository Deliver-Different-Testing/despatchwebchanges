import "./no-data.styles.less";

class NoDataController implements angular.IController {
    title?: string;
    message?: string;
    icon?: string;
    actionText?: string;
    onAction?: Function;

    $onInit() {
        this.title = this.title || 'No Data Available';
        this.message = this.message || 'There are currently no items to display. New data will appear here when available.';
        this.icon = this.icon || 'dataset';
        this.actionText = this.actionText || 'Refresh';
    }

    handleAction() {
        if (this.onAction) {
            this.onAction();
        }
    }
}

const NoDataComponent: angular.IComponentOptions = {
    template: require("./no-data.template.html"),
    bindings: {
        title: '@?',
        message: '@?',
        icon: '@?',
        showAction: '<?',
        actionText: '@?',
        onAction: '&?'
    },
    controller: NoDataController,
    controllerAs: 'ctrl'
}
export default NoDataComponent;
