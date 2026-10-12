import fs from 'fs';
import path from 'path';

const RAW = /window\.(ContactID|ClientInternal|IsNetworkPartner|VisibleFeatures|FirstName|FullName|Dispatcher|TimeZone|CurrencyCode|serverConfig)\b/;
// Files allowed to read the globals directly; the session module and the Jest session-global installers.
const ALLOW = new Set(['api/session.ts', 'test/legacySessionGlobals.ts', 'test/setup.ts']);
const SRC_ROOT = path.resolve(__dirname, '..');

function walk(dir: string): string[] {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
        return /\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) ? [p] : [];
    });
}

it('reads session globals only through getSession()', () => {
    const offenders = walk(SRC_ROOT)
        .filter(f => !ALLOW.has(path.relative(SRC_ROOT, f).split(path.sep).join('/')))
        .filter(f => RAW.test(fs.readFileSync(f, 'utf8')))
        .map(f => path.relative(SRC_ROOT, f));
    expect(offenders).toEqual([]);
});
