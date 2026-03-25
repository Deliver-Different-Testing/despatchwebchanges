/**
 * useColumnResize — drag-to-resize columns in JobListTable.
 *
 * During drag, widths are updated via direct DOM manipulation for
 * zero-re-render performance. On mouseup the final width is committed
 * to React state (which triggers localStorage persistence upstream).
 */

import React, {useCallback, useEffect, useRef} from 'react';

const MIN_COLUMN_WIDTH = 50;

interface UseColumnResizeOptions {
    columnWidths: Record<string, number>;
    onColumnWidthsChange: (widths: Record<string, number>) => void;
    tableRef: React.RefObject<HTMLDivElement | null>;
}

interface UseColumnResizeReturn {
    handleResizeStart: (columnKey: string, event: React.MouseEvent) => void;
}

export function useColumnResize({
    columnWidths,
    onColumnWidthsChange,
    tableRef,
}: UseColumnResizeOptions): UseColumnResizeReturn {
    // Mutable refs to avoid stale closures in document-level listeners
    const dragColumnRef = useRef<string | null>(null);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);
    const widthsRef = useRef(columnWidths);
    widthsRef.current = columnWidths;

    const onMouseMove = useCallback((e: MouseEvent) => {
        const col = dragColumnRef.current;
        if (!col || !tableRef.current) return;

        const deltaX = e.clientX - startXRef.current;
        const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidthRef.current + deltaX);

        // Direct DOM update for smooth visual feedback without React re-renders
        const cell = tableRef.current.querySelector(
            `[data-column-key="${col}"]`,
        ) as HTMLElement | null;
        if (cell) {
            cell.style.width = `${newWidth}px`;
        }
    }, [tableRef]);

    const onMouseUp = useCallback((e: MouseEvent) => {
        const col = dragColumnRef.current;
        if (!col) return;

        const deltaX = e.clientX - startXRef.current;
        const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidthRef.current + deltaX);

        // Commit to React state
        onColumnWidthsChange({...widthsRef.current, [col]: newWidth});

        // Clean up
        dragColumnRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }, [onColumnWidthsChange, onMouseMove]);

    const handleResizeStart = useCallback(
        (columnKey: string, event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();

            dragColumnRef.current = columnKey;
            startXRef.current = event.clientX;
            startWidthRef.current = widthsRef.current[columnKey] ?? 100;

            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        },
        [onMouseMove, onMouseUp],
    );

    // Cleanup on unmount — remove any lingering listeners
    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [onMouseMove, onMouseUp]);

    return {handleResizeStart};
}
