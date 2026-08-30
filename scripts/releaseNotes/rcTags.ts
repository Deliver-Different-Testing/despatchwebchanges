/**
 * Release candidate tag convention: `rc-YYYY.MM.N`, with `-fixN` appended for a
 * fix cut during the release freeze. The fix suffix has to be part of the pattern
 * — without it a second fix tag would report everything since the base tag and
 * repeat the first fix's contents.
 */
export const RC_TAG_PATTERN = /^rc-(\d{4})\.(\d{2})\.(\d+)(?:-fix(\d+))?$/;

export interface RcTag {
    name: string;
    year: number;
    month: number;
    seq: number;
    fix: number;
}

export function parseRcTag(name: string): RcTag | null {
    const match = RC_TAG_PATTERN.exec(name?.trim() ?? '');
    if (!match) {
        return null;
    }

    return {
        name: name.trim(),
        year: Number(match[1]),
        month: Number(match[2]),
        seq: Number(match[3]),
        fix: match[4] ? Number(match[4]) : 0,
    };
}

export function compareRcTags(a: RcTag, b: RcTag): number {
    return a.year - b.year || a.month - b.month || a.seq - b.seq || a.fix - b.fix;
}

/** The highest RC tag ordered before `currentTag`, or null on the first ever release. */
export function previousRcTag(tagNames: readonly string[], currentTag: string): string | null {
    const current = parseRcTag(currentTag);
    if (!current) {
        throw new Error(`"${currentTag}" is not a release candidate tag (expected rc-YYYY.MM.N[-fixN])`);
    }

    const earlier = tagNames
        .map(parseRcTag)
        .filter((tag): tag is RcTag => tag !== null && compareRcTags(tag, current) < 0)
        .sort(compareRcTags);

    return earlier.length ? earlier[earlier.length - 1].name : null;
}
