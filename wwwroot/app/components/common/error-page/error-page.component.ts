import "./error-page.styles.less";
import { IAppConfig } from "../../../interfaces/app-config.interface";

export type ErrorType = 'notFound' | 'error' | 'forbidden' | 'serverError';

interface ErrorConfig {
    icon: string;
    title: string;
    message: string;
    code?: string;
}

class ErrorPageController implements angular.IController {
    static $inject = ['APP_CONFIG', '$state'];

    // Component bindings
    errorType?: ErrorType;
    customTitle?: string;
    customMessage?: string;

    readonly isUsCustomer: boolean;
    config!: ErrorConfig;

    private readonly errorConfigs: Record<ErrorType, ErrorConfig> = {
        notFound: {
            icon: 'search_off',
            title: 'Page Not Found',
            message: 'The page you are looking for does not exist or has been moved.',
            code: '404'
        },
        error: {
            icon: 'error_outline',
            title: 'Something Went Wrong',
            message: 'An unexpected error occurred. Please try again later.',
            code: 'Error'
        },
        forbidden: {
            icon: 'lock',
            title: 'Access Denied',
            message: 'You do not have permission to access this page.',
            code: '403'
        },
        serverError: {
            icon: 'cloud_off',
            title: 'Server Error',
            message: 'The server encountered an error. Please try again later.',
            code: '500'
        }
    };

    constructor(
        appConfig: IAppConfig,
        private $state: angular.ui.IStateService
    ) {
        this.isUsCustomer = appConfig.US_Customer;
    }

    $onInit() {
        const type = this.errorType || 'notFound';
        this.config = { ...this.errorConfigs[type] };

        // Override with custom values if provided
        if (this.customTitle) {
            this.config.title = this.customTitle;
        }
        if (this.customMessage) {
            this.config.message = this.customMessage;
        }
    }

    goHome() {
        this.$state.go('home');
    }

    goBack() {
        window.history.back();
    }
}

const ErrorPageComponent: angular.IComponentOptions = {
    template: require("./error-page.template.html"),
    bindings: {
        errorType: '@?',
        customTitle: '@?',
        customMessage: '@?'
    },
    controller: ErrorPageController,
    controllerAs: 'ctrl'
};

export default ErrorPageComponent;
