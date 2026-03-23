/** @jest-environment jest-environment-jsdom */
import type {ILayout} from '../DispatchPage.interfaces';

// Mock useDispatchLayout to provide columnsToRglLayout without circular deps
jest.mock('./useDispatchLayout', () => ({
    columnsToRglLayout: jest.fn((columns: Array<{ width: string; boxes: Array<{ name: string }> }>) => {
        // Simplified version that returns items with parsed widths
        const items: Array<{ i: string; x: number; y: number; w: number; h: number }> = [];
        columns.forEach((col, colIdx) => {
            const widthPercent = parseFloat(col.width) || (100 / columns.length);
            const w = Math.round((widthPercent / 100) * 12);
            const x = columns.slice(0, colIdx).reduce((sum, c) => {
                const wp = parseFloat(c.width) || (100 / columns.length);
                return sum + Math.round((wp / 100) * 12);
            }, 0);
            col.boxes.forEach((box, boxIdx) => {
                items.push({i: box.name, x, y: boxIdx * 6, w, h: 6});
            });
        });
        return items;
    }),
}));

import {migrateDispatchLayoutsIfNeeded} from './migrateDispatchLayouts';
import {columnsToRglLayout} from './useDispatchLayout';

const CONTACT_ID = 42;

beforeEach(() => {
    localStorage.clear();
    window.ContactID = CONTACT_ID;
    (columnsToRglLayout as jest.Mock).mockClear();
});

const flagKey = `dispatchLayoutMigrated-${CONTACT_ID}`;
const layoutKey = `layout-${CONTACT_ID}`;

function makeLayout(name: string, columns: ILayout['layout']['columns']): ILayout {
    return {name, layout: {columns}};
}

