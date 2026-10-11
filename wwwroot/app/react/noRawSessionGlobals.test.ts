import fs from 'fs';
import path from 'path';

const RAW = /window\.(ContactID|ClientInternal|IsNetworkPartner|VisibleFeatures|FirstName|FullName|Dispatcher|TimeZone|CurrencyCode|serverConfig)\b/;
// Files allowed to read the globals directly; none yet besides the session module itself.
const ALLOW = new Set(['session.ts']);

function walk(dir: string): string[] {
    return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
        return /\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) ? [p] : [];
    });
}

it('reads session globals only through getSession()', () => {
    const offenders = walk(__dirname)
        .filter(f => !ALLOW.has(path.relative(__dirname, f).split(path.sep).join('/')))
        .filter(f => RAW.test(fs.readFileSync(f, 'utf8')))
        .map(f => path.relative(__dirname, f));
    expect(offenders).toEqual([]);
});
