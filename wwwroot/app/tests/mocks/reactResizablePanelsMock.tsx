import React from 'react';

// react-resizable-panels ships ESM only; mocked here so Jest can render pages
// that use it without transforming the library. Mostly a transparent
// passthrough — page-level tests assert on rendered text/role, not on drag
// behaviour — with two behaviours the real library has that consumers rely on:
// a resize handle is a real element, and a group reports its layout on mount.

interface PanelProps {
    children?: React.ReactNode;
    defaultSize?: number;
}

interface PanelGroupProps {
    children?: React.ReactNode;
    onLayout?: (sizes: number[]) => void;
}

// Consumers wrap each Panel in a keyed Fragment, so look through fragments to
// find this group's own panels. Recursion stops at Panel, which keeps a nested
// PanelGroup's children out of the parent group's sizes.
function collectPanelSizes(children: React.ReactNode, sizes: number[] = []): number[] {
    React.Children.forEach(children, child => {
        if (!React.isValidElement(child)) return;
        if (child.type === Panel) {
            sizes.push((child.props as PanelProps).defaultSize ?? 0);
        } else if (child.type === React.Fragment) {
            collectPanelSizes((child.props as {children?: React.ReactNode}).children, sizes);
        }
    });
    return sizes;
}

export function PanelGroup({children, onLayout}: PanelGroupProps) {
    const sizesKey = JSON.stringify(collectPanelSizes(children));
    React.useEffect(() => {
        onLayout?.(JSON.parse(sizesKey) as number[]);
        // Mirrors the library: emits once on mount, then again whenever the
        // panel sizing actually changes — not on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sizesKey]);

    return <>{children}</>;
}

export function Panel({children}: PanelProps) {
    return <>{children}</>;
}

export function PanelResizeHandle({children}: {children?: React.ReactNode}) {
    return <div data-panel-resize-handle="">{children}</div>;
}
