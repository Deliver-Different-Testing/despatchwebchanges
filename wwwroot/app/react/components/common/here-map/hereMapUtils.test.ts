import {createMapTooltipElement, removeStaleMarkers, safeRemoveObject, safeRemoveObjects} from './hereMapUtils';

describe('safeRemoveObject', () => {
    it('does nothing when target is null', () => {
        expect(() => safeRemoveObject(null, {})).not.toThrow();
    });

    it('does nothing when object is null', () => {
        const target = {removeObject: jest.fn()};
        safeRemoveObject(target, null);
        expect(target.removeObject).not.toHaveBeenCalled();
    });

    it('delegates to target.removeObject when both are set', () => {
        const target = {removeObject: jest.fn()};
        const obj = {id: 'x'};
        safeRemoveObject(target, obj);
        expect(target.removeObject).toHaveBeenCalledWith(obj);
    });

    it('swallows IllegalOperationError-style throws and logs a warning', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const target = {
            removeObject: jest.fn(() => {
                const e = new Error('H.map.Group#removeObject object not found');
                e.name = 'IllegalOperationError';
                throw e;
            }),
        };

        expect(() => safeRemoveObject(target, {})).not.toThrow();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});

describe('safeRemoveObjects', () => {
    it('does nothing when target is null', () => {
        expect(() => safeRemoveObjects(null, [{}])).not.toThrow();
    });

    it('does nothing for empty array', () => {
        const target = {removeObjects: jest.fn()};
        safeRemoveObjects(target, []);
        expect(target.removeObjects).not.toHaveBeenCalled();
    });

    it('does nothing when objs is null/undefined', () => {
        const target = {removeObjects: jest.fn()};
        safeRemoveObjects(target, null);
        safeRemoveObjects(target, undefined);
        expect(target.removeObjects).not.toHaveBeenCalled();
    });

    it('delegates to removeObjects for non-empty arrays', () => {
        const target = {removeObjects: jest.fn()};
        const items = [{id: 'a'}, {id: 'b'}];
        safeRemoveObjects(target, items);
        expect(target.removeObjects).toHaveBeenCalledWith(items);
    });

    it('falls back to per-object removal when the batch throws', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const removeObject = jest.fn();
        const target = {
            removeObjects: jest.fn(() => {
                throw new Error('one stale entry breaks the whole batch');
            }),
            removeObject,
        };
        const items = [{id: 'a'}, {id: 'b'}, {id: 'c'}];

        safeRemoveObjects(target, items);

        expect(removeObject).toHaveBeenCalledTimes(3);
        expect(removeObject).toHaveBeenNthCalledWith(1, items[0]);
        expect(removeObject).toHaveBeenNthCalledWith(2, items[1]);
        expect(removeObject).toHaveBeenNthCalledWith(3, items[2]);
        warnSpy.mockRestore();
    });

    it('per-object fallback continues past a single failing item', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const removeObject = jest
            .fn()
            .mockImplementationOnce(() => {})
            .mockImplementationOnce(() => {
                throw new Error('stale');
            })
            .mockImplementationOnce(() => {});
        const target = {
            removeObjects: jest.fn(() => {
                throw new Error('batch failed');
            }),
            removeObject,
        };

        const items = [{id: 'a'}, {id: 'b'}, {id: 'c'}];
        safeRemoveObjects(target, items);

        expect(removeObject).toHaveBeenCalledTimes(3);
        warnSpy.mockRestore();
    });
});

describe('createMapTooltipElement', () => {
    it('attaches a hidden InfoWindow-style bubble to the map container', () => {
        const element = document.createElement('div');

        const tooltip = createMapTooltipElement({getElement: () => element});

        expect(element.firstElementChild).toBe(tooltip);
        expect(tooltip.className).toBe('gm-style-iw-wrapper');
        expect(tooltip.style.display).toBe('none');
        expect(tooltip.querySelector('.gm-style-iw-content')).not.toBeNull();
        expect(tooltip.querySelector('.gm-style-iw-tail')).not.toBeNull();
    });

    it('still returns the bubble when the map has no container yet', () => {
        expect(() => createMapTooltipElement({getElement: () => null})).not.toThrow();
    });
});

describe('removeStaleMarkers', () => {
    it('removes the markers whose ids are gone, in one batch, and keeps the rest', () => {
        const group = {removeObjects: jest.fn()};
        const markers = new Map<number, {marker?: unknown}>([
            [1, {marker: 'one'}],
            [2, {marker: 'two'}],
            [3, {marker: 'three'}],
        ]);

        removeStaleMarkers(markers, new Set([2]), group);

        expect(group.removeObjects).toHaveBeenCalledTimes(1);
        expect(group.removeObjects).toHaveBeenCalledWith(['one', 'three']);
        expect([...markers.keys()]).toEqual([2]);
    });

    it('forgets an entry that never got a marker without asking the map to remove it', () => {
        const group = {removeObjects: jest.fn()};
        const markers = new Map<number, {marker?: unknown}>([[1, {}]]);

        removeStaleMarkers(markers, new Set<number>(), group);

        expect(group.removeObjects).not.toHaveBeenCalled();
        expect(markers.size).toBe(0);
    });

    it('leaves the map alone when nothing is stale', () => {
        const group = {removeObjects: jest.fn()};
        const markers = new Map<number, {marker?: unknown}>([[1, {marker: 'one'}]]);

        removeStaleMarkers(markers, new Set([1]), group);

        expect(group.removeObjects).not.toHaveBeenCalled();
        expect(markers.size).toBe(1);
    });
});
