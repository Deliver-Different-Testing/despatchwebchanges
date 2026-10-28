import {
    checkAppearanceColor,
    fixAppearanceColor,
    mergeAppearance,
    parseAppearanceSettings,
    resolveHighContrast,
} from './appearance';

describe('parseAppearanceSettings', () => {
    it('keeps valid fields from a JSON string or an object and drops the rest', () => {
        expect(parseAppearanceSettings('{"contrast":"high","primary":"#2A4EFF","textLight":"red","bogus":1}'))
            .toEqual({contrast: 'high', primary: '#2a4eff'});
        expect(parseAppearanceSettings({secondary: '#13b964', contrast: 'loud'})).toEqual({secondary: '#13b964'});
    });

    it('returns null for empty, malformed or field-less input', () => {
        expect(parseAppearanceSettings(null)).toBeNull();
        expect(parseAppearanceSettings('')).toBeNull();
        expect(parseAppearanceSettings('{not json')).toBeNull();
        expect(parseAppearanceSettings('{"textDark":"#abc"}')).toBeNull();
        expect(parseAppearanceSettings('"high"')).toBeNull();
    });
});

describe('mergeAppearance', () => {
    it('layers the user override over the tenant default field by field', () => {
        expect(mergeAppearance(
            {contrast: 'high', primary: '#111111', textLight: '#222222'},
            {primary: '#333333'},
        )).toEqual({contrast: 'high', primary: '#333333', textLight: '#222222'});
        expect(mergeAppearance(null, null)).toEqual({});
    });
});

describe('resolveHighContrast', () => {
    it('follows the OS preference for auto (the default) and forces it either way otherwise', () => {
        expect(resolveHighContrast(undefined, true)).toBe(true);
        expect(resolveHighContrast('auto', false)).toBe(false);
        expect(resolveHighContrast('high', false)).toBe(true);
        expect(resolveHighContrast('standard', true)).toBe(false);
    });
});

describe('checkAppearanceColor', () => {
    it('requires 4.5:1 body text against the scheme surfaces, rising to 7:1 in high contrast', () => {
        expect(checkAppearanceColor('textLight', '#0d0c2c', false).passes).toBe(true);
        expect(checkAppearanceColor('textLight', '#f4c430', false).passes).toBe(false);
        const midGrey = checkAppearanceColor('textLight', '#666666', false);
        expect(midGrey.passes).toBe(true);
        expect(checkAppearanceColor('textLight', '#666666', true)).toMatchObject({passes: false, min: 7});
        expect(checkAppearanceColor('textDark', '#0d0c2c', false).passes).toBe(false);
        expect(checkAppearanceColor('textDark', '#f2f0f5', false).passes).toBe(true);
    });

    it('requires readable text on a primary or secondary fill', () => {
        expect(checkAppearanceColor('primary', '#2a4eff', false).passes).toBe(true);
        expect(checkAppearanceColor('secondary', '#f4c430', false).passes).toBe(true);
        expect(checkAppearanceColor('primary', '#7f7f7f', false).passes).toBe(false);
    });
});

describe('fixAppearanceColor', () => {
    it('returns a passing colour near the one picked', () => {
        const fixed = fixAppearanceColor('textLight', '#f4c430', false)!;
        expect(checkAppearanceColor('textLight', fixed, false).passes).toBe(true);
    });
});
