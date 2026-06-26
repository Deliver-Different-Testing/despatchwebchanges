import {IBox, ILayout} from '../../../../interfaces/layout.interfaces';
import {
    LayoutStorageKeys,
    boxVisibilityKey,
    importLayoutsFrom,
    loadBoxVisibility,
    loadLastActiveLayoutName,
    loadLayouts,
    renameLayoutInStorage,
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

describe('importLayoutsFrom', () => {
    const source: LayoutStorageKeys = {
        layoutsKey: 'layout-v1',
        lastActiveLayoutKey: 'lastActive-v1',
        boxVisibilityKeyBase: 'boxVisibility-v1',
    };
    const target: LayoutStorageKeys = {
        layoutsKey: 'layout-v2',
        lastActiveLayoutKey: 'lastActive-v2',
        boxVisibilityKeyBase: 'boxVisibility-v2',
    };

    const custom = (name: string): ILayout => ({name, layout: {columns: []}});

    it('copies custom layouts into an empty target, ignoring Default', () => {
        saveLayouts(source, [defaultLayout, custom('Wide'), custom('Tall')]);

        const result = importLayoutsFrom(source, target, defaultLayout);

        expect(result.imported).toEqual(['Wide', 'Tall']);
        expect(result.skipped).toEqual([]);
        const stored = loadLayouts(target, defaultLayout);
        expect(stored.map(l => l.name)).toEqual(['Default', 'Wide', 'Tall']);
    });

    it('skips a source layout whose name already exists in the target', () => {
        saveLayouts(source, [defaultLayout, custom('Wide')]);
        saveLayouts(target, [defaultLayout, custom('Wide')]);

        const result = importLayoutsFrom(source, target, defaultLayout);

        expect(result.imported).toEqual([]);
        expect(result.skipped).toEqual(['Wide']);
        expect(loadLayouts(target, defaultLayout)).toHaveLength(2);
    });

    it('carries each imported layout\'s box-visibility record across', () => {
        saveLayouts(source, [defaultLayout, custom('Wide')]);
        saveBoxVisibility(source, 'Wide', {a: {name: 'a', visible: false, collapsed: true}});

        importLayoutsFrom(source, target, defaultLayout);

        expect(loadBoxVisibility(target, 'Wide')).toEqual({a: {visible: false, collapsed: true}});
    });

    it('is a no-op when the source has no custom layouts', () => {
        const result = importLayoutsFrom(source, target, defaultLayout);
        expect(result).toEqual({imported: [], skipped: []});
        expect(localStorage.getItem(target.layoutsKey)).toBeNull();
    });
});

describe('renameLayoutInStorage', () => {
    const custom = (name: string): ILayout => ({name, layout: {columns: []}});

    it('renames a custom layout in the layouts array', () => {
        saveLayouts(keys, [defaultLayout, custom('Wide')]);
        expect(renameLayoutInStorage(keys, 'Wide', 'Widescreen', defaultLayout)).toBe(true);
        expect(loadLayouts(keys, defaultLayout).map(l => l.name)).toEqual(['Default', 'Widescreen']);
    });

    it('moves the box-visibility record to the new name', () => {
        saveLayouts(keys, [defaultLayout, custom('Wide')]);
        saveBoxVisibility(keys, 'Wide', {a: {name: 'a', visible: false, collapsed: true}});

        renameLayoutInStorage(keys, 'Wide', 'Widescreen', defaultLayout);

        expect(loadBoxVisibility(keys, 'Widescreen')).toEqual({a: {visible: false, collapsed: true}});
        expect(localStorage.getItem(boxVisibilityKey(keys, 'Wide'))).toBeNull();
    });

    it('repoints last-active when it referenced the renamed layout', () => {
        saveLayouts(keys, [defaultLayout, custom('Wide')]);
        saveLastActiveLayoutName(keys, 'Wide');

        renameLayoutInStorage(keys, 'Wide', 'Widescreen', defaultLayout);

        expect(loadLastActiveLayoutName(keys)).toBe('Widescreen');
    });

    it('refuses to rename the Default layout', () => {
        saveLayouts(keys, [defaultLayout, custom('Wide')]);
        expect(renameLayoutInStorage(keys, 'Default', 'Home', defaultLayout)).toBe(false);
    });

    it('refuses an empty new name or a colliding name', () => {
        saveLayouts(keys, [defaultLayout, custom('Wide'), custom('Tall')]);
        expect(renameLayoutInStorage(keys, 'Wide', '   ', defaultLayout)).toBe(false);
        expect(renameLayoutInStorage(keys, 'Wide', 'Tall', defaultLayout)).toBe(false);
        expect(loadLayouts(keys, defaultLayout).map(l => l.name)).toEqual(['Default', 'Wide', 'Tall']);
    });

    it('returns false for an unknown layout name', () => {
        saveLayouts(keys, [defaultLayout, custom('Wide')]);
        expect(renameLayoutInStorage(keys, 'Nope', 'New', defaultLayout)).toBe(false);
    });
});
