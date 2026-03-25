/** @jest-environment jest-environment-jsdom */

import React from 'react';
import {render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {DashboardGrid} from './DashboardGrid';
import {BOX_CONFIGS, DispatchBox} from '../DispatchPage.interfaces';
import type {LayoutItem} from 'react-grid-layout';

// ── react-grid-layout mock ─────────────────────────────────────────────
// Renders children directly so we can inspect the DOM structure that
// GridWidget produces, including how `children` (resize handles injected
// by react-resizable) are positioned relative to WidgetPanel.

let capturedDragConfig: any;
let capturedResizeConfig: any;

jest.mock('react-grid-layout', () => {
    const React = require('react');
    return {
        Responsive: React.forwardRef(function MockResponsive(props: any, _ref: any) {
            capturedDragConfig = props.dragConfig;
            capturedResizeConfig = props.resizeConfig;

            // Clone each child with className/style like real RGL does via
            // React.cloneElement, then wrap with a fake Resizable that
            // appends a resize-handle span to the child's children.
            return (
                <div data-testid="rgl-responsive" className="react-grid-layout" style={props.style}>
                    {React.Children.map(props.children, (child: any) => {
                        if (!React.isValidElement(child)) return child;
                        // Simulate react-grid-layout's cloneElement behaviour:
                        // it sets className, style and — critically — react-resizable
                        // appends resize-handle spans to the child's children.
                        return React.cloneElement(child as any, {
                            className: `react-grid-item ${(child as any).props.className ?? ''}`,
                            style: {position: 'absolute', width: 200, height: 200},
                            children: [
                                // Preserve existing children (undefined for our GridWidget
                                // since widget content is on the `content` prop, not children)
                                ...(React.Children.toArray((child as any).props.children) || []),
                                // Simulate resize handle injected by react-resizable
                                <span
                                    key="resizableHandle-se"
                                    className="react-resizable-handle react-resizable-handle-se"
                                    data-testid="resize-handle"
                                />,
                            ],
                        });
                    })}
                </div>
            );
        }),
        useContainerWidth: () => ({width: 1200, containerRef: {current: null}}),
        verticalCompactor: {type: 'vertical', allowOverlap: false, compact: (l: any) => l},
    };
});

jest.mock('react-grid-layout/css/styles.css', () => ({}));

const theme = createTheme();

const allBoxIds = Object.values(DispatchBox);
const defaultLayout: LayoutItem[] = allBoxIds.map((id, i) => ({
    i: id, x: (i % 3) * 4, y: Math.floor(i / 3) * 6, w: 4, h: 6, minW: 2, minH: 3,
}));

const defaultWidgets: Partial<Record<DispatchBox, React.ReactNode>> = Object.fromEntries(
    Object.values(DispatchBox).map(boxId => [
        boxId,
        <div key={boxId} data-testid={`widget-content-${boxId}`}>Content for {boxId}</div>,
    ]),
);

function renderGrid(overrides: Partial<React.ComponentProps<typeof DashboardGrid>> = {}) {
    const defaultProps: React.ComponentProps<typeof DashboardGrid> = {
        layout: defaultLayout,
        onLayoutChange: jest.fn(),
        cols: 12,
        rowHeight: 80,
        isDefaultLayout: false,
        visibleBoxIds: allBoxIds,
        widgets: defaultWidgets,
        ...overrides,
    };

    return render(
        <ThemeProvider theme={theme}>
            <DashboardGrid {...defaultProps} />
        </ThemeProvider>,
    );
}

describe('DashboardGrid', () => {
    beforeEach(() => {
        capturedDragConfig = undefined;
        capturedResizeConfig = undefined;
    });

    it('renders all visible widgets with their content', () => {
        renderGrid();
        for (const boxId of allBoxIds) {
            expect(screen.getByTestId(`widget-content-${boxId}`)).toBeInTheDocument();
        }
    });

    it('renders only visible widgets when visibleBoxIds is a subset', () => {
        renderGrid({visibleBoxIds: [DispatchBox.JobsList, DispatchBox.Map]});
        expect(screen.getByTestId('widget-content-list')).toBeInTheDocument();
        expect(screen.getByTestId('widget-content-map')).toBeInTheDocument();
        expect(screen.queryByTestId('widget-content-detail')).not.toBeInTheDocument();
        expect(screen.queryByTestId('widget-content-currentWork')).not.toBeInTheDocument();
    });

    it('renders widget panel titles from BOX_CONFIGS', () => {
        renderGrid({visibleBoxIds: [DispatchBox.JobsList]});
        expect(screen.getByText('Job List')).toBeInTheDocument();
    });

    // ── Drag configuration ──────────────────────────────────────────────

    it('enables drag when not default layout', () => {
        renderGrid({isDefaultLayout: false});
        expect(capturedDragConfig).toEqual({enabled: true, handle: '.drag-handle'});
    });

    it('disables drag when default layout', () => {
        renderGrid({isDefaultLayout: true});
        expect(capturedDragConfig).toEqual({enabled: false, handle: '.drag-handle'});
    });

    it('shows drag handle on widgets when not default layout', () => {
        renderGrid({isDefaultLayout: false, visibleBoxIds: [DispatchBox.JobsList]});
        expect(document.querySelector('.drag-handle')).toBeInTheDocument();
    });

    it('hides drag handle on widgets when default layout', () => {
        renderGrid({isDefaultLayout: true, visibleBoxIds: [DispatchBox.JobsList]});
        expect(document.querySelector('.drag-handle')).not.toBeInTheDocument();
    });

    // ── Resize configuration ────────────────────────────────────────────

    it('enables resize when not default layout', () => {
        renderGrid({isDefaultLayout: false});
        expect(capturedResizeConfig).toEqual({enabled: true});
    });

    it('disables resize when default layout', () => {
        renderGrid({isDefaultLayout: true});
        expect(capturedResizeConfig).toEqual({enabled: false});
    });

    // ── Resize handle placement (regression test) ───────────────────────
    // react-resizable injects resize-handle spans by appending them to
    // the grid item's `children` prop via React.cloneElement.  When the
    // grid item is a custom component (GridWidget), the handles must be
    // rendered as direct children of the outer div — NOT inside
    // WidgetPanel — so the CSS selector `.react-grid-item >
    // .react-resizable-handle` matches and the handle is visible.
    //
    // The bug: an earlier refactoring rendered {children} inside
    // WidgetPanel, burying the resize handle deep in the DOM where the
    // CSS couldn't reach it.

    it('renders resize handles as direct children of the grid-item div, not inside WidgetPanel', () => {
        renderGrid({isDefaultLayout: false, visibleBoxIds: [DispatchBox.JobsList]});

        const gridItem = document.querySelector('.react-grid-item');
        expect(gridItem).toBeInTheDocument();

        // The resize handle should be a DIRECT child of the grid-item div.
        // The CSS `.react-grid-item > .react-resizable-handle` requires this.
        const directHandle = gridItem!.querySelector(':scope > .react-resizable-handle');
        expect(directHandle).toBeInTheDocument();
    });

    it('does NOT render resize handles inside WidgetPanel content area', () => {
        renderGrid({isDefaultLayout: false, visibleBoxIds: [DispatchBox.JobsList]});

        // WidgetPanel's content area is the last child Box with overflow: auto.
        // If the resize handle ended up inside it, the CSS selector wouldn't
        // match and the handle would be hidden — this was the original bug.
        const gridItem = document.querySelector('.react-grid-item');
        const widgetPanel = gridItem!.firstElementChild; // The WidgetPanel root div

        const handleInsidePanel = widgetPanel!.querySelector('.react-resizable-handle');
        expect(handleInsidePanel).toBeNull();
    });

    it('renders widget content inside WidgetPanel (not at grid-item root)', () => {
        renderGrid({isDefaultLayout: false, visibleBoxIds: [DispatchBox.JobsList]});

        const gridItem = document.querySelector('.react-grid-item');
        const widgetContent = screen.getByTestId('widget-content-list');

        // Widget content should NOT be a direct child of the grid-item div
        expect(gridItem!.querySelector(':scope > [data-testid="widget-content-list"]')).toBeNull();

        // But it should exist somewhere inside the grid-item (inside WidgetPanel)
        expect(gridItem!.contains(widgetContent)).toBe(true);
    });

    // ── Drag-and-drop prerequisites (regression: offsetParent guard) ───
    // react-grid-layout's GridItem.onDragStart silently aborts if
    // `node.offsetParent` is null (line 144-145 in chunk-XM2M6TC6.mjs).
    // The grid container must be a positioned element so grid items'
    // offsetParent is never null.  Resize has no such guard, so resize
    // can work while drag is broken — which is exactly the bug we hit.

    it('grid container has position:relative so offsetParent is never null for grid items', () => {
        renderGrid({isDefaultLayout: false, visibleBoxIds: [DispatchBox.JobsList]});

        const gridContainer = screen.getByTestId('rgl-responsive');
        expect(gridContainer.style.position).toBe('relative');

        // Grid items are positioned absolutely inside the container.
        // Verify the parent-child relationship that offsetParent depends on.
        const gridItem = gridContainer.querySelector('.react-grid-item');
        expect(gridItem).toBeInTheDocument();
        expect(gridItem!.parentElement).toBe(gridContainer);
    });

    it('drag handle is inside grid item and not matched by the resize cancel selector', () => {
        renderGrid({isDefaultLayout: false, visibleBoxIds: [DispatchBox.JobsList]});

        const gridItem = document.querySelector('.react-grid-item');
        const dragHandle = gridItem!.querySelector('.drag-handle');
        expect(dragHandle).toBeInTheDocument();

        // The drag handle must NOT match the resize-handle class, otherwise
        // react-draggable's cancel selector would prevent drag initiation
        expect(dragHandle!.classList.contains('react-resizable-handle')).toBe(false);
    });

    it('drag and resize configs are both wired to the Responsive component', () => {
        renderGrid({isDefaultLayout: false});

        expect(capturedDragConfig).toBeDefined();
        expect(capturedDragConfig.enabled).toBe(true);
        expect(capturedDragConfig.handle).toBe('.drag-handle');
        expect(capturedResizeConfig).toBeDefined();
        expect(capturedResizeConfig.enabled).toBe(true);
    });

    // ── Toolbar extras ──────────────────────────────────────────────────

    it('renders toolbar actions for each widget', () => {
        const toolbarActions: Partial<Record<DispatchBox, React.ReactNode>> = {
            [DispatchBox.JobsList]: <span data-testid={`toolbar-action-list`}>action</span>,
        };
        renderGrid({visibleBoxIds: [DispatchBox.JobsList], toolbarActions});
        expect(screen.getByTestId('toolbar-action-list')).toBeInTheDocument();
    });

    it('renders subtitles via subtitles map', () => {
        const subtitles: Partial<Record<DispatchBox, string | undefined>> = {
            [DispatchBox.JobsList]: ' - 42 jobs',
        };
        renderGrid({visibleBoxIds: [DispatchBox.JobsList], subtitles});
        expect(screen.getByText('- 42 jobs')).toBeInTheDocument();
    });
});
