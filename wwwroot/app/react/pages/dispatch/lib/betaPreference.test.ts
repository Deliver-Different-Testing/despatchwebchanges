import {getDispatchBetaEnabled, setDispatchBetaEnabled} from './betaPreference';

// ContactID is read from window at import time (defaults to 0 in tests), so the
// storage key is `dispatchBetaEnabled-0` here.
const STORAGE_KEY = 'dispatchBetaEnabled-0';

describe('dispatch betaPreference', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to false (classic V1) when nothing is stored', () => {
        expect(getDispatchBetaEnabled()).toBe(false);
    });

    it('round-trips true / false through localStorage', () => {
        setDispatchBetaEnabled(true);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
        expect(getDispatchBetaEnabled()).toBe(true);

        setDispatchBetaEnabled(false);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
        expect(getDispatchBetaEnabled()).toBe(false);
    });

    it('only an explicit "true" opts in; any other value is V1', () => {
        localStorage.setItem(STORAGE_KEY, 'yes');
        expect(getDispatchBetaEnabled()).toBe(false);
        localStorage.setItem(STORAGE_KEY, 'true');
        expect(getDispatchBetaEnabled()).toBe(true);
    });

    it('defaults to false when localStorage.getItem throws (private browsing)', () => {
        const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('unavailable');
        });
        expect(getDispatchBetaEnabled()).toBe(false);
        spy.mockRestore();
    });

    it('silently ignores localStorage.setItem failures', () => {
        const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        expect(() => setDispatchBetaEnabled(true)).not.toThrow();
        spy.mockRestore();
    });
});
