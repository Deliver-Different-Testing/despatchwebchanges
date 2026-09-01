/**
 * Architecture check: a `MuiThemeIsland` wrapper must have MUI underneath it.
 *
 * `MuiThemeIsland` is migration scaffolding — it re-parents a still-MUI subtree under
 * the app's MUI theme so it can live inside a Mantine island. Once that subtree
 * converts, the wrapper is dead weight: it drags `muiTheme.ts` (800+ lines) and
 * `DialogTransition` into the island's bundle to theme components that no longer read
 * a MUI theme.
 *
 * Dead wrappers are invisible in review because each one carries a comment naming the
 * leaf it exists for, and the comment does not change when the leaf converts. Nine had
 * accumulated by the Phase 5 sweep — `DriverLocationsBox` still said "moves with the
 * maps work (Phase 8)" two phases after `DriverLocations` became Mantine.
 *
 * So the check is mechanical rather than editorial: walk the wrapper's own runtime
 * import graph and require at least one reachable `@mui/*` import. Type-only edges are
 * excluded — `import type` is erased at build time, and counting it falsely implicates
 * files that merely borrow a prop type through a barrel.
 */

import fs from 'fs';
import path from 'path';

const REACT_ROOT = path.join(__dirname, '..');
const SOURCE_EXTENSIONS = ['.tsx', '.ts'];

/** The wrapper's own chain — reaching these proves nothing about the wrapped subtree. */
const WRAPPER_CHAIN = ['components/common/mui-interop', 'theme/muiTheme', 'theme/DialogTransition'];

function isTestFile(file: string): boolean {
    return /\.(test|spec)\.tsx?$/.test(file) || file.includes('__testUtils__') || file.includes('__integration__');
}

function allSourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(item => {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) return allSourceFiles(full);
        return SOURCE_EXTENSIONS.includes(path.extname(item.name)) && !isTestFile(full) ? [full] : [];
    });
}

/** Import specifiers, with `import type {…}` / `export type {…}` edges dropped. */
function runtimeImports(source: string): string[] {
    const specifiers: string[] = [];
    for (const match of source.matchAll(/(?:^|\n)\s*(?:import|export)(\s+type\s+|\s+)([\s\S]*?)from\s*'([^']+)'/g)) {
        const [, typeMarker, clause, specifier] = match;
        if (typeMarker.includes('type')) continue;
        // `import {type Foo, Bar}` is a runtime edge only if something is not type-only.
        const named = clause.match(/\{([\s\S]*)\}/)?.[1];
        if (named !== undefined && named.trim() !== '') {
            const hasValue = named.split(',').some(n => n.trim() !== '' && !/^type\s/.test(n.trim()));
            const hasDefaultOrNamespace = /^\s*[A-Za-z_$][\w$]*\s*,|^\s*\*/.test(clause);
            if (!hasValue && !hasDefaultOrNamespace) continue;
        }
        specifiers.push(specifier);
    }
    return specifiers;
}

