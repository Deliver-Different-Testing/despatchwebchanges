/**
 * Angular Component Wrapper
 *
 * A React component that renders AngularJS components inside React.
 * This allows us to gradually migrate from AngularJS to React while
 * keeping existing AngularJS components functional.
 */

import React, {useEffect, useRef, useCallback} from 'react';
import angular from 'angular';

interface AngularComponentWrapperProps {
    /**
     * The AngularJS directive/component name in kebab-case (e.g., 'job-detail-widget')
     */
    componentName: string;

    /**
     * Props to pass to the AngularJS component as attributes
     */
    bindings?: Record<string, any>;

    /**
     * AngularJS $compile service
     */
    $compile: angular.ICompileService;

    /**
     * AngularJS $rootScope or a child scope
     */
    scope: angular.IScope;

    /**
     * Optional CSS class for the wrapper div
     */
    className?: string;

    /**
     * Optional inline styles
     */
    style?: React.CSSProperties;
}

/**
 * Converts a camelCase string to kebab-case
 */
function toKebabCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * A React component that wraps and renders an AngularJS component
 */
export const AngularComponentWrapper: React.FC<AngularComponentWrapperProps> = ({
    componentName,
    bindings = {},
    $compile,
    scope,
    className,
    style,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const childScopeRef = useRef<angular.IScope | null>(null);
    const compiledElementRef = useRef<JQLite | null>(null);

    // Memoize the compile function to avoid unnecessary re-renders
    const compileComponent = useCallback(() => {
        if (!containerRef.current || !$compile || !scope) return;

        // Clean up previous compilation
        if (compiledElementRef.current) {
            compiledElementRef.current.remove();
            compiledElementRef.current = null;
        }
        if (childScopeRef.current) {
            childScopeRef.current.$destroy();
            childScopeRef.current = null;
        }

        // Create a child scope for this component instance
        const childScope = scope.$new(true);
        childScopeRef.current = childScope;

        // Build the HTML template with bindings
        let bindingAttrs = '';
        const scopeValues: Record<string, any> = {};

        Object.entries(bindings).forEach(([key, value]) => {
            const attrName = toKebabCase(key);
            const scopeKey = `__binding_${key}`;

            if (typeof value === 'function') {
                // For functions, create a wrapper that passes arguments correctly
                scopeValues[scopeKey] = value;
                // Use & binding style for callbacks
                bindingAttrs += ` ${attrName}="${scopeKey}($event, args)"`;
            } else {
                // For other values, bind directly to scope
                scopeValues[scopeKey] = value;
                bindingAttrs += ` ${attrName}="${scopeKey}"`;
            }
        });

        // Apply values to the child scope
        Object.assign(childScope, scopeValues);

        // Create and compile the element
        const template = `<${componentName}${bindingAttrs}></${componentName}>`;
        const element = angular.element(template);

        try {
            const linkFn = $compile(element);
            compiledElementRef.current = linkFn(childScope);

            // Append to container
            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(compiledElementRef.current[0]);

            // Trigger digest if not already in progress
            if (!childScope.$$phase && !scope.$root.$$phase) {
                childScope.$digest();
            }
        } catch (error) {
            console.error(`[AngularComponentWrapper] Error compiling ${componentName}:`, error);
        }
    }, [componentName, $compile, scope]); // Note: bindings intentionally excluded to use effect for updates

    // Initial compilation
    useEffect(() => {
        compileComponent();

        return () => {
            // Cleanup on unmount
            if (compiledElementRef.current) {
                compiledElementRef.current.remove();
                compiledElementRef.current = null;
            }
            if (childScopeRef.current) {
                childScopeRef.current.$destroy();
                childScopeRef.current = null;
            }
        };
    }, [compileComponent]);

    // Update bindings when they change
    useEffect(() => {
        if (!childScopeRef.current) return;

        const childScope = childScopeRef.current;

        Object.entries(bindings).forEach(([key, value]) => {
            const scopeKey = `__binding_${key}`;
            (childScope as any)[scopeKey] = value;
        });

        // Trigger digest to propagate changes
        if (!childScope.$$phase && !scope.$root.$$phase) {
            try {
                childScope.$digest();
            } catch {
                // Ignore digest errors - component might be destroyed
            }
        }
    }, [bindings, scope]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={style}
        />
    );
};

export default AngularComponentWrapper;
