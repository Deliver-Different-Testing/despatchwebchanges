/** @jest-environment jest-environment-jsdom */
/**
 * useMultiSelect Hook Tests
 *
 * Covers: plain click toggle, Ctrl/Cmd add/remove, Shift range-select,
 * toggleAll, clear, isAllSelected, isIndeterminate, selectCount.
 */

import {renderHook, act} from '@testing-library/react';
import {useMultiSelect} from './useMultiSelect';

function makeEvent(overrides: Partial<React.MouseEvent> = {}): React.MouseEvent {
    return {
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        ...overrides,
    } as React.MouseEvent;
}

describe('useMultiSelect', () => {
    const orderedIds = [10, 20, 30, 40, 50];

    it('starts empty, plain click selects/replaces/deselects', () => {
        const {result} = renderHook(() => useMultiSelect(orderedIds));

        // Starts empty
        expect(result.current.selectedIds.size).toBe(0);
        expect(result.current.selectCount).toBe(0);
        expect(result.current.isAllSelected(orderedIds)).toBe(false);
        expect(result.current.isIndeterminate(orderedIds)).toBe(false);

        // Plain click selects single
        act(() => result.current.toggle(20, makeEvent()));
        expect(result.current.selectedIds.has(20)).toBe(true);
        expect(result.current.selectCount).toBe(1);

        // Plain click different item replaces
        act(() => result.current.toggle(30, makeEvent()));
        expect(result.current.selectedIds.has(20)).toBe(false);
        expect(result.current.selectedIds.has(30)).toBe(true);
        expect(result.current.selectCount).toBe(1);

        // Plain click same item deselects
        act(() => result.current.toggle(30, makeEvent()));
        expect(result.current.selectCount).toBe(0);
    });

    it('plain click replaces multi-selection with single', () => {
        const {result} = renderHook(() => useMultiSelect(orderedIds));

        act(() => result.current.toggle(10, makeEvent({ctrlKey: true})));
        act(() => result.current.toggle(20, makeEvent({ctrlKey: true})));
        act(() => result.current.toggle(30, makeEvent({ctrlKey: true})));
        expect(result.current.selectCount).toBe(3);

        act(() => result.current.toggle(40, makeEvent()));
        expect(result.current.selectCount).toBe(1);
        expect(result.current.selectedIds.has(40)).toBe(true);
    });

    it('Ctrl/Cmd click adds, removes, and works with metaKey', () => {
        const {result} = renderHook(() => useMultiSelect(orderedIds));

        // Ctrl adds
        act(() => result.current.toggle(10, makeEvent({ctrlKey: true})));
        act(() => result.current.toggle(30, makeEvent({ctrlKey: true})));
        expect(result.current.selectCount).toBe(2);
        expect(result.current.selectedIds.has(10)).toBe(true);
        expect(result.current.selectedIds.has(30)).toBe(true);

        // Ctrl removes already-selected
        act(() => result.current.toggle(10, makeEvent({ctrlKey: true})));
        expect(result.current.selectCount).toBe(1);
        expect(result.current.selectedIds.has(10)).toBe(false);
        expect(result.current.selectedIds.has(30)).toBe(true);

        // metaKey (Cmd on Mac) also works
        act(() => result.current.toggle(50, makeEvent({metaKey: true})));
        expect(result.current.selectCount).toBe(2);
        expect(result.current.selectedIds.has(50)).toBe(true);
    });

    it('Shift click range-selects forward, backward, and adds to existing selection', () => {
        const {result} = renderHook(() => useMultiSelect(orderedIds));

        // Forward range: anchor at 10, shift-click 40
        act(() => result.current.toggle(10, makeEvent({ctrlKey: true})));
        act(() => result.current.toggle(40, makeEvent({shiftKey: true})));
        expect(result.current.selectCount).toBe(4);
        expect(result.current.selectedIds.has(10)).toBe(true);
        expect(result.current.selectedIds.has(20)).toBe(true);
        expect(result.current.selectedIds.has(30)).toBe(true);
        expect(result.current.selectedIds.has(40)).toBe(true);
        expect(result.current.selectedIds.has(50)).toBe(false);

        // Clear and test backward range
        act(() => result.current.clear());
        act(() => result.current.toggle(40, makeEvent({ctrlKey: true})));
        act(() => result.current.toggle(10, makeEvent({shiftKey: true})));
        expect(result.current.selectCount).toBe(4);

        // Additive: Ctrl-select 10, Ctrl-select 50, Shift-click 30 adds range 30-50
        act(() => result.current.clear());
        act(() => result.current.toggle(10, makeEvent({ctrlKey: true})));
        act(() => result.current.toggle(50, makeEvent({ctrlKey: true})));
        act(() => result.current.toggle(30, makeEvent({shiftKey: true})));
        expect(result.current.selectedIds.has(10)).toBe(true);
        expect(result.current.selectedIds.has(30)).toBe(true);
        expect(result.current.selectedIds.has(40)).toBe(true);
        expect(result.current.selectedIds.has(50)).toBe(true);
    });

    it('Shift without prior click falls through to plain behavior', () => {
        const {result} = renderHook(() => useMultiSelect(orderedIds));

        act(() => result.current.toggle(30, makeEvent({shiftKey: true})));
        expect(result.current.selectCount).toBe(1);
        expect(result.current.selectedIds.has(30)).toBe(true);
    });

    it('toggleAll selects all, deselects all, and selects all from indeterminate', () => {
        const {result} = renderHook(() => useMultiSelect(orderedIds));

        // Select all from empty
        act(() => result.current.toggleAll(orderedIds));
        expect(result.current.selectCount).toBe(5);
        expect(result.current.isAllSelected(orderedIds)).toBe(true);

        // Deselect all
        act(() => result.current.toggleAll(orderedIds));
        expect(result.current.selectCount).toBe(0);

        // Select all from indeterminate (some selected)
        act(() => result.current.toggle(10, makeEvent({ctrlKey: true})));
        act(() => result.current.toggle(20, makeEvent({ctrlKey: true})));
        act(() => result.current.toggleAll(orderedIds));
        expect(result.current.selectCount).toBe(5);
        expect(result.current.isAllSelected(orderedIds)).toBe(true);
    });

    it('clear empties selection and resets Shift anchor', () => {
        const {result} = renderHook(() => useMultiSelect(orderedIds));

        act(() => result.current.toggle(10, makeEvent({ctrlKey: true})));
        act(() => result.current.toggle(20, makeEvent({ctrlKey: true})));
        act(() => result.current.clear());
        expect(result.current.selectCount).toBe(0);

        // Shift-click after clear has no anchor — behaves like plain click
        act(() => result.current.toggle(40, makeEvent({shiftKey: true})));
        expect(result.current.selectCount).toBe(1);
        expect(result.current.selectedIds.has(40)).toBe(true);
    });

    it('isAllSelected/isIndeterminate report correct states', () => {
        const {result} = renderHook(() => useMultiSelect(orderedIds));

        // Empty list
        expect(result.current.isAllSelected([])).toBe(false);

        // None selected
        expect(result.current.isIndeterminate(orderedIds)).toBe(false);
        expect(result.current.isAllSelected(orderedIds)).toBe(false);

        // Some selected → indeterminate
        act(() => result.current.toggle(10, makeEvent({ctrlKey: true})));
        expect(result.current.isIndeterminate(orderedIds)).toBe(true);
        expect(result.current.isAllSelected(orderedIds)).toBe(false);

        // All selected → not indeterminate
        act(() => result.current.toggleAll(orderedIds));
        expect(result.current.isIndeterminate(orderedIds)).toBe(false);
        expect(result.current.isAllSelected(orderedIds)).toBe(true);
    });

    it('uses updated orderedIds for Shift range selection after rerender', () => {
        const {result, rerender} = renderHook(
            ({ids}) => useMultiSelect(ids),
            {initialProps: {ids: [10, 20, 30, 40, 50]}},
        );

        act(() => result.current.toggle(10, makeEvent({ctrlKey: true})));

        // Reorder (simulate filter change)
        rerender({ids: [50, 40, 30, 20, 10]});

        // Shift-click 30 — range in new order from idx 2 (30) to idx 4 (10)
        act(() => result.current.toggle(30, makeEvent({shiftKey: true})));
        expect(result.current.selectedIds.has(10)).toBe(true);
        expect(result.current.selectedIds.has(20)).toBe(true);
        expect(result.current.selectedIds.has(30)).toBe(true);
    });
});
