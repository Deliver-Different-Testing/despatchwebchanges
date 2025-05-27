import {bindAllMethods} from "../functions/bindAllMethods";

interface CacheOptions {
    ttl?: number; // Time to live in milliseconds
    maxSize?: number; // Maximum cache size
}

interface DebouncedFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): void;
    cancel(): void;
    flush(): ReturnType<T> | undefined;
}

class BaseController implements angular.IController {
    protected eventDeregistrations: Array<() => void> = [];
    protected timeouts: Array<angular.IPromise<any>> = [];
    protected intervals: Array<angular.IPromise<any>> = [];

    protected $timeoutService?: angular.ITimeoutService;
    protected $intervalService?: angular.IIntervalService;

    // Performance optimization properties
    private domElementCache = new Map<string, JQuery>();
    private memoCache = new Map<string, { value: any; timestamp: number; ttl: number }>();
    private debouncers = new Map<string, angular.IPromise<any>>();
    private lookupMaps = new Map<string, Map<any, any>>();
    private computedCache = new Map<string, { value: any; dependencies: string; timestamp: number }>();

    constructor() {
        bindAllMethods(this);
    }

    protected initServices($timeout: angular.ITimeoutService, $interval: angular.IIntervalService): void {
        this.$timeoutService = $timeout;
        this.$intervalService = $interval;
    }

    // EXISTING METHODS (unchanged)
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

    // NEW PERFORMANCE OPTIMIZATION METHODS

    /**
     * Cached DOM element access with automatic cleanup
     */
    protected getCachedElement(selector: string): JQuery {
        if (!this.domElementCache.has(selector)) {
            this.domElementCache.set(selector, angular.element(selector));
        }
        return this.domElementCache.get(selector)!;
    }

    /**
     * Clear specific DOM cache entries or all if no selector provided
     */
    protected clearDOMCache(selector?: string): void {
        if (selector) {
            this.domElementCache.delete(selector);
        } else {
            this.domElementCache.clear();
        }
    }

    /**
     * Memoization with TTL support for expensive computations
     */
    protected memoize<T extends (...args: any[]) => any>(
        fn: T,
        keyGenerator: (...args: Parameters<T>) => string,
        options: CacheOptions = {}
    ): T {
        const { ttl = 300000, maxSize = 100 } = options; // Default 5min TTL, 100 items max

        return ((...args: Parameters<T>) => {
            const key = keyGenerator(...args);
            const now = Date.now();
            const cached = this.memoCache.get(key);

            // Check if cached value is still valid
            if (cached && (now - cached.timestamp) < cached.ttl) {
                return cached.value;
            }

            // Compute new value
            const result = fn(...args);

            // Manage cache size
            if (this.memoCache.size >= maxSize) {
                // Remove oldest entries (simple LRU)
                const entries = Array.from(this.memoCache.entries());
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                const toRemove = Math.ceil(maxSize * 0.2); // Remove 20% of oldest
                for (let i = 0; i < toRemove; i++) {
                    this.memoCache.delete(entries[i][0]);
                }
            }

            // Cache the result
            this.memoCache.set(key, {
                value: result,
                timestamp: now,
                ttl: ttl
            });

            return result;
        }) as T;
    }

    /**
     * Debounced function execution with cancellation support
     */
    protected debounce<T extends (...args: any[]) => any>(
        fn: T,
        delay: number,
        key?: string
    ): DebouncedFunction<T> {
        const debouncerKey = key || fn.name || 'default';

        const debouncedFn = ((...args: Parameters<T>) => {
            // Cancel existing timeout
            if (this.debouncers.has(debouncerKey)) {
                this.$timeoutService?.cancel(this.debouncers.get(debouncerKey)!);
            }

            // Set new timeout
            const timeoutPromise = this.registerTimeout(() => {
                this.debouncers.delete(debouncerKey);
                return fn(...args);
            }, delay);

            this.debouncers.set(debouncerKey, timeoutPromise);
        }) as DebouncedFunction<T>;

        // Add cancel method
        debouncedFn.cancel = () => {
            if (this.debouncers.has(debouncerKey)) {
                this.$timeoutService?.cancel(this.debouncers.get(debouncerKey)!);
                this.debouncers.delete(debouncerKey);
            }
        };

        // Add flush method
        debouncedFn.flush = () => {
            if (this.debouncers.has(debouncerKey)) {
                this.$timeoutService?.cancel(this.debouncers.get(debouncerKey)!);
                this.debouncers.delete(debouncerKey);
                // Note: Can't easily return the actual result in this context
                return undefined;
            }
        };

        return debouncedFn;
    }

