import {getNationwideBetaEnabled, setNationwideBetaEnabled} from './betaPreference';

const KEY = 'nationwideBetaEnabled-0';

describe('nationwide betaPreference', () => {
    beforeEach(() => {
        localStorage.clear();
        (window as unknown as {ContactID: number}).ContactID = 0;
    });

    describe('defaults ON, matching Dispatch and Job Search', () => {
        it('is on when nothing is stored', () => {
            expect(getNationwideBetaEnabled()).toBe(true);
        });

        it('stays on for an unrecognised stored value', () => {
            localStorage.setItem(KEY, 'yes');
            expect(getNationwideBetaEnabled()).toBe(true);
        });

        it('is on when localStorage is unavailable', () => {
            const getItem = jest.spyOn(Storage.prototype, 'getItem')
                .mockImplementation(() => { throw new Error('blocked'); });

            expect(getNationwideBetaEnabled()).toBe(true);

            getItem.mockRestore();
        });
    });

    it('turns off only for a stored "false"', () => {
        localStorage.setItem(KEY, 'false');
        expect(getNationwideBetaEnabled()).toBe(false);
    });

    it('round-trips the operator choice', () => {
        setNationwideBetaEnabled(true);
        expect(getNationwideBetaEnabled()).toBe(true);

        setNationwideBetaEnabled(false);
        expect(getNationwideBetaEnabled()).toBe(false);
    });

    it('lets an operator switch back to the classic page', () => {
        setNationwideBetaEnabled(false);

        expect(localStorage.getItem(KEY)).toBe('false');
        expect(getNationwideBetaEnabled()).toBe(false);
    });

    it('does not throw when localStorage rejects the write', () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => { throw new Error('quota'); });

        expect(() => setNationwideBetaEnabled(true)).not.toThrow();

        setItem.mockRestore();
    });
});
