import {getNationwideBetaEnabled, setNationwideBetaEnabled} from './betaPreference';

const KEY = 'nationwideBetaEnabled-0';

describe('nationwide betaPreference', () => {
    beforeEach(() => {
        localStorage.clear();
        (window as unknown as {ContactID: number}).ContactID = 0;
    });

    describe('defaults OFF, unlike Dispatch and Job Search', () => {
        // The React Nationwide page is opt-in while it is unproven: operators
        // keep the classic AngularJS page until they choose otherwise. Dispatch
        // and Job Search default ON because they have been live for some time.
        it('is off when nothing is stored', () => {
            expect(getNationwideBetaEnabled()).toBe(false);
        });

        it('needs an explicit opt-in, not merely a non-false value', () => {
            localStorage.setItem(KEY, 'yes');
            expect(getNationwideBetaEnabled()).toBe(false);
        });

        it('is off when localStorage is unavailable', () => {
            const getItem = jest.spyOn(Storage.prototype, 'getItem')
                .mockImplementation(() => { throw new Error('blocked'); });

            expect(getNationwideBetaEnabled()).toBe(false);

            getItem.mockRestore();
        });
    });

    it('turns on only for a stored "true"', () => {
        localStorage.setItem(KEY, 'true');
        expect(getNationwideBetaEnabled()).toBe(true);
    });

    it('round-trips the operator choice', () => {
        setNationwideBetaEnabled(true);
        expect(getNationwideBetaEnabled()).toBe(true);

        setNationwideBetaEnabled(false);
        expect(getNationwideBetaEnabled()).toBe(false);
    });

    it('lets an operator switch back to the classic page after opting in', () => {
        // The whole point of keeping the AngularJS page: if the React one
        // misbehaves, the toggle must get them back.
        setNationwideBetaEnabled(true);
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
