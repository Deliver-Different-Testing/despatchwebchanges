import {getIanaTimezone} from "../react/utils/dateUtils";
import {TimeZone} from "../contants";
import {timezoneShortFilter} from "../filters";
import angular from 'angular';

class BaseController implements angular.IController {
    protected eventDeregistrations: Array<() => void> = [];
    protected timeouts: Array<angular.IPromise<any>> = [];
    protected intervals: Array<angular.IPromise<any>> = [];
    protected debounceTimeouts: { [key: string]: angular.IPromise<any> } = {};

    private watchers: Array<() => void> = [];
    private dataCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
    
    protected $timeoutService?: angular.ITimeoutService;
    protected $intervalService?: angular.IIntervalService;
    protected $scopeService?: angular.IScope;

    private pendingApply = false;
    protected debouncedApplyScope?: (...args: any[]) => void;
    
    constructor() {
        // no-op — lifecycle managed by initServices() and $onDestroy()
    }

    protected initServices(
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope?: angular.IScope): void {
        this.$timeoutService = $timeout;
        this.$intervalService = $interval;
        this.$scopeService = $scope;

        this.debouncedApplyScope = this.debounce(() => {
            if (this.$scopeService && !this.$scopeService.$$phase) {
                this.$scopeService.$evalAsync();
            }
            this.pendingApply = false;
        }, 16);
    }
    
    protected applyScope(): void {
        if (!this.pendingApply && this.debouncedApplyScope) {
            this.pendingApply = true;
            this.debouncedApplyScope();
        } else if (!this.debouncedApplyScope && this.$scopeService && !this.$scopeService.$$phase) {
            // Fallback for before services are initialized
            this.$scopeService.$evalAsync();
        }
    }

    protected watchEvent<T>(
        eventName: string,
        listener: (event: angular.IAngularEvent, ...args: T[]) => void,
        useDebounce: boolean = false,
        debounceDelay: number = 100
    ): void {
        if (!this.$scopeService) throw new Error("Scope is undefined");

        const actualListener = useDebounce
            ? this.debounce(listener, debounceDelay, `event_${eventName}`)
            : listener;

        const deregister = this.$scopeService.$on(eventName, actualListener);
        this.eventDeregistrations.push(deregister);
    }
    
    protected registerTimeout(
        fn: (...args: any[]) => any,
        delay: number = 0,
        invokeApply: boolean = true
    ): angular.IPromise<any> {
        if (!this.$timeoutService) {
            throw new Error('$timeout service not initialized');
        }

        const timeoutPromise = this.$timeoutService(fn, delay, invokeApply);
        this.timeouts.push(timeoutPromise);

        timeoutPromise.finally(() => {
            const index = this.timeouts.indexOf(timeoutPromise);
            if (index > -1) {
                this.timeouts.splice(index, 1);
            }
        });

        return timeoutPromise;
    }

    protected debounce<T extends (...args: any[]) => any>(
        func: T,
        wait: number,
        key?: string
    ): (...args: Parameters<T>) => void {
        if (!this.$timeoutService) {
            throw new Error('$timeout service not initialized');
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

    protected registerInterval(
        fn: (...args: any[]) => any,
        delay: number,
        count?: number,
        invokeApply: boolean = true
    ): angular.IPromise<any> {
        if (!this.$intervalService) {
            throw new Error('$interval service not initialized');
        }

        const intervalPromise = this.$intervalService(fn, delay, count, invokeApply);
        this.intervals.push(intervalPromise);
        return intervalPromise;
    }
    
    protected cancelInterval(intervalPromise: angular.IPromise<any>): boolean {
        if (!intervalPromise || !this.$intervalService) {
            return false;
        }

        try {
            this.$intervalService.cancel(intervalPromise);

            // Remove from the interval array
            const index = this.intervals.indexOf(intervalPromise);
            if (index > -1) {
                this.intervals.splice(index, 1);
            }

            return true;
        } catch (error) {
            console.error('Error cancelling interval:', error);
            return false;
        }
    }
    
    $onDestroy(): void {
        // Cancel debounced timeouts
        if (this.$timeoutService) {
            Object.values(this.debounceTimeouts).forEach(timeout => {
                this.$timeoutService!.cancel(timeout);
            });
        }
        this.debounceTimeouts = {};

        // Cancel all timeouts
        if (this.$timeoutService) {
            this.timeouts.forEach(promise => {
                this.$timeoutService!.cancel(promise);
            });
        }
        this.timeouts = [];

        // Cancel all intervals
        if (this.$intervalService) {
            this.intervals.forEach(promise => {
                this.$intervalService!.cancel(promise);
            });
        }
        this.intervals = [];

        // Deregister all watchers
        this.watchers.forEach(deregister => {
            if (typeof deregister === 'function') {
                try {
                    deregister();
                } catch (e) {
                    console.error('Error during watcher deregistration:', e);
                }
            }
        });
        this.watchers = [];

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

        // Clear cache
        this.dataCache.clear();

        // All resources cleaned up
    }

    // Filters
    protected getShortTimeZoneString() {
       const ianaTimeZone = getIanaTimezone(TimeZone)
        return timezoneShortFilter(ianaTimeZone);
    }
}

export default BaseController;