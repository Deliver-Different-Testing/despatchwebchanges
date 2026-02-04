/**
 * React 18 compatible wrapper for AngularJS
 *
 * react2angular uses the deprecated ReactDOM.render API.
 * This wrapper uses React 18's createRoot API instead.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import angular from 'angular';

/**
 * Wraps a React component for use as an AngularJS component
 *
 * @param Component - The React component to wrap
 * @param bindingNames - Optional array of prop names to bind from AngularJS
 * @returns AngularJS component definition
 */
export function react2angular<P extends object>(
    Component: React.ComponentType<P>,
    bindingNames: (keyof P)[] = []
): angular.IComponentOptions {
    // Build bindings object from binding names
    const bindings: Record<string, string> = {};
    bindingNames.forEach(name => {
        bindings[name as string] = '<';
    });

    return {
        bindings,
        controller: ['$element', class React18Controller {
            private root: Root | null = null;
            private props: Partial<P> = {};

            constructor(private $element: JQLite) {
            }

            $onInit() {
                // Create React root on the element
                this.root = createRoot(this.$element[0]);
                this.render();
            }

            $onChanges(changes: angular.IOnChangesObject) {
                // Update props from AngularJS bindings
                Object.keys(changes).forEach(key => {
                    (this.props as any)[key] = changes[key].currentValue;
                });
                this.render();
            }

            $onDestroy() {
                // Clean up React root
                if (this.root) {
                    this.root.unmount();
                    this.root = null;
                }
            }

            private render() {
                if (this.root) {
                    this.root.render(React.createElement(Component, this.props as P));
                }
            }
        }]
    };
}

export default react2angular;
