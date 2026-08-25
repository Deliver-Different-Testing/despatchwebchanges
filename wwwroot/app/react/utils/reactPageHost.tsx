/**
 * React page host
 *
 * AngularJS routes mount React pages by container id and unmount them on teardown. Every
 * `*-react.module.tsx` page entry point used to carry its own copy of that: swap roots when
 * the id changes, create a fallback container when the route has not rendered one yet, keep
 * the root across re-mounts into the same element, and log each step under its own prefix.
 */

import React from 'react';
import {createRoot, type Root} from 'react-dom/client';

export interface ReactPageHost<TConfig> {
    mount(containerId: string, config: TConfig): void;
    /** Re-renders into the existing root with a new config; a no-op when nothing is mounted. */
    rerender(config: TConfig): void;
    unmount(): void;
}

export function createPageHost<TConfig>({logName, render, removeContainerOnUnmount = false}: {
    /** Log prefix, e.g. 'CourierMapReact'. */
    logName: string;
    render: (config: TConfig) => React.ReactNode;
    /** Also take the container out of the DOM on unmount, for pages that own their element. */
    removeContainerOnUnmount?: boolean;
}): ReactPageHost<TConfig> {
    let root: Root | null = null;
    let container: HTMLElement | null = null;

    return {
        mount(containerId, config) {
            console.log(`[${logName}] Mounting to container:`, containerId);

            if (root && container && container.id !== containerId) {
                console.log(`[${logName}] Unmounting previous page from:`, container.id);
                root.unmount();
                root = null;
                container = null;
            }

            let next = document.getElementById(containerId);
            if (!next) {
                console.error(`[${logName}] Container not found:`, containerId);
                next = document.createElement('div');
                next.id = containerId;
                document.body.appendChild(next);
                console.log(`[${logName}] Created fallback container`);
            }

            container = next;

            if (!root) {
                console.log(`[${logName}] Creating new React root`);
                root = createRoot(container);
            }

            root.render(render(config));
            console.log(`[${logName}] Page rendered`);
        },
        rerender(config) {
            root?.render(render(config));
        },
        unmount() {
            console.log(`[${logName}] Unmounting page`);
            root?.unmount();
            if (removeContainerOnUnmount) container?.remove();
            root = null;
            container = null;
        },
    };
}
