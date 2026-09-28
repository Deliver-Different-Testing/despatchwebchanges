/**
 * The merge request template headings are the parsing contract for release notes,
 * and mirror the mr-release-notes skill's fixed sections — a merge request that
 * follows the skill's format when it was written is classified straight from
 * whichever section it filled in, rather than guessed from the branch name.
 */
export const SECTION_HEADINGS = {
    bugFixes: { canonical: 'Bug Fixes', aliases: [] as string[] },
    newFeatures: { canonical: 'New features', aliases: [] as string[] },
    maintenance: { canonical: 'Maintenance', aliases: [] as string[] },
    test: { canonical: 'What to test', aliases: ['How to test'] },
} as const;

/**
 * Headings from the template this replaced. Kept only so merge requests opened
 * before the template changed still produce a headline instead of falling back
 * to the MR title — not part of the current parsing contract.
 */
const LEGACY_WHAT_HEADINGS = ['What changed', 'What I did', 'Highlights'];
const LEGACY_RISK_HEADINGS = ['Risk / areas touched', 'Implications'];

export interface MrSections {
    bugFixes: string;
    newFeatures: string;
    maintenance: string;
    test: string;
    /** Pre-skill "What changed" prose, used only when no structured section is filled in. */
    legacyWhat: string;
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
        bugFixes: extractSection(description, [SECTION_HEADINGS.bugFixes.canonical, ...SECTION_HEADINGS.bugFixes.aliases]),
        newFeatures: extractSection(description, [
            SECTION_HEADINGS.newFeatures.canonical,
            ...SECTION_HEADINGS.newFeatures.aliases,
        ]),
        maintenance: extractSection(description, [
            SECTION_HEADINGS.maintenance.canonical,
            ...SECTION_HEADINGS.maintenance.aliases,
        ]),
        test: extractSection(description, [SECTION_HEADINGS.test.canonical, ...SECTION_HEADINGS.test.aliases]),
        legacyWhat: extractSection(description, LEGACY_WHAT_HEADINGS),
        risk: extractSection(description, LEGACY_RISK_HEADINGS),
    };
}
