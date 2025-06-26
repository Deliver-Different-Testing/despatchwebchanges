class BaseController implements angular.IController {
    protected eventDeregistrations: Array<() => void> = [];
    protected timeouts: Array<angular.IPromise<any>> = [];
    protected intervals: Array<angular.IPromise<any>> = [];
    protected debounceTimeouts: { [key: string]: angular.IPromise<any> } = {};

    private watchers: Array<() => void> = [];
    private dataCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
    private performanceMetrics: { [key: string]: number } = {};

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

        this.debouncedApplyScope = this.debounce(() => {
            if (this.$scopeService && !this.$scopeService.$$phase) {
                this.$scopeService.$evalAsync();
            }
            this.pendingApply = false;
        }, 16); // ~60fps
    }

    protected watchOnce(
        watchExpression: string | Function,
        listener: (newValue: any, oldValue: any, scope: angular.IScope) => void
    ): void {
        if (!this.$scopeService) throw new Error("Scope is undefined");

        const deregister = this.$scopeService.$watch(watchExpression as any, (newVal, oldVal, scope) => {
            if (newVal !== oldVal) {
                listener(newVal, oldVal, scope);
                deregister(); // Auto-deregister after first change
            }
        });

        this.watchers.push(deregister);
    }

    private pendingApply = false;
    protected debouncedApplyScope?: (...args: any[]) => void;

    protected applyScope(): void {
        if (!this.pendingApply && this.debouncedApplyScope) {
            this.pendingApply = true;
            this.debouncedApplyScope();
        } else if (!this.debouncedApplyScope && this.$scopeService && !this.$scopeService.$$phase) {
            // Fallback for before services are initialized
            this.$scopeService.$evalAsync();
        }
    }

    protected getCachedData<T>(key: string, ttl: number = 300000): T | null {
        const cached = this.dataCache.get(key);
        if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
            return cached.data;
        }
        return null;
    }

    protected setCachedData<T>(key: string, data: T, ttl: number = 300000): void {
        this.dataCache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    protected clearCache(keyPattern?: string): void {
        if (keyPattern) {
            const regex = new RegExp(keyPattern);
            for (const [key] of this.dataCache) {
                if (regex.test(key)) {
                    this.dataCache.delete(key);
                }
            }
        } else {
            this.dataCache.clear();
        }
    }

    protected measurePerformance<T>(
        key: string,
        operation: () => T | Promise<T>
    ): T | Promise<T> {
        const startTime = performance.now();

        const result = operation();

        if (result instanceof Promise) {
            return result.finally(() => {
                this.performanceMetrics[key] = performance.now() - startTime;
                console.log(`[Performance] ${key}: ${this.performanceMetrics[key].toFixed(2)}ms`);
            });
        } else {
            this.performanceMetrics[key] = performance.now() - startTime;
            console.log(`[Performance] ${key}: ${this.performanceMetrics[key].toFixed(2)}ms`);
            return result;
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

    protected updateCollection<T>(
        collection: T[],
        newItems: T[],
        keyProperty: keyof T
    ): T[] {
        if (!collection || !newItems) return newItems || [];

        const existingMap = new Map(collection.map(item => [item[keyProperty], item]));
        const result: T[] = [];

        // Update existing items and add new ones
        for (const newItem of newItems) {
            const key = newItem[keyProperty];
            const existing = existingMap.get(key);

            if (existing) {
                // Update existing item properties
                Object.assign(existing, newItem);
                result.push(existing);
                existingMap.delete(key);
            } else {
                result.push(newItem);
            }
        }

        return result;
    }

    protected batchDOMUpdates(updates: Array<() => void>): void {
        this.registerTimeout(() => {
            updates.forEach(update => update());
        }, 0, false); // Don't trigger digest cycle
    }

    protected debounceWithPriority<T extends (...args: any[]) => any>(
        func: T,
        wait: number,
        priority: 'high' | 'normal' | 'low' = 'normal',
        key?: string
    ): (...args: Parameters<T>) => void {
        const delays = { high: wait, normal: wait * 1.5, low: wait * 2 };
        const actualWait = delays[priority];

        return this.debounce(func, actualWait, key);
    }

    protected trackMemoryUsage(): void {
        const usage = {
            watchers: this.watchers.length,
            timeouts: this.timeouts.length,
            intervals: this.intervals.length,
            cacheSize: this.dataCache.size,
            events: this.eventDeregistrations.length
        };

        console.log('[Memory Usage]', usage);

        // Warn if too many resources
        if (usage.watchers > 50 || usage.cacheSize > 100) {
            console.warn('[Memory Warning] High resource usage detected', usage);
        }
    }

    protected watchScope(
        watchExpression: string | Function | ((scope: angular.IScope) => any),
        listener: (newValue: any, oldValue: any, scope: angular.IScope) => void,
        objectEquality: boolean = false,
        optimizeCollections: boolean = false
    ): () => void {
        if (!this.$scopeService) throw new Error("Scope is undefined");

        let optimizedListener = listener;

        if (optimizeCollections && objectEquality) {
            // Use shallow comparison for collections when possible
            optimizedListener = (newVal, oldVal, scope) => {
                if (Array.isArray(newVal) && Array.isArray(oldVal)) {
                    // Quick array comparison
                    if (newVal.length !== oldVal.length ||
                        newVal.some((item, index) => item !== oldVal[index])) {
                        listener(newVal, oldVal, scope);
                    }
                } else {
                    listener(newVal, oldVal, scope);
                }
            };
        }

        const deregister = this.$scopeService.$watch(
            watchExpression as any,
            optimizedListener,
            objectEquality
        );

        this.watchers.push(deregister);
        return deregister;
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

        // Log final memory state
        console.log('BaseController destroyed, resources cleaned up');
    }
}

export default BaseController;