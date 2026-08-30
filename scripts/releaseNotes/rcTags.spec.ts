/** @jest-environment node */
import { parseRcTag, compareRcTags, previousRcTag } from './rcTags';

describe('parseRcTag', () => {
    it('parses a release candidate tag and its optional freeze-fix suffix', () => {
        expect(parseRcTag('rc-2026.09.1')).toEqual({
            name: 'rc-2026.09.1',
            year: 2026,
            month: 9,
            seq: 1,
            fix: 0,
        });
        expect(parseRcTag('rc-2026.09.1-fix2')).toEqual({
            name: 'rc-2026.09.1-fix2',
            year: 2026,
            month: 9,
            seq: 1,
            fix: 2,
        });
    });

    it('rejects anything that is not an RC tag', () => {
        expect(parseRcTag('v3.5.0')).toBeNull();
        expect(parseRcTag('rc-2026.9.1')).toBeNull();
        expect(parseRcTag('rc-2026.09.1-hotfix')).toBeNull();
        expect(parseRcTag('')).toBeNull();
    });
});

describe('previousRcTag', () => {
    const tags = [
        'v3.4.0',
        'rc-2026.08.1',
        'rc-2026.09.1',
        'rc-2026.09.1-fix1',
        'rc-2026.09.2',
        'rc-2026.10.1',
    ];

    it('returns the highest RC tag ordered before the current one', () => {
        expect(previousRcTag(tags, 'rc-2026.09.2')).toBe('rc-2026.09.1-fix1');
        expect(previousRcTag(tags, 'rc-2026.09.1')).toBe('rc-2026.08.1');
    });

    it('treats a freeze-fix tag as following its base tag, so a note covers only the fix', () => {
        expect(previousRcTag(tags, 'rc-2026.09.1-fix1')).toBe('rc-2026.09.1');
        expect(previousRcTag([...tags, 'rc-2026.09.1-fix2'], 'rc-2026.09.1-fix2')).toBe('rc-2026.09.1-fix1');
    });

    it('returns null when there is no earlier RC tag', () => {
        expect(previousRcTag(tags, 'rc-2026.08.1')).toBeNull();
        expect(previousRcTag(['v3.4.0'], 'rc-2026.08.1')).toBeNull();
    });

    it('ignores the current tag and unparseable tags, and orders numerically not lexically', () => {
        expect(previousRcTag(['rc-2026.09.9', 'rc-2026.09.10', 'not-a-tag'], 'rc-2026.09.11')).toBe('rc-2026.09.10');
    });

    it('throws when the current tag is not an RC tag', () => {
        expect(() => previousRcTag(tags, 'v3.5.0')).toThrow(/rc-/);
    });
});
