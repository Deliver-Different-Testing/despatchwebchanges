import {applyLegacyHashRedirect, normalizeLegacyHash} from './legacyHash';

describe('normalizeLegacyHash', () => {
    it.each([
        ['#!/dispatch?jobId=1', '#/dispatch?jobId=1'],
        ['#!/', '#/'],
        ['#!', '#/'],
        ['#/jobSearch', null],
        ['', null],
    ])('%s -> %s', (input, expected) => {
        expect(normalizeLegacyHash(input)).toBe(expected);
    });
});

describe('applyLegacyHashRedirect', () => {
    const replaceState = window.history.replaceState as jest.Mock;
    beforeEach(() => replaceState.mockClear());

    it('replaces a legacy hash and leaves a current one alone', () => {
        window.location.hash = '#!/Nationwide?jobId=5';
        applyLegacyHashRedirect();
        expect(replaceState).toHaveBeenCalledWith(null, '', '/#/Nationwide?jobId=5');

        replaceState.mockClear();
        window.location.hash = '#/Nationwide';
        applyLegacyHashRedirect();
        expect(replaceState).not.toHaveBeenCalled();
    });
});
