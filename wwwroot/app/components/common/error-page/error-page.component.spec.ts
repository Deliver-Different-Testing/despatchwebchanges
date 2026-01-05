/**
 * Tests for ErrorPageComponent
 * Tests the controller logic for error page display and navigation
 */

// Import the component - we'll test the controller class directly
import ErrorPageComponent, { ErrorType } from './error-page.component';

// Extract the controller class from the component
const ErrorPageController = ErrorPageComponent.controller as any;

describe('ErrorPageComponent', () => {
    // Mock dependencies
    const mockAppConfig = { US_Customer: true };
    const mockState = { go: jest.fn() };

    const createController = (bindings: {
        errorType?: ErrorType;
        customTitle?: string;
        customMessage?: string;
    } = {}) => {
        const controller = new ErrorPageController(mockAppConfig, mockState);
        controller.errorType = bindings.errorType;
        controller.customTitle = bindings.customTitle;
        controller.customMessage = bindings.customMessage;
        return controller;
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Component Definition', () => {
        it('should have correct bindings defined', () => {
            expect(ErrorPageComponent.bindings).toEqual({
                errorType: '@?',
                customTitle: '@?',
                customMessage: '@?'
            });
        });

        it('should use ctrl as controllerAs', () => {
            expect(ErrorPageComponent.controllerAs).toBe('ctrl');
        });
    });

    describe('$onInit', () => {
        it('should default to notFound error type when none provided', () => {
            const controller = createController();
            controller.$onInit();

            expect(controller.config.code).toBe('404');
            expect(controller.config.title).toBe('Page Not Found');
            expect(controller.config.icon).toBe('search_off');
        });

        it('should set config for notFound error type', () => {
            const controller = createController({ errorType: 'notFound' });
            controller.$onInit();

            expect(controller.config).toEqual({
                icon: 'search_off',
                title: 'Page Not Found',
                message: 'The page you are looking for does not exist or has been moved.',
                code: '404'
            });
        });

        it('should set config for error type', () => {
            const controller = createController({ errorType: 'error' });
            controller.$onInit();

            expect(controller.config).toEqual({
                icon: 'error_outline',
                title: 'Something Went Wrong',
                message: 'An unexpected error occurred. Please try again later.',
                code: 'Error'
            });
        });

        it('should set config for forbidden error type', () => {
            const controller = createController({ errorType: 'forbidden' });
            controller.$onInit();

            expect(controller.config).toEqual({
                icon: 'lock',
                title: 'Access Denied',
                message: 'You do not have permission to access this page.',
                code: '403'
            });
        });

        it('should set config for serverError type', () => {
            const controller = createController({ errorType: 'serverError' });
            controller.$onInit();

            expect(controller.config).toEqual({
                icon: 'cloud_off',
                title: 'Server Error',
                message: 'The server encountered an error. Please try again later.',
                code: '500'
            });
        });

        it('should override title with customTitle when provided', () => {
            const controller = createController({
                errorType: 'notFound',
                customTitle: 'Custom Title'
            });
            controller.$onInit();

            expect(controller.config.title).toBe('Custom Title');
            expect(controller.config.code).toBe('404'); // Other fields unchanged
        });

        it('should override message with customMessage when provided', () => {
            const controller = createController({
                errorType: 'error',
                customMessage: 'Custom error message'
            });
            controller.$onInit();

            expect(controller.config.message).toBe('Custom error message');
            expect(controller.config.title).toBe('Something Went Wrong'); // Other fields unchanged
        });

        it('should override both title and message when both provided', () => {
            const controller = createController({
                errorType: 'forbidden',
                customTitle: 'Access Restricted',
                customMessage: 'Contact admin for access'
            });
            controller.$onInit();

            expect(controller.config.title).toBe('Access Restricted');
            expect(controller.config.message).toBe('Contact admin for access');
            expect(controller.config.code).toBe('403');
            expect(controller.config.icon).toBe('lock');
        });
    });

    describe('isUsCustomer', () => {
        it('should be true when APP_CONFIG.US_Customer is true', () => {
            const controller = new ErrorPageController({ US_Customer: true }, mockState);
            expect(controller.isUsCustomer).toBe(true);
        });

        it('should be false when APP_CONFIG.US_Customer is false', () => {
            const controller = new ErrorPageController({ US_Customer: false }, mockState);
            expect(controller.isUsCustomer).toBe(false);
        });
    });

    describe('Navigation', () => {
        it('goHome should navigate to home state', () => {
            const controller = createController();
            controller.goHome();

            expect(mockState.go).toHaveBeenCalledWith('home');
            expect(mockState.go).toHaveBeenCalledTimes(1);
        });

        it('goBack should call window.history.back', () => {
            const historyBackSpy = jest.spyOn(window.history, 'back');
            const controller = createController();

            controller.goBack();

            expect(historyBackSpy).toHaveBeenCalledTimes(1);
        });
    });
});
