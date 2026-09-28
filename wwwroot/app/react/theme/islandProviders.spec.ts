/**
 * Architecture check: every island root mounts through the shared provider stack.
 *
 * There is no single React root in this app — ~53 `*-react.module.tsx` entries each
 * call `createRoot` and bridge into AngularJS. `@mantine/core`'s `useStyles` *throws*
 * without a `MantineProvider` (unlike MUI, which silently falls back to its stock
 * theme), so an island that renders a Mantine component without one dies at mount.
 *
 * That failure is close to undetectable by other means: it only fires when the right
 * subtree renders, so a shared component converted to Mantine can reach a
 * provider-less island and ship. It has happened once — `dispatch-dialog` reached
 * `recurringJobsReact` and `taskDashboardReact`, and only a bundle-size delta caught it.
 *
 * The rule below removes the judgement call: an island's render argument is always
 * `islandTree(...)`, which supplies the provider. Islands whose own tree is still MUI
 * nested `<MuiThemeIsland>` *inside* it, back when MUI was still installed.
 */

import fs from 'fs';
import path from 'path';

const REACT_ROOT = path.join(__dirname, '..');
const ENTRY_SUFFIX = '-react.module.tsx';

function findIslandEntries(dir: string): string[] {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(item => {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) return findIslandEntries(full);
        return item.name.endsWith(ENTRY_SUFFIX) ? [full] : [];
    });
}

/**
 * `root.render(` calls — the receiver must be a React root, so this does not match
 * the `this.render()` method the AngularJS controller classes define. Every root in
 * the tree is named `root` or `<something>Root`; the `createRoot` assertion below is
 * the backstop if one ever is not.
 */
const ROOT_RENDER = /(?:this\.)?[A-Za-z_$]*[Rr]oot\.render\(/g;

/** The render call's first argument, with leading line and JSX comments stripped. */
function firstArgumentOf(source: string, renderIndex: number): string {
    let rest = source.slice(source.indexOf('.render(', renderIndex) + '.render('.length);
    for (;;) {
        const before = rest;
        rest = rest.replace(/^\s+/, '');
        rest = rest.replace(/^\/\/[^\n]*\n/, '');
        rest = rest.replace(/^\{\s*\/\*[\s\S]*?\*\/\s*\}/, '');
        rest = rest.replace(/^\/\*[\s\S]*?\*\//, '');
        if (rest === before) break;
    }
    return rest.slice(0, 60);
}

const entries = findIslandEntries(REACT_ROOT).map(f => ({
    file: path.relative(REACT_ROOT, f).replace(/\\/g, '/'),
    source: fs.readFileSync(f, 'utf-8'),
}));

describe('island providers', () => {
    it('finds the island entry modules', () => {
        // Guards the glob itself: a rename that stopped matching would make every
        // assertion below vacuously pass.
        expect(entries.length).toBeGreaterThan(40);
    });

    it.each(entries.map(e => [e.file, e.source]))(
        '%s mounts through islandTree()',
        (file, source) => {
            const offenders: string[] = [];
            for (const match of source.matchAll(ROOT_RENDER)) {
                const arg = firstArgumentOf(source, match.index!);
                if (!arg.startsWith('islandTree(')) {
                    offenders.push(arg.split('\n')[0].trim());
                }
            }
            expect(offenders).toEqual([]);
        },
    );

    it.each(entries.map(e => [e.file, e.source]))(
        '%s wraps the root it creates',
        (file, source) => {
            // Backstop for a root named something `ROOT_RENDER` does not match: an
            // entry that creates a root must reference the provider stack somewhere.
            if (source.includes('createRoot(')) {
                expect(source).toContain('islandTree(');
            }
        },
    );

    it.each(entries.map(e => [e.file, e.source]))(
        '%s pulls in no MUI',
        (file, source) => {
            // The rule used to be "MUI may only enter inside the Mantine stack,
            // never wrapping it" — provider order inverting was the failure mode.
            // With MUI uninstalled it is simply: not at all.
            expect(source).not.toMatch(/from\s*'@mui\//);
        },
    );
});
