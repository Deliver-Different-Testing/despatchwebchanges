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

describe('getCourierFlagLines', () => {
    it('builds the primary line from first name and job counts, appending overdue only when present', () => {
        expect(getCourierFlagLines(courier()).primary).toBe('Dave 4');
        expect(getCourierFlagLines(courier({overDueJobs: 1})).primary).toBe('Dave 4/1');
        expect(getCourierFlagLines(courier({courierName: 'Cher'})).primary).toBe('Cher 4');
    });

    it('uses the first name, never the code', () => {
        const lines = getCourierFlagLines(courier({courierName: 'Dave Smith', code: 'DT14'}));
        expect(lines.primary).toContain('Dave');
        expect(lines.primary).not.toContain('DT14');
    });

    it('builds the secondary line from the last delivery city and elapsed minutes', () => {
        const lines = getCourierFlagLines(courier({
            lastDeliveryCity: 'Ponsonby',
            lastDeliveryTime: minutesAgo(12),
        }));
        expect(lines.secondary).toBe('Ponsonby · 12m');
    });

    it('omits the secondary line entirely when there is no last delivery', () => {
        expect(getCourierFlagLines(courier()).secondary).toBeNull();
        expect(getCourierFlagLines(courier({lastDeliveryCity: 'Ponsonby'})).secondary).toBeNull();
    });

    it('shows the elapsed minutes alone when the city is missing', () => {
        const lines = getCourierFlagLines(courier({lastDeliveryTime: minutesAgo(90)}));
        expect(lines.secondary).toBe('90m');
    });

    it('never renders a negative age from a clock-skewed timestamp', () => {
        const lines = getCourierFlagLines(courier({
            lastDeliveryCity: 'Ponsonby',
            lastDeliveryTime: minutesAgo(-5),
        }));
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
