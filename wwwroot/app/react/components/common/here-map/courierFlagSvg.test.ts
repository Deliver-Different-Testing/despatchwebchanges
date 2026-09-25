import type {IAvailableCourierPosition} from '../../../../interfaces/courier.interface';
import {
    COURIER_FLAG_HEIGHT,
    COURIER_FLAG_LARGE_HEIGHT,
    courierFlagAnchor,
    courierFlagCacheKey,
    createCourierFlagSvg,
    createLargeCourierFlagSvg,
    getCourierFlagLines,
    getCourierStatus,
    lastDeliveryMinutes,
} from './courierFlagSvg';

const COLORS = {bg: '#C8E6C9', text: '#1B5E20', border: '#A5D6A7'};

// 2026-07-15T10:00:00 local, so "12 minutes ago" is unambiguous regardless of the runner's zone.
const NOW = new Date(2026, 6, 15, 10, 0, 0);
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString();

function courier(overrides: Partial<IAvailableCourierPosition> = {}): IAvailableCourierPosition {
    return {
        courierId: 1,
        courierName: 'Dave Smith',
        channelId: 1,
        vehicleType: 'Van',
        code: 'DT14',
        isUrgentArmyDriver: false,
        clearListAreaIDs: [],
        longitude: 174.76,
        latitude: -36.85,
        totalJobs: 4,
        overDueJobs: 0,
        ...overrides,
    };
}

beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
    jest.useRealTimers();
});

const NAME_WITH_COUNT = {markerLabel: 'name' as const, showJobCount: true};
const NUMBER_WITH_COUNT = {markerLabel: 'number' as const, showJobCount: true};
const BOTH_WITH_COUNT = {markerLabel: 'both' as const, showJobCount: true};
const NAME_NO_COUNT = {markerLabel: 'name' as const, showJobCount: false};

describe('getCourierFlagLines', () => {
    it('builds the primary line from first name and job counts, appending overdue only when present', () => {
        expect(getCourierFlagLines(courier(), NAME_WITH_COUNT).primary).toBe('Dave 4');
        expect(getCourierFlagLines(courier({overDueJobs: 1}), NAME_WITH_COUNT).primary).toBe('Dave 4/1');
        expect(getCourierFlagLines(courier({courierName: 'Cher'}), NAME_WITH_COUNT).primary).toBe('Cher 4');
    });

    it('uses the first name, never the code, when markerLabel is "name"', () => {
        const lines = getCourierFlagLines(courier({courierName: 'Dave Smith', code: 'DT14'}), NAME_WITH_COUNT);
        expect(lines.primary).toContain('Dave');
        expect(lines.primary).not.toContain('DT14');
    });

    it('uses the courier code, never the name, when markerLabel is "number"', () => {
        const lines = getCourierFlagLines(courier({courierName: 'Dave Smith', code: 'DT14'}), NUMBER_WITH_COUNT);
        expect(lines.primary).toBe('DT14 4');
        expect(lines.primary).not.toContain('Dave');
    });

    it('falls back to the first name when markerLabel is "number" but the code is blank', () => {
        const lines = getCourierFlagLines(courier({courierName: 'Dave Smith', code: ''}), NUMBER_WITH_COUNT);
        expect(lines.primary).toBe('Dave 4');
    });

    it('combines code and first name when markerLabel is "both"', () => {
        const lines = getCourierFlagLines(courier({courierName: 'Dave Smith', code: 'DT14'}), BOTH_WITH_COUNT);
        expect(lines.primary).toBe('DT14 · Dave 4');
    });

    it('falls back to whichever of code/name is available when markerLabel is "both"', () => {
        expect(getCourierFlagLines(courier({code: ''}), BOTH_WITH_COUNT).primary).toBe('Dave 4');
        expect(getCourierFlagLines(courier({courierName: '', code: 'DT14'}), BOTH_WITH_COUNT).primary).toBe('DT14 4');
    });

    it('omits the job count entirely when showJobCount is false, even when overdue', () => {
        expect(getCourierFlagLines(courier(), NAME_NO_COUNT).primary).toBe('Dave');
        expect(getCourierFlagLines(courier({overDueJobs: 1}), NAME_NO_COUNT).primary).toBe('Dave');
    });

    it('builds the secondary line from the last delivery city and elapsed minutes', () => {
        const lines = getCourierFlagLines(courier({
            lastDeliveryCity: 'Ponsonby',
            lastDeliveryTime: minutesAgo(12),
        }), NAME_WITH_COUNT);
        expect(lines.secondary).toBe('Ponsonby · 12m');
    });

    it('omits the secondary line entirely when there is no last delivery', () => {
        expect(getCourierFlagLines(courier(), NAME_WITH_COUNT).secondary).toBeNull();
        expect(getCourierFlagLines(courier({lastDeliveryCity: 'Ponsonby'}), NAME_WITH_COUNT).secondary).toBeNull();
    });

    it('shows the elapsed minutes alone when the city is missing', () => {
        const lines = getCourierFlagLines(courier({lastDeliveryTime: minutesAgo(90)}), NAME_WITH_COUNT);
        expect(lines.secondary).toBe('90m');
    });

    it('never renders a negative age from a clock-skewed timestamp', () => {
        const lines = getCourierFlagLines(courier({
            lastDeliveryCity: 'Ponsonby',
            lastDeliveryTime: minutesAgo(-5),
        }), NAME_WITH_COUNT);
        expect(lines.secondary).toBe('Ponsonby · 0m');
    });
});

