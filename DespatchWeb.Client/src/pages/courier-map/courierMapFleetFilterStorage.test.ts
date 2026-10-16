import {loadSelectedFleetIds, saveSelectedFleetIds} from './courierMapFleetFilterStorage';

const KEY = 'courierMapFleetFilter-0';

describe('courierMapFleetFilterStorage', () => {
    beforeEach(() => {
        localStorage.clear();
        (window as unknown as {ContactID: number}).ContactID = 0;
    });

    it('defaults to [] (all fleets) when nothing is stored', () => {
        expect(loadSelectedFleetIds()).toEqual([]);
    });

    it('defaults to [] when the stored value is not valid JSON', () => {
        localStorage.setItem(KEY, 'not json');
        expect(loadSelectedFleetIds()).toEqual([]);
    });

    it('defaults to [] when the stored value is not an array', () => {
        localStorage.setItem(KEY, JSON.stringify({not: 'an array'}));
        expect(loadSelectedFleetIds()).toEqual([]);
    });

    it('defaults to [] when localStorage is unavailable', () => {
        const getItem = jest.spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => { throw new Error('blocked'); });

        expect(loadSelectedFleetIds()).toEqual([]);

        getItem.mockRestore();
    });

    it('round-trips the selected fleet ids', () => {
        saveSelectedFleetIds([32, 34]);
        expect(loadSelectedFleetIds()).toEqual([32, 34]);

        saveSelectedFleetIds([]);
        expect(loadSelectedFleetIds()).toEqual([]);
    });

    it('does not throw when localStorage rejects the write', () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => { throw new Error('quota'); });

        expect(() => saveSelectedFleetIds([32])).not.toThrow();

        setItem.mockRestore();
    });
});