    /**
     * Create and manage lookup maps for O(1) access
     */
    protected createLookupMap<T, K extends keyof T>(
        items: T[],
        keyProperty: K,
        mapName: string
    ): Map<T[K], T> {
        const lookupMap = new Map<T[K], T>();

        items.forEach(item => {
            lookupMap.set(item[keyProperty], item);
        });

        this.lookupMaps.set(mapName, lookupMap);
        return lookupMap;
    }

    /**
     * Get existing lookup map
     */
    protected getLookupMap<K, V>(mapName: string): Map<K, V> | undefined {
        return this.lookupMaps.get(mapName) as Map<K, V>;
    }

    /**
     * Update lookup map with new items
     */
    protected updateLookupMap<T, K extends keyof T>(
        items: T[],
        keyProperty: K,
        mapName: string
    ): Map<T[K], T> {
        const existingMap = this.lookupMaps.get(mapName) as Map<T[K], T>;

        if (existingMap) {
            existingMap.clear();
            items.forEach(item => {
                existingMap.set(item[keyProperty], item);
            });
            return existingMap;
        }

        return this.createLookupMap(items, keyProperty, mapName);
    }

    /**
     * Computed property with dependency tracking
     */
    protected computed<T>(
        computeFn: () => T,
        dependencyFn: () => string,
        cacheKey: string
    ): T {
        const currentDependencies = dependencyFn();
        const cached = this.computedCache.get(cacheKey);

        // Check if dependencies have changed
        if (cached && cached.dependencies === currentDependencies) {
            return cached.value;
        }

        // Recompute
        const result = computeFn();

        this.computedCache.set(cacheKey, {
            value: result,
            dependencies: currentDependencies,
            timestamp: Date.now()
        });

        return result;
    }

    /**
     * Batch DOM operations to minimize reflows
     */
    protected batchDOMOperations(operations: (() => void)[]): void {
        this.registerTimeout(() => {
            operations.forEach(operation => operation());
        }, 0, false);
    }

    /**
     * Efficient shallow object comparison
     */
    protected shallowEqual(obj1: any, obj2: any): boolean {
        if (obj1 === obj2) return true;
        if (!obj1 || !obj2) return false;
        if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);

        if (keys1.length !== keys2.length) return false;

        return keys1.every(key => obj1[key] === obj2[key]);
    }

    /**
     * Optimized watch with shallow comparison
     */
    protected registerShallowWatch(
        scope: angular.IScope,
        watchExpression: string | Function | ((scope: angular.IScope) => any),
        listener: (newValue: any, oldValue: any, scope: angular.IScope) => void
    ): () => void {
        let lastValue: any;

        return this.registerWatch(scope, watchExpression, (newValue, oldValue, scope) => {
            if (!this.shallowEqual(newValue, lastValue)) {
                lastValue = angular.copy(newValue);
                listener(newValue, oldValue, scope);
            }
        });
    }

    /**
     * Throttled function execution
     */
    protected throttle<T extends (...args: any[]) => any>(
        fn: T,
        delay: number,
        key?: string
    ): (...args: Parameters<T>) => void {
        const throttleKey = key || fn.name || 'default-throttle';
        let lastExecution = 0;

        return (...args: Parameters<T>) => {
            const now = Date.now();

            if (now - lastExecution >= delay) {
                lastExecution = now;
                fn(...args);
            }
        };
    }

    /**
     * Clear specific caches
     */
    protected clearCache(type?: 'memo' | 'computed' | 'lookup' | 'dom'): void {
        switch (type) {
            case 'memo':
                this.memoCache.clear();
                break;
            case 'computed':
                this.computedCache.clear();
                break;
            case 'lookup':
                this.lookupMaps.clear();
                break;
            case 'dom':
                this.clearDOMCache();
                break;
            default:
                // Clear all caches
                this.memoCache.clear();
                this.computedCache.clear();
                this.lookupMaps.clear();
                this.clearDOMCache();
        }
    }

    /**
     * Get cache statistics for debugging
     */
    protected getCacheStats(): {
        memo: { size: number; entries: string[] };
        computed: { size: number; entries: string[] };
        lookup: { size: number; entries: string[] };
        dom: { size: number; entries: string[] };
    } {
        return {
            memo: {
                size: this.memoCache.size,
                entries: Array.from(this.memoCache.keys())
            },
            computed: {
                size: this.computedCache.size,
                entries: Array.from(this.computedCache.keys())
            },
            lookup: {
                size: this.lookupMaps.size,
                entries: Array.from(this.lookupMaps.keys())
            },
            dom: {
                size: this.domElementCache.size,
                entries: Array.from(this.domElementCache.keys())
            }
        };
    }

    $onDestroy(): void {
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

        // Cancel all debouncers
        this.debouncers.forEach(promise => {
            this.$timeoutService?.cancel(promise);
        });
        this.debouncers.clear();

        // Clear all caches
        this.clearCache();

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