describe('migrateDispatchLayoutsIfNeeded', () => {
    it('skips when migration flag is already set', () => {
        localStorage.setItem(flagKey, '1');
        localStorage.setItem(layoutKey, JSON.stringify([
            makeLayout('Default', [{id: 'c1', width: '100%', boxes: [{name: 'list', height: '100%'}]}]),
            makeLayout('Custom', [{id: 'c1', width: '640px', boxes: [{name: 'list', height: '300px'}]}]),
        ]));

        migrateDispatchLayoutsIfNeeded();

        // Should not have called columnsToRglLayout since it bailed early
        expect(columnsToRglLayout).not.toHaveBeenCalled();
    });

    it('skips and sets flag when no layouts exist', () => {
        migrateDispatchLayoutsIfNeeded();

        expect(localStorage.getItem(flagKey)).toBe('1');
        expect(columnsToRglLayout).not.toHaveBeenCalled();
    });

    it('skips and sets flag when only Default layout exists', () => {
        localStorage.setItem(layoutKey, JSON.stringify([
            makeLayout('Default', [{id: 'c1', width: '50%', boxes: [{name: 'list'}]}]),
        ]));

        migrateDispatchLayoutsIfNeeded();

        expect(localStorage.getItem(flagKey)).toBe('1');
        expect(columnsToRglLayout).not.toHaveBeenCalled();
    });

    it('normalizes pixel-based column widths to percentages', () => {
        const layouts = [
            makeLayout('Default', [{id: 'c1', width: '50%', boxes: [{name: 'list'}]}]),
            makeLayout('MyLayout', [
                {id: 'c1', width: '600px', boxes: [{name: 'list', height: '50%'}]},
                {id: 'c2', width: '400px', boxes: [{name: 'detail', height: '50%'}]},
            ]),
        ];
        localStorage.setItem(layoutKey, JSON.stringify(layouts));

        migrateDispatchLayoutsIfNeeded();

        const saved = JSON.parse(localStorage.getItem(layoutKey)!) as ILayout[];
        // 600/(600+400) = 60%, 400/(600+400) = 40%
        expect(saved[1].layout.columns[0].width).toBe('60%');
        expect(saved[1].layout.columns[1].width).toBe('40%');
    });

    it('normalizes pixel-based box heights to percentages', () => {
        const layouts = [
            makeLayout('Default', [{id: 'c1', width: '100%', boxes: [{name: 'list'}]}]),
            makeLayout('MyLayout', [
                {id: 'c1', width: '50%', boxes: [
                    {name: 'list', height: '300px'},
                    {name: 'detail', height: '200px'},
                    {name: 'map', height: '500px'},
                ]},
            ]),
        ];
        localStorage.setItem(layoutKey, JSON.stringify(layouts));

        migrateDispatchLayoutsIfNeeded();

        const saved = JSON.parse(localStorage.getItem(layoutKey)!) as ILayout[];
        const boxes = saved[1].layout.columns[0].boxes;
        // 300/1000=30%, 200/1000=20%, 500/1000=50%
        expect(boxes[0].height).toBe('30%');
        expect(boxes[1].height).toBe('20%');
        expect(boxes[2].height).toBe('50%');
    });

    it('leaves percentage-based dimensions unchanged', () => {
        const layouts = [
            makeLayout('Default', [{id: 'c1', width: '100%', boxes: [{name: 'list'}]}]),
            makeLayout('MyLayout', [
                {id: 'c1', width: '60%', boxes: [{name: 'list', height: '40%'}]},
                {id: 'c2', width: '40%', boxes: [{name: 'detail', height: '60%'}]},
            ]),
        ];
        localStorage.setItem(layoutKey, JSON.stringify(layouts));

        migrateDispatchLayoutsIfNeeded();

        const saved = JSON.parse(localStorage.getItem(layoutKey)!) as ILayout[];
        expect(saved[1].layout.columns[0].width).toBe('60%');
        expect(saved[1].layout.columns[1].width).toBe('40%');
    });

    it('generates RGL layout data for each custom layout', () => {
        const layouts = [
            makeLayout('Default', [{id: 'c1', width: '100%', boxes: [{name: 'list'}]}]),
            makeLayout('Layout1', [{id: 'c1', width: '50%', boxes: [{name: 'list'}]}, {id: 'c2', width: '50%', boxes: [{name: 'detail'}]}]),
            makeLayout('Layout2', [{id: 'c1', width: '100%', boxes: [{name: 'map'}]}]),
        ];
        localStorage.setItem(layoutKey, JSON.stringify(layouts));

        migrateDispatchLayoutsIfNeeded();

        const rgl1 = localStorage.getItem(`rglLayout-Dispatch-${CONTACT_ID}-Layout1`);
        const rgl2 = localStorage.getItem(`rglLayout-Dispatch-${CONTACT_ID}-Layout2`);
        expect(rgl1).toBeTruthy();
        expect(rgl2).toBeTruthy();
        expect(JSON.parse(rgl1!)).toEqual(expect.arrayContaining([
            expect.objectContaining({i: 'list'}),
            expect.objectContaining({i: 'detail'}),
        ]));
        expect(columnsToRglLayout).toHaveBeenCalledTimes(2);
    });

    it('does not overwrite existing RGL layout data', () => {
        const rglKey = `rglLayout-Dispatch-${CONTACT_ID}-Custom`;
        localStorage.setItem(rglKey, JSON.stringify([{i: 'list', x: 0, y: 0, w: 12, h: 12}]));
        const layouts = [
            makeLayout('Default', [{id: 'c1', width: '100%', boxes: [{name: 'list'}]}]),
            makeLayout('Custom', [{id: 'c1', width: '100%', boxes: [{name: 'list'}]}]),
        ];
        localStorage.setItem(layoutKey, JSON.stringify(layouts));

        migrateDispatchLayoutsIfNeeded();

        const saved = JSON.parse(localStorage.getItem(rglKey)!);
        expect(saved).toEqual([{i: 'list', x: 0, y: 0, w: 12, h: 12}]);
        expect(columnsToRglLayout).not.toHaveBeenCalled();
    });

    it('migrates box visibility from old key format to new', () => {
        const oldKey = `boxVisibility-1-${CONTACT_ID}-Custom`;
        localStorage.setItem(oldKey, JSON.stringify({
            list: {visible: true},
            detail: {visible: false},
            map: {visible: true},
        }));
        const layouts = [
            makeLayout('Default', [{id: 'c1', width: '100%', boxes: [{name: 'list'}]}]),
            makeLayout('Custom', [{id: 'c1', width: '100%', boxes: [{name: 'list'}]}]),
        ];
        localStorage.setItem(layoutKey, JSON.stringify(layouts));

        migrateDispatchLayoutsIfNeeded();

        const newKey = `boxVisibility-Dispatch-${CONTACT_ID}-Custom`;
        const migrated = JSON.parse(localStorage.getItem(newKey)!);
        expect(migrated).toEqual({
            list: {visible: true},
            detail: {visible: false},
            map: {visible: true},
        });
    });

    it('handles old boolean-only visibility format', () => {
        const oldKey = `boxVisibility-1-${CONTACT_ID}-Custom`;
        localStorage.setItem(oldKey, JSON.stringify({
            list: true,
            detail: false,
            map: true,
        }));
        const layouts = [
            makeLayout('Default', [{id: 'c1', width: '100%', boxes: [{name: 'list'}]}]),
            makeLayout('Custom', [{id: 'c1', width: '100%', boxes: [{name: 'list'}]}]),
        ];
        localStorage.setItem(layoutKey, JSON.stringify(layouts));

        migrateDispatchLayoutsIfNeeded();

        const newKey = `boxVisibility-Dispatch-${CONTACT_ID}-Custom`;
        const migrated = JSON.parse(localStorage.getItem(newKey)!);
        expect(migrated).toEqual({
            list: {visible: true},
            detail: {visible: false},
            map: {visible: true},
        });
    });

    it('does not overwrite existing new-format visibility', () => {
        const newKey = `boxVisibility-Dispatch-${CONTACT_ID}-Custom`;
        localStorage.setItem(newKey, JSON.stringify({list: {visible: false}}));
        const oldKey = `boxVisibility-1-${CONTACT_ID}-Custom`;
        localStorage.setItem(oldKey, JSON.stringify({list: {visible: true}}));
        const layouts = [
            makeLayout('Default', [{id: 'c1', width: '100%', boxes: [{name: 'list'}]}]),
            makeLayout('Custom', [{id: 'c1', width: '100%', boxes: [{name: 'list'}]}]),
        ];
        localStorage.setItem(layoutKey, JSON.stringify(layouts));

        migrateDispatchLayoutsIfNeeded();

        const saved = JSON.parse(localStorage.getItem(newKey)!);
        expect(saved).toEqual({list: {visible: false}});
    });

    it('sets flag even on error', () => {
        // Set up invalid JSON to trigger a parse error on layouts
        localStorage.setItem(layoutKey, '{invalid json');

        migrateDispatchLayoutsIfNeeded();

        expect(localStorage.getItem(flagKey)).toBe('1');
    });
});
