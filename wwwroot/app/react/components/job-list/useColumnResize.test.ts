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
                onColumnWidthsChange: jest.fn(),
                tableRef: {current: null},
            }),
        );

        expect(typeof result.current.handleResizeStart).toBe('function');
    });

    it('sets document.body.style.cursor to col-resize during drag', () => {
        const tableRef = createMockTableRef('jobNo', 130);
        const {result} = renderHook(() =>
            useColumnResize({
                columnWidths: {jobNo: 130},
                onColumnWidthsChange: jest.fn(),
                tableRef,
            }),
        );

        const fakeEvent = {
            clientX: 200,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        } as unknown as React.MouseEvent;

        act(() => {
            result.current.handleResizeStart('jobNo', fakeEvent);
        });

        expect(document.body.style.cursor).toBe('col-resize');
        expect(document.body.style.userSelect).toBe('none');
    });

    it('restores cursor after mouseup', () => {
        const tableRef = createMockTableRef('jobNo', 130);
        const onColumnWidthsChange = jest.fn();
        const {result} = renderHook(() =>
            useColumnResize({
                columnWidths: {jobNo: 130},
                onColumnWidthsChange,
                tableRef,
            }),
        );

        const fakeEvent = {
            clientX: 200,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        } as unknown as React.MouseEvent;

        act(() => {
            result.current.handleResizeStart('jobNo', fakeEvent);
        });

        expect(document.body.style.cursor).toBe('col-resize');

        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup', {clientX: 250}));
        });

        expect(document.body.style.cursor).toBe('');
        expect(document.body.style.userSelect).toBe('');
    });

    it('removes event listeners on unmount', () => {
        const tableRef = createMockTableRef('jobNo', 130);
        const removeSpy = jest.spyOn(document, 'removeEventListener');

        const {unmount} = renderHook(() =>
            useColumnResize({
                columnWidths: {jobNo: 130},
                onColumnWidthsChange: jest.fn(),
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
        const tableRef = createMockTableRef('jobNo', 130);
        const {result} = renderHook(() =>
            useColumnResize({
                columnWidths: {jobNo: 130},
                onColumnWidthsChange: jest.fn(),
                tableRef,
            }),
        );

        const fakeEvent = {
            clientX: 200,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        } as unknown as React.MouseEvent;

        act(() => {
            result.current.handleResizeStart('jobNo', fakeEvent);
        });

        act(() => {
            document.dispatchEvent(new MouseEvent('mousemove', {clientX: 260}));
        });

        const cell = tableRef.current!.querySelector('[data-column-key="jobNo"]') as HTMLElement;
        expect(cell.style.width).toBe('190px'); // 130 + (260 - 200) = 190
    });

    it('calls onColumnWidthsChange with correct width on mouseup', () => {
        const tableRef = createMockTableRef('jobNo', 130);
        const onColumnWidthsChange = jest.fn();
        const {result} = renderHook(() =>
            useColumnResize({
                columnWidths: {jobNo: 130},
                onColumnWidthsChange,
                tableRef,
            }),
        );

        const fakeEvent = {
            clientX: 200,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        } as unknown as React.MouseEvent;

        act(() => {
            result.current.handleResizeStart('jobNo', fakeEvent);
        });

        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup', {clientX: 250}));
        });

        expect(onColumnWidthsChange).toHaveBeenCalledWith(
            expect.objectContaining({jobNo: 180}), // 130 + (250 - 200) = 180
        );
    });

    it('enforces minimum width of 50px', () => {
        const tableRef = createMockTableRef('jobNo', 80);
        const onColumnWidthsChange = jest.fn();
        const {result} = renderHook(() =>
            useColumnResize({
                columnWidths: {jobNo: 80},
                onColumnWidthsChange,
                tableRef,
            }),
        );

        const fakeEvent = {
            clientX: 200,
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        } as unknown as React.MouseEvent;

        act(() => {
            result.current.handleResizeStart('jobNo', fakeEvent);
        });

        act(() => {
            document.dispatchEvent(new MouseEvent('mouseup', {clientX: 50}));
        });

        // 80 + (50 - 200) = -70 → clamped to 50
        expect(onColumnWidthsChange).toHaveBeenCalledWith(
            expect.objectContaining({jobNo: 50}),
        );
    });
});
