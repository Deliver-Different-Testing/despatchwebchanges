/**
 * MUI_ICON_MAP integrity.
 *
 * The map is a codemod dictionary: 200+ entries, each naming a component from
 * `lucide-react` or `@tabler/icons-react`. A typo in one of those names is a
 * runtime `undefined` component — React renders nothing and logs a warning, so
 * it can reach production as a silently-missing glyph. These tests make it a
 * failing test instead.
 */
import React from 'react';
import {render} from '@testing-library/react';
import {MUI_ICON_MAP} from './iconMap';
import {Icon} from './Icon';

const entries = Object.entries(MUI_ICON_MAP);

describe('MUI_ICON_MAP', () => {
    it('is not empty (guards against a bad codemod wiping it)', () => {
        expect(entries.length).toBeGreaterThan(200);
    });

    it('every entry names a real component with a valid lib discriminant', () => {
        const broken = entries.filter(([, entry]) =>
            typeof entry?.component !== 'function' && typeof entry?.component !== 'object',
        );
        expect(broken.map(([name]) => name)).toEqual([]);

        const badLib = entries.filter(([, entry]) => entry.lib !== 'lucide' && entry.lib !== 'tabler');
        expect(badLib.map(([name]) => name)).toEqual([]);
    });

    it('every entry renders an <svg> through the Icon wrapper', () => {
        const failed: string[] = [];
        for (const [name, {lib, component}] of entries) {
            const {container, unmount} = render(
                <Icon {...{[lib]: component}} aria-label={name} />,
            );
            if (!container.querySelector('svg')) {
                failed.push(name);
            }
            unmount();
        }
        expect(failed).toEqual([]);
    });

    it('keys are MUI icon component names (PascalCase, no "Icon" suffix noise)', () => {
        const malformed = entries
            .map(([name]) => name)
            .filter((name) => !/^[A-Z][A-Za-z0-9]*$/.test(name));
        expect(malformed).toEqual([]);
    });
});

describe('MUI_ICON_MAP is reference-only', () => {
    // The dictionary is dynamically indexed, so esbuild cannot tree-shake it —
    // one runtime importer bundles all ~209 glyphs (+178 KB across dist, measured).
    // Type-only imports are erased and therefore fine.
    it('has no runtime importers anywhere in the app', () => {
        const fs = require('fs') as typeof import('fs');
        const path = require('path') as typeof import('path');
        const root = path.resolve(__dirname, '../../..');

        const walk = (dir: string): string[] =>
            fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) return walk(full);
                return /\.tsx?$/.test(e.name) ? [full] : [];
            });

        const offenders = walk(root)
            .filter((f) => !/\.(spec|test)\.tsx?$/.test(f))
            .filter((f) => {
                const src = fs.readFileSync(f, 'utf8');
                return src
                    .split('\n')
                    .some((line) => /from '.*icon\/iconMap'/.test(line) && !line.includes('import type'));
            })
            .map((f) => path.relative(root, f));

        expect(offenders).toEqual([]);
    });
});
