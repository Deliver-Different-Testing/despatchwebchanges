/**
 * useColumnResize Hook Tests
 *
 * Tests the drag-to-resize column hook in isolation using renderHook.
 */

import {act, renderHook} from '@testing-library/react';
import {useColumnResize} from './useColumnResize';
import React from "react";

function createMockTableRef(columnKey: string, initialWidth: number) {
    const cell = document.createElement('th');
    cell.setAttribute('data-column-key', columnKey);
    cell.style.width = `${initialWidth}px`;

    const container = document.createElement('div');
    container.appendChild(cell);

    return {current: container} as React.RefObject<HTMLDivElement>;
}

function setupResize(initialWidth = 130) {
    const tableRef = createMockTableRef('jobNo', initialWidth);
    const onColumnWidthsChange = vi.fn();
    const {result} = renderHook(() =>
        useColumnResize({
            columnWidths: {jobNo: initialWidth},
            onColumnWidthsChange,
            tableRef,
        }),
    );

    const startDrag = () => {
        const fakeEvent = {
            clientX: 200,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent;

        act(() => {
            result.current.handleResizeStart('jobNo', fakeEvent);
        });
    };

    return {result, tableRef, onColumnWidthsChange, startDrag};
}

describe('useColumnResize', () => {
    afterEach(() => {
        // Clean up any lingering styles
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });

    it('returns handleResizeStart function', () => {
        const {result} = renderHook(() =>
            useColumnResize({
                columnWidths: {jobNo: 130},
                onColumnWidthsChange: vi.fn(),
                tableRef: {current: null},
            }),
        );

        expect(typeof result.current.handleResizeStart).toBe('function');
    });

    it('sets col-resize cursor during drag and restores it after mouseup', () => {
        const {startDrag} = setupResize();

        startDrag();

        expect(document.body.style.cursor).toBe('col-resize');
        expect(document.body.style.userSelect).toBe('none');

        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup', {clientX: 250}));
        });

        expect(document.body.style.cursor).toBe('');
        expect(document.body.style.userSelect).toBe('');
    });

    it('removes event listeners on unmount', () => {
        const tableRef = createMockTableRef('jobNo', 130);
        const removeSpy = vi.spyOn(document, 'removeEventListener');

        const {unmount} = renderHook(() =>
            useColumnResize({
                columnWidths: {jobNo: 130},
                onColumnWidthsChange: vi.fn(),
                tableRef,
            }),
        );

        unmount();

        const removedTypes = removeSpy.mock.calls.map((call) => call[0]);
        expect(removedTypes).toContain('mousemove');
        expect(removedTypes).toContain('mouseup');

        removeSpy.mockRestore();
    });

    it('updates DOM width during mousemove', () => {
        const {tableRef, startDrag} = setupResize();

        startDrag();

        act(() => {
            document.dispatchEvent(new MouseEvent('mousemove', {clientX: 260}));
        });

        const cell = tableRef.current!.querySelector('[data-column-key="jobNo"]') as HTMLElement;
        expect(cell.style.width).toBe('190px'); // 130 + (260 - 200) = 190
    });

    it.each([
        {name: 'calls onColumnWidthsChange with correct width on mouseup', initialWidth: 130, mouseupX: 250, expected: 180}, // 130 + (250 - 200)
        {name: 'enforces minimum width of 50px', initialWidth: 80, mouseupX: 50, expected: 50}, // 80 + (50 - 200) = -70 -> clamped
    ])('$name', ({initialWidth, mouseupX, expected}) => {
        const {onColumnWidthsChange, startDrag} = setupResize(initialWidth);

        startDrag();

        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup', {clientX: mouseupX}));
        });

        expect(onColumnWidthsChange).toHaveBeenCalledWith(
            expect.objectContaining({jobNo: expected}),
        );
    });
});
