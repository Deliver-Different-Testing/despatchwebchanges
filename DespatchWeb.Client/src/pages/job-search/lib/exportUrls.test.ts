import dayjs from 'dayjs';
import {getClientJobsReportDownloadUrl, getPodJobsDownloadUrl} from './exportUrls';

// Format dates predictably so the assertions focus on URL structure, not the
// tenant-timezone formatting (which dateUtils owns and tests separately).
jest.mock('../../../utils/dateUtils', () => ({
    formatDateForApiWithTzs: (d: {format: (f: string) => string}) => d.format('YYYY-MM-DD'),
}));

const from = dayjs('2026-06-01');
const to = dayjs('2026-06-15');

function parse(url: string) {
    const [path, query] = url.split('?');
    return {path, params: new URLSearchParams(query)};
}

describe('getPodJobsDownloadUrl', () => {
    it('targets the real PodSearchDownload endpoint with tz-formatted dates', () => {
        const {path, params} = parse(getPodJobsDownloadUrl(from, to));
        expect(path).toBe('/Job/PodSearchDownload');
        expect(params.get('fromDate')).toBe('2026-06-01');
        expect(params.get('toDate')).toBe('2026-06-15');
    });

    it('includes courier, client and speed ids plus wild/job/jobId', () => {
        const {params} = parse(
            getPodJobsDownloadUrl(from, to, [1, 2], [3], [4, 5], 'acme', 'JOB99', 12345),
        );
        expect(params.getAll('courierIds')).toEqual(['1', '2']);
        expect(params.getAll('clientIds')).toEqual(['3']);
        expect(params.getAll('speedIds')).toEqual(['4', '5']);
        expect(params.get('wild')).toBe('acme');
        expect(params.get('job')).toBe('JOB99');
        expect(params.get('jobId')).toBe('12345');
    });

    it('omits optional params when not supplied', () => {
        const {params} = parse(getPodJobsDownloadUrl(from, to));
        expect(params.has('courierIds')).toBe(false);
        expect(params.has('speedIds')).toBe(false);
        expect(params.has('jobId')).toBe(false);
        expect(params.has('wild')).toBe(false);
    });
});

describe('getClientJobsReportDownloadUrl', () => {
    it('targets ClientJobsReportDownload with startDate/endDate and client ids', () => {
        const {path, params} = parse(getClientJobsReportDownloadUrl(from, to, [7, 8]));
        expect(path).toBe('/Job/ClientJobsReportDownload');
        expect(params.get('startDate')).toBe('2026-06-01');
        expect(params.get('endDate')).toBe('2026-06-15');
        expect(params.getAll('clientIds')).toEqual(['7', '8']);
    });
});
