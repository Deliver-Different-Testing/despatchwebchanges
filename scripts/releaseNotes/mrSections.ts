/**
 * The merge request template headings are the parsing contract for release notes.
 * The aliases cover merge requests written against the previous template, so the
 * first releases after this lands still produce usable notes.
 */
export const SECTION_HEADINGS = {
    what: { canonical: 'What changed', aliases: ['What I did', 'Highlights'] },
    test: { canonical: 'How to test', aliases: [] as string[] },
    risk: { canonical: 'Risk / areas touched', aliases: ['Implications'] },
} as const;

export interface MrSections {
    what: string;
    test: string;
    risk: string;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A section runs to the next heading at the same level or higher, so a `###`
 * sub-heading an author added under `## What changed` stays with the section.
 */
function sectionBody(description: string, heading: string): string {
    const headingPattern = new RegExp(
        String.raw`^(#{1,6})[ \t]*${escapeRegExp(heading)}[ \t]*:?[ \t]*$`,
        'im',
    );
    const match = headingPattern.exec(description);
    if (!match) {
        return '';
    }

    const remainder = description.slice(match.index + match[0].length);
    const nextHeading = remainder.search(new RegExp(String.raw`^#{1,${match[1].length}}[ \t]`, 'm'));

    return clean(nextHeading === -1 ? remainder : remainder.slice(0, nextHeading));
}

/** Drops the template's guidance comments and any `{{placeholder}}` lines left unfilled. */
function clean(body: string): string {
    return body
        .replace(/<!--[\s\S]*?-->/g, '')
        .split('\n')
        .filter((line) => !/^\s*[-+*\d.)\s]*\{\{[^}]*\}\}\s*$/.test(line))
        .join('\n')
        .trim();
}

export function extractSection(description: string | null | undefined, headings: readonly string[]): string {
    if (!description) {
        return '';
    }

    for (const heading of headings) {
        const body = sectionBody(description, heading);
        if (body) {
            return body;
        }
    }

    return '';
}

export function parseMrSections(description: string | null | undefined): MrSections {
    return {
        what: extractSection(description, [SECTION_HEADINGS.what.canonical, ...SECTION_HEADINGS.what.aliases]),
        test: extractSection(description, [SECTION_HEADINGS.test.canonical, ...SECTION_HEADINGS.test.aliases]),
        risk: extractSection(description, [SECTION_HEADINGS.risk.canonical, ...SECTION_HEADINGS.risk.aliases]),
    };
}
