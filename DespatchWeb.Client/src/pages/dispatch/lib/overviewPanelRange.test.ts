/** @jest-environment node */
import dayjs from 'dayjs';
import {MAX_OVERVIEW_PANEL_DAYS, clampOverviewPanelRange} from './overviewPanelRange';

describe('clampOverviewPanelRange', () => {
    it('passes a normal working range through untouched', () => {
        const startDate = dayjs('2026-09-01T00:00:00');
        const endDate = dayjs('2026-09-04T23:59:59');

        const result = clampOverviewPanelRange(startDate, endDate);

        expect(result.startDate.isSame(startDate)).toBe(true);
        expect(result.endDate.isSame(endDate)).toBe(true);
        expect(result.clamped).toBe(false);
    });

    /*
     * The dispatch toolbar's "all time" resolves to epoch-start → now+24h. The
     * Overview endpoints were only ever asked for a picked range, so passing that
     * straight through would scan a tenant's whole history for one panel.
     */
    it('clamps an all-time range back to the window and says so', () => {
        const endDate = dayjs('2026-09-11T12:00:00');
        const startDate = dayjs(0);

        const result = clampOverviewPanelRange(startDate, endDate);

        expect(result.clamped).toBe(true);
        expect(result.endDate.isSame(endDate)).toBe(true);
        expect(result.startDate.isSame(endDate.subtract(MAX_OVERVIEW_PANEL_DAYS, 'day'))).toBe(true);
    });

    it('leaves a range of exactly the window alone', () => {
        const endDate = dayjs('2026-09-11T12:00:00');
        const startDate = endDate.subtract(MAX_OVERVIEW_PANEL_DAYS, 'day');

        const result = clampOverviewPanelRange(startDate, endDate);

        expect(result.clamped).toBe(false);
        expect(result.startDate.isSame(startDate)).toBe(true);
    });

    it('leaves an inverted range alone rather than inventing a start after the end', () => {
        const startDate = dayjs('2026-09-11T00:00:00');
        const endDate = dayjs('2026-09-01T00:00:00');

        const result = clampOverviewPanelRange(startDate, endDate);

        expect(result.clamped).toBe(false);
        expect(result.startDate.isSame(startDate)).toBe(true);
    });
});