describe('lastDeliveryMinutes', () => {
    it('returns whole elapsed minutes, or null when there is no timestamp', () => {
        expect(lastDeliveryMinutes(minutesAgo(12))).toBe(12);
        expect(lastDeliveryMinutes(minutesAgo(1440))).toBe(1440);
        expect(lastDeliveryMinutes(null)).toBeNull();
        expect(lastDeliveryMinutes(undefined)).toBeNull();
        expect(lastDeliveryMinutes('not a date')).toBeNull();
    });
});

describe('getCourierStatus', () => {
    it('maps job counts to a status', () => {
        expect(getCourierStatus(courier({totalJobs: 0, overDueJobs: 0}))).toBe('noJobs');
        expect(getCourierStatus(courier({totalJobs: 4, overDueJobs: 0}))).toBe('hasJobs');
        expect(getCourierStatus(courier({totalJobs: 4, overDueJobs: 2}))).toBe('overdue');
    });
});

describe('createCourierFlagSvg', () => {
    it('renders both lines and the palette it is given', () => {
        const svg = createCourierFlagSvg({primary: 'Dave 4/1', secondary: 'Ponsonby · 12m'}, COLORS);
        expect(svg).toContain('>Dave 4/1<');
        expect(svg).toContain('>Ponsonby · 12m<');
        expect(svg).toContain(COLORS.bg);
        expect(svg).toContain(COLORS.text);
        expect(svg).toContain(COLORS.border);
    });

    it('renders a short single-line flag when there is no secondary line', () => {
        const twoLine = createCourierFlagSvg({primary: 'Dave 4', secondary: 'Ponsonby · 12m'}, COLORS);
        const oneLine = createCourierFlagSvg({primary: 'Dave 4', secondary: null}, COLORS);

        expect(oneLine).toContain(`height="${COURIER_FLAG_HEIGHT.oneLine}"`);
        expect(twoLine).toContain(`height="${COURIER_FLAG_HEIGHT.twoLine}"`);
        expect(oneLine).not.toContain('Ponsonby');
    });

    it('sizes the pill to the longer of the two lines', () => {
        const widthOf = (svg: string) => Number(/width="(\d+)"/.exec(svg)![1]);

        const shortSecondary = createCourierFlagSvg({primary: 'Dave 4', secondary: '2m'}, COLORS);
        const longSecondary = createCourierFlagSvg(
            {primary: 'Dave 4', secondary: 'Palmerston North · 1440m'}, COLORS);

        expect(widthOf(longSecondary)).toBeGreaterThan(widthOf(shortSecondary));
    });

    it('escapes markup in either line', () => {
        const svg = createCourierFlagSvg(
            {primary: '<script>x</script> 1', secondary: 'A&B · 3m'}, COLORS);
        expect(svg).not.toContain('<script>');
        expect(svg).toContain('&amp;');
    });
});

