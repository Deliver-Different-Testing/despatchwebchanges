/** @jest-environment node */
/**
 * CourierMapDisplaySettings Tests
 */

import {
    CLASSIC_TEMPLATE,
    LIVE_TEMPLATE,
    matchesTemplate,
} from './CourierMapDisplaySettings';
import type {CourierMapDisplaySettings} from './CourierMapDisplaySettings';

describe('LIVE_TEMPLATE', () => {
    it('matches the requested-look screenshot: number label, no job count, single color, satellite + traffic', () => {
        expect(LIVE_TEMPLATE).toEqual({
            markerLabel: 'number',
            showJobCount: false,
            colorMode: 'single',
            mapView: 'satellite',
            trafficEnabled: true,
        });
    });
});

describe('CLASSIC_TEMPLATE', () => {
    it("matches today's current look: name label, job count shown, status color, roadmap, no traffic", () => {
        expect(CLASSIC_TEMPLATE).toEqual({
            markerLabel: 'name',
            showJobCount: true,
            colorMode: 'status',
            mapView: 'roadmap',
            trafficEnabled: false,
        });
    });
});

describe('matchesTemplate', () => {
    it('returns true when every field equals the template', () => {
        expect(matchesTemplate(LIVE_TEMPLATE, LIVE_TEMPLATE)).toBe(true);
        expect(matchesTemplate(CLASSIC_TEMPLATE, CLASSIC_TEMPLATE)).toBe(true);
    });

    it('returns false when any single field differs', () => {
        const tweaked: CourierMapDisplaySettings = {...LIVE_TEMPLATE, showJobCount: true};
        expect(matchesTemplate(tweaked, LIVE_TEMPLATE)).toBe(false);
    });

    it('returns false when settings match neither template', () => {
        const custom: CourierMapDisplaySettings = {
            markerLabel: 'both',
            showJobCount: true,
            colorMode: 'single',
            mapView: 'terrain',
            trafficEnabled: true,
        };
        expect(matchesTemplate(custom, LIVE_TEMPLATE)).toBe(false);
        expect(matchesTemplate(custom, CLASSIC_TEMPLATE)).toBe(false);
    });
});
