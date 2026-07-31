import {getDispatchBetaEnabled, setDispatchBetaEnabled} from './betaPreference';

// ContactID is read from window at import time (defaults to 0 in tests), so the
// storage key is `dispatchBetaEnabled-0` here.
const STORAGE_KEY = 'dispatchBetaEnabled-0';

describe('dispatch betaPreference', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to true (React V2) when nothing is stored', () => {
        expect(getDispatchBetaEnabled()).toBe(true);
    });

    it('round-trips true / false through localStorage', () => {
        setDispatchBetaEnabled(true);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
        expect(getDispatchBetaEnabled()).toBe(true);

        setDispatchBetaEnabled(false);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
        expect(getDispatchBetaEnabled()).toBe(false);
    });

    it('only an explicit "false" opts out; any other value is V2', () => {
        localStorage.setItem(STORAGE_KEY, 'yes');
        expect(getDispatchBetaEnabled()).toBe(true);
        localStorage.setItem(STORAGE_KEY, 'false');
        expect(getDispatchBetaEnabled()).toBe(false);
    });

    it('defaults to true when localStorage.getItem throws (private browsing)', () => {
        const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('unavailable');
        });
        expect(getDispatchBetaEnabled()).toBe(true);
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
