import {IBox, ILayout} from '../../../../interfaces/layout.interfaces';
import {
    LayoutStorageKeys,
    boxVisibilityKey,
    clearBoxVisibility,
    addMissingFactoryBoxes,
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

    it('always regenerates the default from code, discarding any stored copy', () => {
        const stale = {...defaultLayout, layout: {columns: []}};
        const custom: ILayout = {name: 'Custom', layout: {columns: []}};
        localStorage.setItem(keys.layoutsKey, JSON.stringify([stale, custom]));

        const result = loadLayouts(keys, defaultLayout);
        expect(result).toHaveLength(2);
        expect(result[0]).toBe(defaultLayout);
        expect(result[1].name).toBe('Custom');
    });

    it('discards a stored default even when it carries an adjusted arrangement', () => {
        // The Default layout is read-only, so a stored copy is only ever stale — a
        // previous build could persist one, and it must not win over the code.
        const adjusted = {...defaultLayout, layout: {columns: [{id: 'col1', width: '42%', boxes: []}]}};
        localStorage.setItem(keys.layoutsKey, JSON.stringify([adjusted]));

        expect(loadLayouts(keys, defaultLayout)).toEqual([defaultLayout]);
    });

    it('pins the default to slot 0 and seeds it when the stored array lacks one', () => {
        const custom: ILayout = {name: 'Custom', layout: {columns: []}};
        const adjusted = {...defaultLayout, layout: {columns: [{id: 'col1', width: '42%', boxes: []}]}};

        localStorage.setItem(keys.layoutsKey, JSON.stringify([custom]));
        expect(loadLayouts(keys, defaultLayout).map(l => l.name)).toEqual(['Default', 'Custom']);

        localStorage.setItem(keys.layoutsKey, JSON.stringify([custom, adjusted]));
        expect(loadLayouts(keys, defaultLayout)).toEqual([defaultLayout, custom]);
    });

    it('returns [defaultLayout] if stored JSON is malformed', () => {
        localStorage.setItem(keys.layoutsKey, '{not json');
        expect(loadLayouts(keys, defaultLayout)).toEqual([defaultLayout]);
    });
});

describe('loadLayouts panel migration', () => {
    /*
     * A stored layout was cloned from whatever arrangement shipped when the user
     * saved it, so a panel added since has no column slot in it — and toggling
     * that panel visible would render nothing at all.
     */
    const threeColFactory: ILayout = {
        name: 'Default',
        layout: {
            columns: [
                {id: 'col1', width: '50%', boxes: [{name: 'a', height: '50%'}, {name: 'newOne', height: '50%'}]},
                {id: 'col2', width: '25%', boxes: [{name: 'b', height: '100%'}]},
                {id: 'col3', width: '25%', boxes: [{name: 'c', height: '100%'}]},
            ],
        },
    };

    const storedWith = (columns: ILayout['layout']['columns']): ILayout =>
        ({name: 'Custom', layout: {columns}});

    it("appends a missing factory box into the factory's own column", () => {
        const stored = storedWith([
            {id: 'col1', width: '50%', boxes: [{name: 'a', height: '50%'}]},
            {id: 'col2', width: '25%', boxes: [{name: 'b', height: '100%'}]},
            {id: 'col3', width: '25%', boxes: [{name: 'c', height: '100%'}]},
        ]);

        const result = addMissingFactoryBoxes(stored, threeColFactory);

        expect(result.layout.columns[0].boxes).toEqual([
            {name: 'a', height: '50%'},
            {name: 'newOne', height: '50%'},
        ]);
        expect(result.layout.columns[1].boxes).toEqual([{name: 'b', height: '100%'}]);
    });

    it('clamps to the last stored column when the stored layout has fewer', () => {
        const stored = storedWith([{id: 'col1', width: '100%', boxes: [{name: 'a', height: '50%'}]}]);

        const result = addMissingFactoryBoxes(stored, threeColFactory);

        expect(result.layout.columns).toHaveLength(1);
        expect(result.layout.columns[0].boxes.map(b => b.name)).toEqual(['a', 'newOne', 'b', 'c']);
    });

    it('returns the same object when every factory box already has a slot', () => {
        const stored = storedWith([
            {id: 'col1', width: '50%', boxes: [{name: 'newOne', height: '20%'}, {name: 'a', height: '80%'}]},
            {id: 'col2', width: '50%', boxes: [{name: 'b'}, {name: 'c'}]},
        ]);

        // Reference identity, so the no-op path cannot churn layoutVersion or the
        // remote-push diff on every read.
        expect(addMissingFactoryBoxes(stored, threeColFactory)).toBe(stored);
    });

    it('leaves a stored layout with no columns untouched', () => {
        const stored = storedWith([]);

        expect(addMissingFactoryBoxes(stored, threeColFactory)).toBe(stored);
    });

    it('keeps a box the factory has since dropped', () => {
        const stored = storedWith([
            {id: 'col1', width: '100%', boxes: [{name: 'a'}, {name: 'retired'}, {name: 'newOne'}, {name: 'b'}, {name: 'c'}]},
        ]);

        expect(addMissingFactoryBoxes(stored, threeColFactory).layout.columns[0].boxes
            .map(b => b.name)).toContain('retired');
    });

    it('migrates stored layouts on the way out of loadLayouts', () => {
        localStorage.setItem(keys.layoutsKey, JSON.stringify([
            storedWith([{id: 'col1', width: '100%', boxes: [{name: 'a', height: '100%'}]}]),
        ]));

        const [, custom] = loadLayouts(keys, threeColFactory);

        expect(custom.layout.columns[0].boxes.map(b => b.name)).toEqual(['a', 'newOne', 'b', 'c']);
    });

    it('does not write the migration back to storage', () => {
        const raw = JSON.stringify([
            storedWith([{id: 'col1', width: '100%', boxes: [{name: 'a', height: '100%'}]}]),
        ]);
        localStorage.setItem(keys.layoutsKey, raw);

        loadLayouts(keys, threeColFactory);

        // loadLayouts runs inside render-phase state initialisers, so it must stay
        // side-effect free; the migration lands on the user's next resize.
        expect(localStorage.getItem(keys.layoutsKey)).toBe(raw);
    });
});

describe('clearBoxVisibility', () => {
    it('removes the stored record for that layout only', () => {
        saveBoxVisibility(keys, 'Default', {a: {name: 'a', visible: false}});
        saveBoxVisibility(keys, 'Wide', {a: {name: 'a', visible: false}});

        clearBoxVisibility(keys, 'Default');

        expect(loadBoxVisibility(keys, 'Default')).toBeNull();
        expect(loadBoxVisibility(keys, 'Wide')).not.toBeNull();
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
