import {ILayout} from '../../../../interfaces/layout.interfaces';
import {
    LayoutSnapshot,
    LayoutStorageKeys,
    boxVisibilityKey,
    isDefaultCustomised,
    setDefaultCustomised,
} from './layoutPersistence';
import {
    loadRemoteIntoLocal,
    queueRemotePush,
    readLocalRows,
    rowsToSnapshot,
    snapshotToRows,
} from './layoutSync';
import {getLayouts, saveLayouts} from '../../../services/dispatchLayoutApi';
import {DispatchLayoutDto} from "../../../interfaces/dispatchLayout";

jest.mock('../../../services/dispatchLayoutApi');

const mockGetLayouts = getLayouts as jest.MockedFunction<typeof getLayouts>;
const mockSaveLayouts = saveLayouts as jest.MockedFunction<typeof saveLayouts>;

const keys: LayoutStorageKeys = {
    layoutsKey: 'layouts-test',
    lastActiveLayoutKey: 'lastActive-test',
    boxVisibilityKeyBase: 'boxVisibility-test-page',
};

const defaultLayout: ILayout = {
    name: 'Default',
    layout: {columns: [{id: 'col1', width: '100%', boxes: [{name: 'a', height: '100%'}]}]},
};

const customLayout: ILayout = {
    name: 'Wide',
    layout: {columns: [{id: 'col1', width: '60%', boxes: [{name: 'a', height: '100%'}]}]},
};

beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockGetLayouts.mockResolvedValue([]);
    mockSaveLayouts.mockResolvedValue(undefined);
});

describe('snapshotToRows / rowsToSnapshot', () => {
    it('includes the Default layout so an adjusted default follows the user', () => {
        const snapshot: LayoutSnapshot = {
            layouts: [defaultLayout, customLayout],
            lastActiveLayout: 'Wide',
            boxVisibility: {Wide: {a: {visible: true, collapsed: false}}},
        };

        const rows = snapshotToRows(snapshot, defaultLayout);
        expect(rows.map(r => r.name)).toEqual(['Default', 'Wide']);
        expect(rows[1].isActive).toBe(true);
        expect(JSON.parse(rows[1].layoutJson)).toEqual({
            layout: customLayout.layout,
            boxVisibility: {a: {visible: true, collapsed: false}},
        });
    });

    it('round-trips rows -> snapshot -> rows losslessly', () => {
        const rows: DispatchLayoutDto[] = [
            {
                name: 'Default',
                layoutJson: JSON.stringify({layout: defaultLayout.layout, boxVisibility: {}}),
                isActive: false,
            },
            {
                name: 'Wide',
                layoutJson: JSON.stringify({
                    layout: customLayout.layout,
                    boxVisibility: {a: {visible: false, collapsed: true}},
                }),
                isActive: true,
            },
        ];

        const snapshot = rowsToSnapshot(rows, defaultLayout);
        expect(snapshot.layouts.map(l => l.name)).toEqual(['Default', 'Wide']);
        expect(snapshot.lastActiveLayout).toBe('Wide');

        expect(snapshotToRows(snapshot, defaultLayout)).toEqual(rows);
    });

    it('pins a Default row to slot 0 wherever the server returned it', () => {
        const rows: DispatchLayoutDto[] = [
            {name: 'Wide', layoutJson: JSON.stringify({layout: customLayout.layout, boxVisibility: {}}), isActive: false},
            {name: 'Default', layoutJson: JSON.stringify({layout: {columns: []}, boxVisibility: {}}), isActive: true},
        ];

        const snapshot = rowsToSnapshot(rows, defaultLayout);
        expect(snapshot.layouts.map(l => l.name)).toEqual(['Default', 'Wide']);
        expect(snapshot.layouts[0].layout).toEqual({columns: []});
    });

    it('defaults lastActiveLayout to Default when no row is active', () => {
        const rows: DispatchLayoutDto[] = [
            {name: 'Wide', layoutJson: JSON.stringify({layout: customLayout.layout, boxVisibility: {}}), isActive: false},
        ];
        expect(rowsToSnapshot(rows, defaultLayout).lastActiveLayout).toBe('Default');
    });

    it('skips rows with invalid JSON rather than throwing', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        const rows: DispatchLayoutDto[] = [
            {name: 'Broken', layoutJson: '{not json', isActive: false},
        ];
        const snapshot = rowsToSnapshot(rows, defaultLayout);
        expect(snapshot.layouts.map(l => l.name)).toEqual(['Default']);
        consoleError.mockRestore();
    });
});