describe('createLargeCourierFlagSvg', () => {
    it('renders both lines on the pennant', () => {
        const svg = createLargeCourierFlagSvg({primary: 'Dave', secondary: 'Ponsonby · 12m'}, COLORS);
        expect(svg).toContain('>Dave<');
        expect(svg).toContain('>Ponsonby · 12m<');
        expect(svg).toContain(`height="${COURIER_FLAG_LARGE_HEIGHT}"`);
    });
});

describe('courierFlagAnchor', () => {
    it('keeps the stem tip on the GPS point as the flag grows', () => {
        expect(courierFlagAnchor({primary: 'Dave 4', secondary: null}, false).y)
            .toBe(COURIER_FLAG_HEIGHT.oneLine);
        expect(courierFlagAnchor({primary: 'Dave 4', secondary: 'Ponsonby · 12m'}, false).y)
            .toBe(COURIER_FLAG_HEIGHT.twoLine);
        expect(courierFlagAnchor({primary: 'Dave', secondary: null}, true).y)
            .toBe(COURIER_FLAG_LARGE_HEIGHT);
    });

    it('scales the anchor point along with the flag so the stem still meets the GPS point', () => {
        const lines = {primary: 'Dave 4', secondary: null};
        expect(courierFlagAnchor(lines, false, 1.5)).toEqual({
            x: Math.round(4 * 1.5),
            y: Math.round(COURIER_FLAG_HEIGHT.oneLine * 1.5),
        });
    });
});

describe('marker scale', () => {
    const lines = {primary: 'Dave 4', secondary: null};

    it('grows the rendered size but keeps the internal viewBox unscaled, so drawing math is untouched', () => {
        const base = createCourierFlagSvg(lines, COLORS);
        const scaled = createCourierFlagSvg(lines, COLORS, 1.5);

        const attr = (svg: string, name: string) => Number(new RegExp(`${name}="(\\d+(?:\\.\\d+)?)"`).exec(svg)![1]);
        const viewBox = (svg: string) => /viewBox="0 0 (\d+) (\d+)"/.exec(svg)!.slice(1, 3).map(Number);

        expect(attr(scaled, 'width')).toBeCloseTo(attr(base, 'width') * 1.5, 0);
        expect(attr(scaled, 'height')).toBeCloseTo(attr(base, 'height') * 1.5, 0);
        expect(viewBox(scaled)).toEqual(viewBox(base));
    });

    it('leaves the flag at its normal size when no scale is given', () => {
        const svg = createCourierFlagSvg(lines, COLORS);
        expect(svg).toContain(`height="${COURIER_FLAG_HEIGHT.oneLine}"`);
    });

    it('changes the cache key when only the scale differs, so resizing repaints existing markers', () => {
        const a = courierFlagCacheKey(lines, 'hasJobs', false, 1);
        const b = courierFlagCacheKey(lines, 'hasJobs', false, 1.5);
        expect(a).not.toBe(b);
    });
});

describe('courierFlagCacheKey', () => {
    it('changes when the secondary line changes, so a ticking minute repaints the flag', () => {
        const a = courierFlagCacheKey({primary: 'Dave 4', secondary: 'Ponsonby · 12m'}, 'hasJobs', false);
        const b = courierFlagCacheKey({primary: 'Dave 4', secondary: 'Ponsonby · 13m'}, 'hasJobs', false);
        expect(a).not.toBe(b);
    });

    it('distinguishes status and large view, and repeats for identical input', () => {
        const lines = {primary: 'Dave 4', secondary: null};
        expect(courierFlagCacheKey(lines, 'hasJobs', false))
            .toBe(courierFlagCacheKey(lines, 'hasJobs', false));
        expect(courierFlagCacheKey(lines, 'hasJobs', false))
            .not.toBe(courierFlagCacheKey(lines, 'overdue', false));
        expect(courierFlagCacheKey(lines, 'hasJobs', false))
            .not.toBe(courierFlagCacheKey(lines, 'hasJobs', true));
    });
});
