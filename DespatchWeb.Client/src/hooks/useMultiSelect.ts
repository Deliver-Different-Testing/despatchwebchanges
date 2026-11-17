/**
 * Multi-Select Hook
 *
 * Manages a Set<number> of selected job IDs for bulk operations.
 * Supports plain click toggle, Ctrl/Cmd add/remove, and Shift range-select.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';

export interface UseMultiSelectReturn {
    selectedIds: Set<number>;
    toggle: (jobId: number, event: React.MouseEvent) => void;
    toggleAll: (allIds: number[]) => void;
    clear: () => void;
    isAllSelected: (allIds: number[]) => boolean;
    isIndeterminate: (allIds: number[]) => boolean;
    selectCount: number;
}

export function useMultiSelect(orderedIds: number[]): UseMultiSelectReturn {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const lastClickedIdRef = useRef<number | null>(null);

    // Bulk actions act on selectedIds, so a job that leaves the list (a poll refresh, a filter)
    // must leave the selection too, or it is acted on while no longer shown.
    useEffect(() => {
        const visible = new Set(orderedIds);
        setSelectedIds(prev => {
            if ([...prev].every(id => visible.has(id))) return prev;
            return new Set([...prev].filter(id => visible.has(id)));
        });
        if (lastClickedIdRef.current !== null && !visible.has(lastClickedIdRef.current)) {
            lastClickedIdRef.current = null;
        }
    }, [orderedIds]);

    const toggle = useCallback((jobId: number, event: React.MouseEvent) => {
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        const isShift = event.shiftKey;

        setSelectedIds(prev => {
            const next = new Set(prev);

            if (isShift && lastClickedIdRef.current !== null) {
                // Range select from lastClickedId to jobId
                const lastIdx = orderedIds.indexOf(lastClickedIdRef.current);
                const currIdx = orderedIds.indexOf(jobId);
                if (lastIdx !== -1 && currIdx !== -1) {
                    const start = Math.min(lastIdx, currIdx);
                    const end = Math.max(lastIdx, currIdx);
                    for (let i = start; i <= end; i++) {
                        next.add(orderedIds[i]);
                    }
                }
            } else if (isCtrlOrCmd) {
                // Toggle single item
                if (next.has(jobId)) {
                    next.delete(jobId);
                } else {
                    next.add(jobId);
                }
            } else {
                // Plain click — toggle single, clear others
                if (next.has(jobId) && next.size === 1) {
                    next.clear();
                } else {
                    next.clear();
                    next.add(jobId);
                }
            }

            lastClickedIdRef.current = jobId;
            return next;
        });
    }, [orderedIds]);

    const toggleAll = useCallback((allIds: number[]) => {
        setSelectedIds(prev => {
            if (prev.size === allIds.length && allIds.every(id => prev.has(id))) {
                return new Set();
            }
            return new Set(allIds);
        });
    }, []);

    const clear = useCallback(() => {
        setSelectedIds(new Set());
        lastClickedIdRef.current = null;
    }, []);

    const isAllSelected = useCallback((allIds: number[]) => {
        return allIds.length > 0 && allIds.every(id => selectedIds.has(id));
    }, [selectedIds]);

    const isIndeterminate = useCallback((allIds: number[]) => {
        return selectedIds.size > 0 && !allIds.every(id => selectedIds.has(id));
    }, [selectedIds]);

    return {
        selectedIds,
        toggle,
        toggleAll,
        clear,
        isAllSelected,
        isIndeterminate,
        selectCount: selectedIds.size,
    };
}
