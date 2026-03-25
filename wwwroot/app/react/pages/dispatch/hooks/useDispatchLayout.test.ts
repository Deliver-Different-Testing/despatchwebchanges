/** @jest-environment jest-environment-jsdom */

import {renderHook, act} from '@testing-library/react';
import {useDispatchLayout, columnsToRglLayout} from './useDispatchLayout';
import {DispatchBox} from '../DispatchPage.interfaces';

// Prevent actual migration logic from running
jest.mock('./migrateDispatchLayouts', () => ({
    migrateDispatchLayoutsIfNeeded: jest.fn(),
}));

const CONTACT_ID = 99;
const layoutKey = `layout-${CONTACT_ID}`;
const lastActiveKey = `lastActiveLayout-${CONTACT_ID}`;
const rglKey = (name: string) => `rglLayout-Dispatch-${CONTACT_ID}-${name}`;
const visKey = (name: string) => `boxVisibility-Dispatch-${CONTACT_ID}-${name}`;

beforeEach(() => {
    localStorage.clear();
    (window as any).ContactID = CONTACT_ID;
});

afterEach(() => {
    delete (window as any).ContactID;
});

// ── columnsToRglLayout ──────────────────────────────────────────────────

describe('columnsToRglLayout', () => {
    it('converts a 3-column layout to 12-column RGL items', () => {
        const columns = [
            {id: 'c1', width: '50%', boxes: [{name: 'a', height: '50%'}, {name: 'b', height: '50%'}]},
            {id: 'c2', width: '25%', boxes: [{name: 'c', height: '100%'}]},
            {id: 'c3', width: '25%', boxes: [{name: 'd', height: '100%'}]},
        ];

        const result = columnsToRglLayout(columns);

        expect(result).toHaveLength(4);
        // Column 1 = 50% of 12 = 6 units, starting at x=0
        expect(result[0]).toMatchObject({i: 'a', x: 0, w: 6});
        expect(result[1]).toMatchObject({i: 'b', x: 0, w: 6});
        // Column 2 = 25% of 12 = 3 units, starting at x=6
        expect(result[2]).toMatchObject({i: 'c', x: 6, w: 3});
        // Column 3 = 25% of 12 = 3 units, starting at x=9
        expect(result[3]).toMatchObject({i: 'd', x: 9, w: 3});
    });

    it('sets minW and minH on all items', () => {
        const columns = [{id: 'c1', width: '100%', boxes: [{name: 'x'}]}];
        const result = columnsToRglLayout(columns);
        expect(result[0]).toMatchObject({minW: 2, minH: 3});
    });

    it('stacks boxes vertically within a column', () => {
        const columns = [
            {id: 'c1', width: '100%', boxes: [{name: 'a'}, {name: 'b'}, {name: 'c'}]},
        ];
        const result = columnsToRglLayout(columns);
        expect(result[0].y).toBe(0);
        expect(result[1].y).toBe(6);
        expect(result[2].y).toBe(12);
    });
});

// ── useDispatchLayout ───────────────────────────────────────────────────

