import {safeRemoveObject, safeRemoveObjects} from './hereMapUtils';

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