/** Relative specifier → an on-disk file, honouring extensionless and index imports. */
function resolve(fromFile: string, specifier: string): string | null {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [
        ...SOURCE_EXTENSIONS.map(ext => base + ext),
        ...SOURCE_EXTENSIONS.map(ext => path.join(base, 'index' + ext)),
    ];
    return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

const sources = new Map<string, string>();
for (const file of allSourceFiles(REACT_ROOT)) sources.set(file, fs.readFileSync(file, 'utf-8'));

function relative(file: string): string {
    return path.relative(REACT_ROOT, file).split(path.sep).join('/');
}

function isWrapperChain(file: string): boolean {
    return WRAPPER_CHAIN.some(part => relative(file).startsWith(part));
}

/** The first file reachable from `entry` that imports `@mui/*` at runtime, if any. */
function findReachableMui(entry: string): string | null {
    const seen = new Set<string>([entry]);
    const queue = [entry];
    while (queue.length > 0) {
        const file = queue.shift()!;
        const source = sources.get(file);
        if (source === undefined) continue;
        const specifiers = runtimeImports(source);
        if (specifiers.some(s => s.startsWith('@mui/'))) return relative(file);
        for (const specifier of specifiers) {
            const next = resolve(file, specifier);
            if (next === null || seen.has(next) || isWrapperChain(next)) continue;
            seen.add(next);
            queue.push(next);
        }
    }
    return null;
}

const OPEN_TAG = /<MuiThemeIsland(?:\s[^>]*)?>/g;

/** The JSX between one `<MuiThemeIsland>` and its matching close, honouring nesting. */
function wrappedRegions(source: string): string[] {
    const regions: string[] = [];
    for (const open of source.matchAll(OPEN_TAG)) {
        const bodyStart = open.index! + open[0].length;
        let depth = 1;
        let cursor = bodyStart;
        while (depth > 0) {
            const nextOpen = source.slice(cursor).search(OPEN_TAG.source.replace(/\/g$/, ''));
            const nextOpenAt = source.slice(cursor).match(/<MuiThemeIsland(?:\s[^>]*)?>/)?.index;
            const nextCloseAt = source.slice(cursor).indexOf('</MuiThemeIsland>');
            if (nextCloseAt === -1) break;
            if (nextOpenAt !== undefined && nextOpenAt < nextCloseAt) {
                depth += 1;
                cursor += nextOpenAt + 1;
            } else {
                depth -= 1;
                if (depth === 0) {
                    regions.push(source.slice(bodyStart, cursor + nextCloseAt));
                    break;
                }
                cursor += nextCloseAt + 1;
            }
            void nextOpen;
        }
    }
    return regions;
}

/** Capitalised JSX tags rendered in a region — the components the wrapper themes. */
function renderedComponents(region: string): string[] {
    const names = new Set<string>();
    for (const tag of region.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)) names.add(tag[1].split('.')[0]);
    return [...names];
}

/** Where a local identifier came from, if it was imported. */
function importSpecifierOf(source: string, identifier: string): string | null {
    for (const match of source.matchAll(/(?:^|\n)\s*import\s+([\s\S]*?)from\s*'([^']+)'/g)) {
        const [, clause, specifier] = match;
        const bound = clause.match(/\{([\s\S]*)\}/)?.[1] ?? '';
        const names = bound.split(',').map(n => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()!.trim());
        const defaultName = clause.split('{')[0].replace(/[*,]|\sas\s|\s/g, '');
        if (names.includes(identifier) || defaultName === identifier) return specifier;
    }
    return null;
}

const wrapperUsers = [...sources.entries()]
    .filter(([, source]) => OPEN_TAG.test(source) && source.includes('</MuiThemeIsland>'))
    .map(([file]) => file)
    .sort();

/** The first MUI import reachable from what this file's wrappers actually render. */
function findMuiUnderWrappers(file: string): string | null {
    const source = sources.get(file)!;
    for (const region of wrappedRegions(source)) {
        for (const component of renderedComponents(region)) {
            const specifier = importSpecifierOf(source, component);
            if (specifier === null) continue;
            if (specifier.startsWith('@mui/')) return `${component} from ${specifier}`;
            const target = resolve(file, specifier);
            if (target === null || isWrapperChain(target)) continue;
            const reached = findReachableMui(target);
            if (reached !== null) return `${component} -> ${reached}`;
        }
    }
    return null;
}

describe('MuiThemeIsland containment', () => {
    it('finds the files that render the wrapper', () => {
        // Guards the scan itself: a rename would make every assertion below vacuous.
        expect(wrapperUsers.length).toBeGreaterThan(0);
    });

    it.each(wrapperUsers.map(f => [relative(f), f]))(
        '%s renders MuiThemeIsland over a subtree that still imports MUI',
        (_name, file) => {
            expect(findMuiUnderWrappers(file)).not.toBeNull();
        },
    );
});
