/**
 * JobDetails.styles - dense helper tests.
 *
 * The ramps are the contract these carry: every job-detail card composes them,
 * so the dense/normal steps are pinned here rather than in each consumer.
 */

import {
    cardContainerProps,
    cardContentStyle,
    cardNotesContainerStyle,
    fieldIconGutterStyle,
    fieldLabelStyle,
    fieldValueStyle,
    metricLabelStyle,
    metricValueStyle,
    sectionBorderStyle,
} from './JobDetails.styles';

describe('cardContainerProps', () => {
    it('keeps the card corner on the 16px step, bordered and clipping its header', () => {
        expect(cardContainerProps.radius).toBe('lg');
        expect(cardContainerProps.withBorder).toBe(true);
        expect(cardContainerProps.style.overflow).toBe('hidden');
    });
});

describe('metric ramps', () => {
    it('steps the label down and tightens its gap when dense', () => {
        expect(metricLabelStyle(false)).toMatchObject({fontSize: '0.6875rem', marginBottom: 6});
        expect(metricLabelStyle(true)).toMatchObject({fontSize: '0.625rem', marginBottom: 2});
    });

    it('keeps the label upper-case and tracked at both densities', () => {
        for (const dense of [false, true]) {
            expect(metricLabelStyle(dense)).toMatchObject({
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
            });
        }
    });

    it('steps the value down when dense but keeps tabular figures so numbers align', () => {
        expect(metricValueStyle(false)).toMatchObject({fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums'});
        expect(metricValueStyle(true)).toMatchObject({fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums'});
        expect(metricValueStyle(false).fontWeight).toBe(700);
    });
});

describe('card padding', () => {
    it('tightens on both axes when dense', () => {
        expect(cardContentStyle(false)).toMatchObject({paddingInline: 16, paddingBlock: 12});
        expect(cardContentStyle(true)).toMatchObject({paddingInline: 12, paddingBlock: 8});
    });

    it('separates the notes strip and stacked sections with a keyline', () => {
        expect(cardNotesContainerStyle.borderTop).toBe('1px solid var(--mantine-color-default-border)');
        expect(sectionBorderStyle.borderTop).toBe('1px solid var(--mantine-color-default-border)');
    });
});

describe('two-line field row', () => {
    it('steps both lines down when dense and drops the label gap', () => {
        expect(fieldLabelStyle(false)).toMatchObject({fontSize: '0.6875rem', marginBottom: 2});
        expect(fieldLabelStyle(true)).toMatchObject({fontSize: '0.625rem', marginBottom: 0});
        expect(fieldValueStyle(false).fontSize).toBe('0.875rem');
        expect(fieldValueStyle(true).fontSize).toBe('0.8125rem');
    });

    /**
     * Truncation is not this module's job any more — the row renders the value as
     * `<Text truncate>`, Mantine's own single-line ellipsis, so the style object
     * must NOT carry a competing `white-space`/`overflow` triple.
     */
    it('leaves truncation to the Text component', () => {
        expect(fieldValueStyle(false)).not.toHaveProperty('whiteSpace');
        expect(fieldValueStyle(false)).not.toHaveProperty('textOverflow');
    });

    it('reserves the icon gutter so labels line up with and without a glyph', () => {
        expect(fieldIconGutterStyle).toMatchObject({minWidth: 36, flexShrink: 0});
    });
});
