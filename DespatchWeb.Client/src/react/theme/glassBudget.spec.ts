import fs from 'fs';
import path from 'path';

const react = path.resolve(__dirname, '..');

/**
 * Every source that may declare `backdrop-filter`. Each is a compositing layer that re-blurs
 * everything behind it every frame, and Apple says to keep glass to the few most important
 * floating controls. Adding an entry is a design decision: say where it floats and what is
 * behind it. Dense data surfaces (box headers, tables, list rows) must not appear here.
 * The shared `@deliver-different/glass` package (dropdown panels, map overlays, hero search, lens)
 * lives in node_modules and is not scanned here.
 */
const GLASS_SOURCES = [
    'components/common/box-shell/BoxShell.module.css', // drag ghost only, while held
    'components/common/segmented-toggle/SegmentedToggle.module.css', // sliding indicator only
    'components/dialogs/shared/mantine/DialogGlass.module.css', // bars, only with content beneath
];

const walk = (dir: string): string[] =>
    fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });

describe('glass layer budget', () => {
    it('only the reviewed sources declare backdrop-filter', () => {
        const declaring = walk(react)
            .filter(f => /\.(css|ts|tsx)$/.test(f) && !/\.(test|spec)\./.test(f))
            .filter(f => /backdrop-?filter/i.test(fs.readFileSync(f, 'utf8')))
            .map(f => path.relative(react, f).split(path.sep).join('/'))
            .sort();
        expect(declaring).toEqual([...GLASS_SOURCES].sort());
    });

    it('keeps the sticky box header off glass', () => {
        const css = fs.readFileSync(path.join(react, 'components/common/box-shell/BoxShell.module.css'), 'utf8');
        const headerRules = [...css.matchAll(/\.header[^{]*\{[^}]*\}/g)].map(m => m[0]).join('\n');
        expect(headerRules).not.toMatch(/backdrop-?filter/i);
    });
});
