import dayjs from 'dayjs';
import {getPriceDetailReportDownloadUrl} from './priceDetailExport';

// Format dates predictably so assertions focus on URL structure, not tenant-tz formatting
// (which dateUtils owns and tests separately) — mirrors exportUrls.test.ts.
jest.mock('../../../utils/dateUtils', () => ({
    formatDateForApiWithTzs: (d: {format: (f: string) => string}) => d.format('YYYY-MM-DD'),
}));

const from = dayjs('2026-07-01');
const to = dayjs('2026-07-24');

function parse(url: string) {
    const [path, query] = url.split('?');
    return {path, params: new URLSearchParams(query)};
}

describe('getPriceDetailReportDownloadUrl', () => {
    it('targets the PriceDetailReportDownload endpoint with tz-formatted dates', () => {
        const {path, params} = parse(getPriceDetailReportDownloadUrl(from, to));
        expect(path).toBe('/Job/PriceDetailReportDownload');
        expect(params.get('fromDate')).toBe('2026-07-01');
        expect(params.get('toDate')).toBe('2026-07-24');
    });

    it('includes courier, client and speed ids plus wild/job/jobId', () => {
        const {params} = parse(
            getPriceDetailReportDownloadUrl(from, to, [1, 2], [3], [4, 5], 'acme', 'E100OTG', 12345),
        );
        expect(params.getAll('courierIds')).toEqual(['1', '2']);
        expect(params.getAll('clientIds')).toEqual(['3']);
        expect(params.getAll('speedIds')).toEqual(['4', '5']);
        expect(params.get('wild')).toBe('acme');
        expect(params.get('job')).toBe('E100OTG');
        expect(params.get('jobId')).toBe('12345');
    });

    it('omits optional params when not supplied', () => {
        const {params} = parse(getPriceDetailReportDownloadUrl(from, to));
        expect(params.has('courierIds')).toBe(false);
        expect(params.has('clientIds')).toBe(false);
        expect(params.has('speedIds')).toBe(false);
        expect(params.has('wild')).toBe(false);
        expect(params.has('job')).toBe(false);
        expect(params.has('jobId')).toBe(false);
    });
});
