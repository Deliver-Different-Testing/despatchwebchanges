import React from 'react';

// react-resizable-panels ships ESM only; mocked here so Jest can render pages
// that use it without transforming the library. Mostly a transparent
// passthrough — page-level tests assert on rendered text/role, not on drag
// behaviour — with two behaviours the real library has that consumers rely on:
// a separator is a real element, and a group reports its layout (keyed by
// panel id) on mount.

type PanelSize = number | string | undefined;

interface PanelProps {
    id?: string | number;
    children?: React.ReactNode;
    defaultSize?: PanelSize;
}

interface GroupProps {
    children?: React.ReactNode;
    onLayoutChanged?: (layout: Record<string, number>) => void;
}

function toPercentNumber(value: PanelSize): number {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

// Consumers wrap each Panel in a keyed Fragment, so look through fragments to
// find this group's own panels. Recursion stops at Panel, which keeps a nested
// Group's children out of the parent group's sizes.
function collectPanelSizes(children: React.ReactNode, sizes: Record<string, number> = {}): Record<string, number> {
    React.Children.forEach(children, child => {
        if (!React.isValidElement(child)) return;
        if (child.type === Panel) {
            const props = child.props as PanelProps;
            if (props.id != null) sizes[String(props.id)] = toPercentNumber(props.defaultSize);
        } else if (child.type === React.Fragment) {
            collectPanelSizes((child.props as {children?: React.ReactNode}).children, sizes);
        }
    });
    return sizes;
}

export function Group({children, onLayoutChanged}: GroupProps) {
    const sizesKey = JSON.stringify(collectPanelSizes(children));
    React.useEffect(() => {
        onLayoutChanged?.(JSON.parse(sizesKey) as Record<string, number>);
        // Mirrors the library: emits once on mount, then again whenever the
        // panel sizing actually changes — not on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sizesKey]);

    return <>{children}</>;
}

export function Panel({children}: PanelProps) {
    return <>{children}</>;
}

export function Separator({children}: {children?: React.ReactNode}) {
    return <div data-panel-resize-handle="">{children}</div>;
}

export function useDefaultLayout(): {defaultLayout: undefined; onLayoutChanged: () => void} {
    return {defaultLayout: undefined, onLayoutChanged: () => {}};
}
