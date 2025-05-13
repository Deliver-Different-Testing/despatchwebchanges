import {bindAllMethods} from "../functions/bindAllMethods";

class BaseController implements angular.IController {
    protected eventDeregistrations: Array<() => void> = [];
    protected timeouts: Array<angular.IPromise<any>> = [];
    protected intervals: Array<angular.IPromise<any>> = [];

    protected $timeoutService?: angular.ITimeoutService;
    protected $intervalService?: angular.IIntervalService;

    constructor() {
        bindAllMethods(this);
    }

    protected initServices($timeout: angular.ITimeoutService, $interval: angular.IIntervalService): void {
        this.$timeoutService = $timeout;
        this.$intervalService = $interval;
    }

    protected registerEvent<T>(
        scope: angular.IScope,
        eventName: string,
        listener: (event: angular.IAngularEvent, ...args: T[]) => void
    ): void {
        const deregister = scope.$on(eventName, listener);
        this.eventDeregistrations.push(deregister);
    }

    protected registerWatch(
        scope: angular.IScope,
        watchExpression: string | Function | ((scope: angular.IScope) => any),
        listener: (newValue: any, oldValue: any, scope: angular.IScope) => void,
        objectEquality: boolean = false
    ): () => void {
        const deregister = scope.$watch(
            watchExpression as any,
            listener,
            objectEquality
        );

        this.eventDeregistrations.push(deregister);
        return deregister;
    }

    protected registerTimeout(
        fn: (...args: any[]) => any,
        delay: number = 0,
        invokeApply: boolean = true
    ): angular.IPromise<any> {
        if (!this.$timeoutService) {
            throw new Error('$timeout service not initialized. Call initServices first.');
        }

        const timeoutPromise = this.$timeoutService(fn, delay, invokeApply);
        this.timeouts.push(timeoutPromise);
        return timeoutPromise;
    }

    protected registerInterval(
        fn: (...args: any[]) => any,
        delay: number,
        count?: number,
        invokeApply: boolean = true
    ): angular.IPromise<any> {
        if (!this.$intervalService) {
            throw new Error('$interval service not initialized. Call initServices first.');
        }

        const intervalPromise = this.$intervalService(fn, delay, count, invokeApply);
        this.intervals.push(intervalPromise);
        return intervalPromise;
    }

    $onDestroy(): void {
        if (this.$timeoutService) {
            const timeoutService = this.$timeoutService;
            this.timeouts.forEach(promise => {
                timeoutService.cancel(promise);
            });
        }
        this.timeouts = [];

        // Cancel all registered interval
        if (this.$intervalService) {
            const intervalService = this.$intervalService;
            this.intervals.forEach(promise => {
                intervalService.cancel(promise);
            });
        }
        this.intervals = [];

        this.eventDeregistrations.forEach(deregister => {
            if (typeof deregister === 'function') {
                try {
                    deregister();
                } catch (e) {
                    console.error('Error during event deregistration:', e);
                }
            }
        });
        this.eventDeregistrations = [];
    }
}

export default BaseController;
