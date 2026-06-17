import {IBox, ILayout} from '../../../../interfaces/layout.interfaces';
import {
    LayoutStorageKeys,
    boxVisibilityKey,
    loadBoxVisibility,
    loadLastActiveLayoutName,
    loadLayouts,
    saveBoxVisibility,
    saveLastActiveLayoutName,
    saveLayouts,
} from './layoutPersistence';

const keys: LayoutStorageKeys = {
    layoutsKey: 'layoutsCS-test',
    lastActiveLayoutKey: 'lastActiveLayoutCS-test',
    boxVisibilityKeyBase: 'boxVisibility-test-page',
};

const defaultLayout: ILayout = {
    name: 'Default',
    layout: {columns: [{id: 'col1', width: '100%', boxes: [{name: 'a', height: '100%'}]}]},
};

beforeEach(() => {
    localStorage.clear();
});

describe('boxVisibilityKey', () => {
    it('suffixes the base with the layout name', () => {
        expect(boxVisibilityKey(keys, 'Default')).toBe('boxVisibility-test-page-Default');
    });
});

describe('loadLayouts', () => {
    it('returns [defaultLayout] when storage is empty', () => {
        expect(loadLayouts(keys, defaultLayout)).toEqual([defaultLayout]);
    });

    it('returns stored layouts with the default forced into slot 0', () => {
        const stale = {...defaultLayout, layout: {columns: []}};
        const custom: ILayout = {name: 'Custom', layout: {columns: []}};
        localStorage.setItem(keys.layoutsKey, JSON.stringify([stale, custom]));

        const result = loadLayouts(keys, defaultLayout);
        expect(result).toHaveLength(2);
        expect(result[0]).toBe(defaultLayout);
        expect(result[1].name).toBe('Custom');
    });

    it('returns [defaultLayout] if stored JSON is malformed', () => {
        localStorage.setItem(keys.layoutsKey, '{not json');
        expect(loadLayouts(keys, defaultLayout)).toEqual([defaultLayout]);
    });
});

describe('saveLayouts', () => {
    it('writes the layouts array as JSON', () => {
        const custom: ILayout = {name: 'Custom', layout: {columns: []}};
        saveLayouts(keys, [defaultLayout, custom]);
        expect(JSON.parse(localStorage.getItem(keys.layoutsKey)!)).toEqual([defaultLayout, custom]);
    });
});

describe('last-active layout name', () => {
    it('round-trips via save/load', () => {
        saveLastActiveLayoutName(keys, 'Mine');
        expect(loadLastActiveLayoutName(keys)).toBe('Mine');
    });

    it('returns null when nothing was saved', () => {
        expect(loadLastActiveLayoutName(keys)).toBeNull();
    });
});

describe('box visibility', () => {
    const boxes: Record<string, IBox> = {
        a: {name: 'a', visible: true, collapsed: false},
        b: {name: 'b', visible: false, collapsed: true},
    };

    it('round-trips via save/load', () => {
        saveBoxVisibility(keys, 'Default', boxes);
        expect(loadBoxVisibility(keys, 'Default')).toEqual({
            a: {visible: true, collapsed: false},
            b: {visible: false, collapsed: true},
        });
    });

    it('returns null when nothing has been saved for that layout', () => {
        expect(loadBoxVisibility(keys, 'Default')).toBeNull();
    });

    it('accepts the legacy boolean-only format and migrates it on read', () => {
        localStorage.setItem(boxVisibilityKey(keys, 'Default'), JSON.stringify({a: true, b: false}));
        expect(loadBoxVisibility(keys, 'Default')).toEqual({
            a: {visible: true, collapsed: false},
            b: {visible: false, collapsed: false},
        });
    });

    it('fills missing fields with defaults', () => {
        localStorage.setItem(boxVisibilityKey(keys, 'Default'), JSON.stringify({
            a: {},
        }));
        expect(loadBoxVisibility(keys, 'Default')).toEqual({
            a: {visible: true, collapsed: false},
        });
    });

    it('returns null when the saved JSON is malformed', () => {
        localStorage.setItem(boxVisibilityKey(keys, 'Default'), '{not json');
        expect(loadBoxVisibility(keys, 'Default')).toBeNull();
    });

    it('writes IBox.visible/collapsed defaults when missing on the source', () => {
        const sparse: Record<string, IBox> = {a: {name: 'a'}};
        saveBoxVisibility(keys, 'Default', sparse);
        expect(JSON.parse(localStorage.getItem(boxVisibilityKey(keys, 'Default'))!))
            .toEqual({a: {visible: true, collapsed: false}});
    });
});