describe('useDispatchLayout', () => {
    it('returns default layout when no saved layouts exist', () => {
        const {result} = renderHook(() => useDispatchLayout());

        expect(result.current.currentLayoutName).toBe('Default');
        expect(result.current.isDefaultLayout).toBe(true);
        expect(result.current.layouts).toHaveLength(1);
        expect(result.current.layouts[0].name).toBe('Default');
    });

    it('returns all 6 box IDs as visible by default', () => {
        const {result} = renderHook(() => useDispatchLayout());
        expect(result.current.visibleBoxIds).toHaveLength(6);
        expect(result.current.visibleBoxIds).toContain(DispatchBox.JobsList);
        expect(result.current.visibleBoxIds).toContain(DispatchBox.Map);
    });

    it('generates RGL layout with 12-column grid for default layout', () => {
        const {result} = renderHook(() => useDispatchLayout());
        expect(result.current.cols).toBe(12);
        expect(result.current.rglLayout.length).toBe(6);
    });

    // ── Custom layouts ──────────────────────────────────────────────────

    it('creates a custom layout via saveLayoutAs', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.saveLayoutAs('My Layout'));

        expect(result.current.currentLayoutName).toBe('My Layout');
        expect(result.current.isDefaultLayout).toBe(false);
        expect(result.current.layouts).toHaveLength(2);
        expect(result.current.layouts[1].name).toBe('My Layout');
    });

    it('persists new layout to localStorage', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.saveLayoutAs('Saved'));

        const stored = JSON.parse(localStorage.getItem(layoutKey)!);
        expect(stored).toHaveLength(2);
        expect(stored[1].name).toBe('Saved');
        expect(localStorage.getItem(lastActiveKey)).toBe('Saved');
    });

    it('seeds new layout RGL positions from default layout', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.saveLayoutAs('Custom'));

        const savedRgl = JSON.parse(localStorage.getItem(rglKey('Custom'))!);
        expect(savedRgl).toHaveLength(6);
        expect(savedRgl[0].i).toBeDefined();
    });

    it('switches to custom layout and sets isDefaultLayout to false', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.saveLayoutAs('Custom'));

        expect(result.current.isDefaultLayout).toBe(false);
        expect(result.current.currentLayoutName).toBe('Custom');
    });

    // ── Layout switching ────────────────────────────────────────────────

    it('switches back to default via loadLayout(0)', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.saveLayoutAs('Custom'));
        expect(result.current.isDefaultLayout).toBe(false);

        act(() => result.current.loadLayout(0));
        expect(result.current.isDefaultLayout).toBe(true);
        expect(result.current.currentLayoutName).toBe('Default');
    });

    it('loads saved RGL positions when switching to custom layout', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.saveLayoutAs('Custom'));

        // Simulate a layout change (drag/resize)
        const modified = result.current.rglLayout.map((item, i) =>
            i === 0 ? {...item, x: 99, y: 99} : item,
        );
        act(() => result.current.onLayoutChange(modified));

        // Switch to default then back to custom
        act(() => result.current.loadLayout(0));
        act(() => result.current.loadLayout(1));

        // Should restore the modified positions
        expect(result.current.rglLayout[0].x).toBe(99);
        expect(result.current.rglLayout[0].y).toBe(99);
    });

    // ── Layout change persistence ───────────────────────────────────────

    it('auto-saves RGL positions on layout change for custom layouts', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.saveLayoutAs('Custom'));

        const modified = result.current.rglLayout.map((item, i) =>
            i === 0 ? {...item, x: 7, y: 3} : item,
        );
        act(() => result.current.onLayoutChange(modified));

        const saved = JSON.parse(localStorage.getItem(rglKey('Custom'))!);
        expect(saved[0].x).toBe(7);
        expect(saved[0].y).toBe(3);
    });

    it('does NOT save RGL positions for the default layout', () => {
        const {result} = renderHook(() => useDispatchLayout());

        const modified = result.current.rglLayout.map((item, i) =>
            i === 0 ? {...item, x: 7} : item,
        );
        act(() => result.current.onLayoutChange(modified));

        expect(localStorage.getItem(rglKey('Default'))).toBeNull();
    });

    // ── Layout deletion ─────────────────────────────────────────────────

    it('deletes a custom layout and switches back to default', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.saveLayoutAs('ToDelete'));
        expect(result.current.layouts).toHaveLength(2);

        act(() => result.current.deleteLayout(1));
        expect(result.current.layouts).toHaveLength(1);
        expect(result.current.isDefaultLayout).toBe(true);
    });

    it('cannot delete the default layout (index 0)', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.deleteLayout(0));
        expect(result.current.layouts).toHaveLength(1);
        expect(result.current.currentLayoutName).toBe('Default');
    });

    // ── Box visibility ──────────────────────────────────────────────────

    it('all boxes visible by default', () => {
        const {result} = renderHook(() => useDispatchLayout());

        for (const box of Object.values(DispatchBox)) {
            expect(result.current.boxStates[box]?.visible).toBe(true);
        }
    });

    it('hides a box via updateBoxStates and removes it from visibleBoxIds', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.updateBoxStates({[DispatchBox.Map]: {visible: false}}));

        expect(result.current.boxStates[DispatchBox.Map].visible).toBe(false);
        expect(result.current.visibleBoxIds).not.toContain(DispatchBox.Map);
    });

    it('persists box visibility to localStorage', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.updateBoxStates({[DispatchBox.Supports]: {visible: false}}));

        const stored = JSON.parse(localStorage.getItem(visKey('Default'))!);
        expect(stored[DispatchBox.Supports].visible).toBe(false);
    });

    // ── Restoring last active layout ────────────────────────────────────

    it('restores last active layout from localStorage on mount', () => {
        // Pre-populate localStorage with a custom layout
        const layouts = [
            {name: 'Default', layout: {columns: []}},
            {name: 'Restored', layout: {columns: []}},
        ];
        localStorage.setItem(layoutKey, JSON.stringify(layouts));
        localStorage.setItem(lastActiveKey, 'Restored');

        const {result} = renderHook(() => useDispatchLayout());

        expect(result.current.currentLayoutName).toBe('Restored');
        expect(result.current.isDefaultLayout).toBe(false);
    });

    it('falls back to Default if last active layout no longer exists', () => {
        localStorage.setItem(layoutKey, JSON.stringify([{name: 'Default', layout: {columns: []}}]));
        localStorage.setItem(lastActiveKey, 'Deleted');

        const {result} = renderHook(() => useDispatchLayout());
        expect(result.current.currentLayoutName).toBe('Default');
    });

    // ── Empty name guard ────────────────────────────────────────────────

    it('rejects empty layout name in saveLayoutAs', () => {
        const {result} = renderHook(() => useDispatchLayout());

        act(() => result.current.saveLayoutAs(''));

        expect(result.current.layouts).toHaveLength(1);
        expect(result.current.currentLayoutName).toBe('Default');
    });
});