describe('loadRemoteIntoLocal', () => {
    it('writes remote layouts into localStorage when the server has data', async () => {
        mockGetLayouts.mockResolvedValue([
            {
                name: 'Wide',
                layoutJson: JSON.stringify({layout: customLayout.layout, boxVisibility: {a: {visible: true, collapsed: false}}}),
                isActive: true,
            },
        ]);

        const applied = await loadRemoteIntoLocal(keys, 'JobSearch', defaultLayout);

        expect(applied).toBe(true);
        const storedLayouts = JSON.parse(localStorage.getItem(keys.layoutsKey)!) as ILayout[];
        expect(storedLayouts.map(l => l.name)).toEqual(['Default', 'Wide']);
        expect(localStorage.getItem(keys.lastActiveLayoutKey)).toBe('Wide');
        expect(localStorage.getItem(boxVisibilityKey(keys, 'Wide'))).toBe(
            JSON.stringify({a: {visible: true, collapsed: false}}),
        );
        expect(mockSaveLayouts).not.toHaveBeenCalled();
    });

    it('marks the default as customised only when the server sent a Default row', async () => {
        mockGetLayouts.mockResolvedValue([
            {name: 'Wide', layoutJson: JSON.stringify({layout: customLayout.layout, boxVisibility: {}}), isActive: true},
        ]);
        await loadRemoteIntoLocal(keys, 'JobSearch', defaultLayout);
        expect(isDefaultCustomised(keys)).toBe(false);

        mockGetLayouts.mockResolvedValue([
            {name: 'Default', layoutJson: JSON.stringify({layout: {columns: []}, boxVisibility: {}}), isActive: true},
        ]);
        await loadRemoteIntoLocal(keys, 'JobSearch', defaultLayout);
        expect(isDefaultCustomised(keys)).toBe(true);
    });

    it('seeds the server from localStorage when the server is empty', async () => {
        mockGetLayouts.mockResolvedValue([]);
        localStorage.setItem(keys.layoutsKey, JSON.stringify([defaultLayout, customLayout]));

        const applied = await loadRemoteIntoLocal(keys, 'JobSearch', defaultLayout);

        expect(applied).toBe(false);
        expect(mockSaveLayouts).toHaveBeenCalledTimes(1);
        const [page, rows] = mockSaveLayouts.mock.calls[0];
        expect(page).toBe('JobSearch');
        expect(rows.map(r => r.name)).toEqual(['Default', 'Wide']);
    });

    it('does not seed when only an untouched Default layout exists locally', async () => {
        mockGetLayouts.mockResolvedValue([]);

        const applied = await loadRemoteIntoLocal(keys, 'JobSearch', defaultLayout);

        expect(applied).toBe(false);
        expect(mockSaveLayouts).not.toHaveBeenCalled();
    });

    it('seeds when the only local layout is a Default the user has adjusted', async () => {
        mockGetLayouts.mockResolvedValue([]);
        const adjusted: ILayout = {name: 'Default', layout: {columns: []}};
        localStorage.setItem(keys.layoutsKey, JSON.stringify([adjusted]));
        setDefaultCustomised(keys, true);

        await loadRemoteIntoLocal(keys, 'JobSearch', defaultLayout);

        expect(mockSaveLayouts).toHaveBeenCalledTimes(1);
        expect(mockSaveLayouts.mock.calls[0][1].map(r => r.name)).toEqual(['Default']);
    });
});

describe('readLocalRows', () => {
    it('serializes the locally stored layouts as rows', () => {
        localStorage.setItem(keys.layoutsKey, JSON.stringify([defaultLayout, customLayout]));
        localStorage.setItem(keys.lastActiveLayoutKey, 'Wide');

        const rows = readLocalRows(keys, defaultLayout);
        expect(rows.map(r => r.name)).toEqual(['Default', 'Wide']);
        expect(rows[1].isActive).toBe(true);
    });
});

describe('queueRemotePush', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('debounces and pushes only the latest rows', () => {
        const first: DispatchLayoutDto[] = [{name: 'A', layoutJson: '{}', isActive: false}];
        const second: DispatchLayoutDto[] = [{name: 'B', layoutJson: '{}', isActive: true}];

        queueRemotePush('JobSearch', first);
        queueRemotePush('JobSearch', second);

        expect(mockSaveLayouts).not.toHaveBeenCalled();
        jest.runAllTimers();

        expect(mockSaveLayouts).toHaveBeenCalledTimes(1);
        expect(mockSaveLayouts).toHaveBeenCalledWith('JobSearch', second);
    });
});
