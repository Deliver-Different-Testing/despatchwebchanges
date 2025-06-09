class BaseController implements angular.IController {
    protected eventDeregistrations: Array<() => void> = [];
    protected timeouts: Array<angular.IPromise<any>> = [];
    protected intervals: Array<angular.IPromise<any>> = [];
    protected debounceTimeouts: { [key: string]: angular.IPromise<any> } = {};

    protected $timeoutService?: angular.ITimeoutService;
    protected $intervalService?: angular.IIntervalService;
    protected $scopeService?: angular.IScope;

    constructor() {
        console.log('BaseController: Controller instantiated');
    }

    protected initServices(
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope?: angular.IScope): void {
        this.$timeoutService = $timeout;
        this.$intervalService = $interval;
        this.$scopeService = $scope;
    }

    protected watchEvent<T>(
        eventName: string,
        listener: (event: angular.IAngularEvent, ...args: T[]) => void
    ): void {
        if (this.$scopeService === undefined) throw new Error("Scope is undefined. Make sure you call initServices before using this method.");
        return this.registerEvent(this.$scopeService, eventName, listener);
    }

    private registerEvent<T>(
        scope: angular.IScope,
        eventName: string,
        listener: (event: angular.IAngularEvent, ...args: T[]) => void
    ): void {
        const deregister = scope.$on(eventName, listener);
        this.eventDeregistrations.push(deregister);
    }

    protected watchScope(
        watchExpression: string | Function | ((scope: angular.IScope) => any),
        listener: (newValue: any, oldValue: any, scope: angular.IScope) => void,
        objectEquality: boolean = false
    ): () => void {
        if(this.$scopeService === undefined) throw new Error("Scope is undefined. Make sure you call initServices before using this method.");
        return this.registerWatch(this.$scopeService, watchExpression, listener, objectEquality);
    }

    private registerWatch(
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

    protected debounce<T extends (...args: any[]) => any>(
        func: T,
        wait: number,
        key?: string
    ): (...args: Parameters<T>) => void {
        if (!this.$timeoutService) {
            throw new Error('$timeout service not initialized. Call initServices first.');
        }

        const timeoutKey = key || func.name || `debounce_${Math.random().toString(36).substring(2, 9)}`;

        return (...args: Parameters<T>) => {
            const existingTimeout = this.debounceTimeouts[timeoutKey];
            if (existingTimeout) {
                this.$timeoutService!.cancel(existingTimeout);
            }

            this.debounceTimeouts[timeoutKey] = this.$timeoutService!(
                () => {
                    func.apply(this, args);
                    delete this.debounceTimeouts[timeoutKey];
                },
                wait
            );
        };
    }

    protected applyScope(): void {
        if(this.$scopeService === undefined) throw new Error("Scope is undefined. Make sure you call initServices before using this method.");
        this.registerTimeout(() => this.$scopeService?.$apply());
    }

    $onDestroy(): void {
        if (this.$timeoutService) {
            Object.values(this.debounceTimeouts).forEach(timeout => {
                this.$timeoutService!.cancel(timeout);
            });
        }
        this.debounceTimeouts = {};

        // Cancel all timeouts
        if (this.$timeoutService) {
            const timeoutService = this.$timeoutService;
            this.timeouts.forEach(promise => {
                timeoutService.cancel(promise);
            });
        }
        this.timeouts = [];

        // Cancel all intervals
        if (this.$intervalService) {
            const intervalService = this.$intervalService;
            this.intervals.forEach(promise => {
                intervalService.cancel(promise);
            });
        }
        this.intervals = [];

        // Deregister all events
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
