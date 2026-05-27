/**
 * JobDetails.styles - Dense helper function tests
 */

import {
    sectionToolbarSx,
    metricLabelSx,
    metricValueSx,
    listItemTextSlotProps,
    getSectionToolbarSx,
    getMetricLabelSx,
    getMetricValueSx,
    getListItemTextSlotProps,
} from './JobDetails.styles';

describe('Dense style helpers', () => {
    describe('getSectionToolbarSx', () => {
        it('returns normal dimensions when dense is false', () => {
            const result = getSectionToolbarSx(false) as Record<string, any>;
            expect(result.height).toBe(40);
            expect(result.minHeight).toBe(40);
            expect(result.px).toBe(2);
        });

        it('returns compact dimensions when dense is true', () => {
            const result = getSectionToolbarSx(true) as Record<string, any>;
            expect(result.height).toBe(32);
            expect(result.minHeight).toBe(32);
            expect(result.px).toBe(1.5);
        });

        it('preserves base toolbar properties', () => {
            const result = getSectionToolbarSx(true) as Record<string, any>;
            const base = sectionToolbarSx as Record<string, any>;
            expect(result.display).toBe(base.display);
            expect(result.alignItems).toBe(base.alignItems);
            expect(result.bgcolor).toBe(base.bgcolor);
        });
    });

    describe('getMetricLabelSx', () => {
        it('returns normal spacing when dense is false', () => {
            const result = getMetricLabelSx(false) as Record<string, any>;
            expect(result.mb).toBe(0.75);
            expect(result.fontSize).toBe('0.6875rem');
        });

        it('returns compact spacing when dense is true', () => {
            const result = getMetricLabelSx(true) as Record<string, any>;
            expect(result.mb).toBe(0.25);
            expect(result.fontSize).toBe('0.625rem');
        });

        it('preserves base label properties', () => {
            const result = getMetricLabelSx(true) as Record<string, any>;
            const base = metricLabelSx as Record<string, any>;
            expect(result.fontWeight).toBe(base.fontWeight);
            expect(result.textTransform).toBe(base.textTransform);
        });
    });

    describe('getMetricValueSx', () => {
        it('returns normal font size when dense is false', () => {
            const result = getMetricValueSx(false) as Record<string, any>;
            expect(result.fontSize).toBe('0.875rem');
        });

        it('returns smaller font size when dense is true', () => {
            const result = getMetricValueSx(true) as Record<string, any>;
            expect(result.fontSize).toBe('0.8125rem');
        });

        it('preserves base value properties', () => {
            const result = getMetricValueSx(true) as Record<string, any>;
            const base = metricValueSx as Record<string, any>;
            expect(result.fontWeight).toBe(base.fontWeight);
            expect(result.lineHeight).toBe(base.lineHeight);
        });
    });

    describe('getListItemTextSlotProps', () => {
        it('returns normal sizes when dense is false', () => {
            const result = getListItemTextSlotProps(false);
            expect(result.primary.fontSize).toBe('0.6875rem');
            expect(result.primary.sx.mb).toBe(0.25);
            expect(result.secondary.fontSize).toBe('0.875rem');
        });

        it('returns compact sizes when dense is true', () => {
            const result = getListItemTextSlotProps(true);
            expect(result.primary.fontSize).toBe('0.625rem');
            expect(result.primary.sx.mb).toBe(0);
            expect(result.secondary.fontSize).toBe('0.8125rem');
        });

        it('preserves base slot prop properties', () => {
            const result = getListItemTextSlotProps(true);
            expect(result.primary.variant).toBe(listItemTextSlotProps.primary.variant);
            expect(result.primary.fontWeight).toBe(listItemTextSlotProps.primary.fontWeight);
            expect(result.secondary.variant).toBe(listItemTextSlotProps.secondary.variant);
            expect(result.secondary.noWrap).toBe(listItemTextSlotProps.secondary.noWrap);
        });
    });
});
