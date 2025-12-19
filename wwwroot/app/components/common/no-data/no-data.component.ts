import "./no-data.styles.less";
import { IAppConfig } from "../../../interfaces/app-config.interface";

class NoDataController implements angular.IController {
    static $inject = ['APP_CONFIG'];

    // Component bindings
    title?: string;
    message?: string;
    icon?: string;
    showAction?: string | boolean;
    actionText?: string;
    onAction?: () => void;

    readonly isUsCustomer: boolean;

    constructor(appConfig: IAppConfig) {
        this.isUsCustomer = appConfig.US_Customer;
    }

    $onInit() {
        // Set default values
        this.title = this.title || 'No Data';
        this.message = this.message || 'No items to display.';
        this.icon = this.icon || 'info';
        this.showAction = this.showAction || false;
        this.actionText = this.actionText || 'Refresh';
    }

    handleAction() {
        if (this.onAction && typeof this.onAction === 'function') {
            this.onAction();
        }
    }

    shouldShowAction(): boolean {
        if (typeof this.showAction === 'string') {
            return this.showAction.toLowerCase() === 'true';
        }
        return !!this.showAction;
    }
}

const NoDataComponent: angular.IComponentOptions = {
    template: require("./no-data.template.html"),
    bindings: {
        title: '@?',
        message: '@?',
        icon: '@?',
        showAction: '@?',
        actionText: '@?',
        onAction: '&?'
    },
    controller: NoDataController,
    controllerAs: 'ctrl'
}

export default NoDataComponent;
