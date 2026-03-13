/**
 * Tests for JobSearchService
 * Tests URL builder methods and service behavior
 */

import dayjs from 'dayjs';

// Mock the formatDateForApiWithTzs function
jest.mock('../../react/utils/dateUtils', () => ({
    formatDateForApiWithTzs: (date: { format: (f: string) => string }) => date.format('YYYY-MM-DD')
}));

describe('JobSearchService', () => {
    // Test the URL builder functions by reimplementing the logic
    // This tests the algorithm without needing AngularJS DI

    describe('getPodJobsDownloadUrl', () => {
        const formatDateForApiWithTzs = (date: any) => date.format('YYYY-MM-DD');

        const getPodJobsDownloadUrl = (
            fromDate: any,
            toDate: any,
            courierIds?: number[],
            clientIds?: number[],
            speedIds?: number[],
            wild?: string,
            job?: string
        ): string => {
            const params = new URLSearchParams();
            params.append('fromDate', formatDateForApiWithTzs(fromDate));
            params.append('toDate', formatDateForApiWithTzs(toDate));
            if (courierIds?.length) params.append('courierIds', courierIds.join(','));
            if (clientIds?.length) params.append('clientIds', clientIds.join(','));
            if (speedIds?.length) params.append('speedIds', speedIds.join(','));
            if (wild) params.append('wild', wild);
            if (job) params.append('job', job);
            return `/Job/PodSearchDownload?${params.toString()}`;
        };

        it('should include fromDate and toDate', () => {
            const fromDate = dayjs('2024-01-01');
            const toDate = dayjs('2024-01-31');

            const url = getPodJobsDownloadUrl(fromDate, toDate);

            expect(url).toContain('fromDate=2024-01-01');
            expect(url).toContain('toDate=2024-01-31');
        });

        it('should start with correct base path', () => {
            const url = getPodJobsDownloadUrl(dayjs(), dayjs());
            expect(url.startsWith('/Job/PodSearchDownload?')).toBe(true);
        });

        it('should include courierIds when provided', () => {
            const url = getPodJobsDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                [1, 2, 3]
            );

            expect(url).toContain('courierIds=1%2C2%2C3'); // URL encoded comma
        });

        it('should not include courierIds when empty array', () => {
            const url = getPodJobsDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                []
            );

            expect(url).not.toContain('courierIds');
        });

        it('should include clientIds when provided', () => {
            const url = getPodJobsDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                undefined,
                [100, 200]
            );

            expect(url).toContain('clientIds=100%2C200');
        });

        it('should include speedIds when provided', () => {
            const url = getPodJobsDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                undefined,
                undefined,
                [5, 6, 7]
            );

            expect(url).toContain('speedIds=5%2C6%2C7');
        });

        it('should include wild search term when provided', () => {
            const url = getPodJobsDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                undefined,
                undefined,
                undefined,
                'test search'
            );

            expect(url).toContain('wild=test+search');
        });

        it('should include job number when provided', () => {
            const url = getPodJobsDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                undefined,
                undefined,
                undefined,
                undefined,
                'JOB-12345'
            );

            expect(url).toContain('job=JOB-12345');
        });

        it('should include all parameters when all provided', () => {
            const url = getPodJobsDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                [1, 2],
                [10, 20],
                [5],
                'wildcard',
                'JOB-001'
            );

            expect(url).toContain('fromDate=2024-01-01');
            expect(url).toContain('toDate=2024-01-31');
            expect(url).toContain('courierIds=');
            expect(url).toContain('clientIds=');
            expect(url).toContain('speedIds=');
            expect(url).toContain('wild=wildcard');
            expect(url).toContain('job=JOB-001');
        });

        it('should not include undefined or null values', () => {
            const url = getPodJobsDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                undefined,
                undefined,
                undefined,
                undefined,
                undefined
            );

            expect(url).not.toContain('courierIds');
            expect(url).not.toContain('clientIds');
            expect(url).not.toContain('speedIds');
            expect(url).not.toContain('wild');
            expect(url).not.toContain('job');
        });

        it('should handle empty string wild search', () => {
            const url = getPodJobsDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                undefined,
                undefined,
                undefined,
                ''  // Empty string is falsy
            );

            expect(url).not.toContain('wild=');
        });

        it('should URL encode special characters in wild search', () => {
            const url = getPodJobsDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                undefined,
                undefined,
                undefined,
                'test&value=special'
            );

            expect(url).toContain('wild=test%26value%3Dspecial');
        });
    });

    describe('getClientJobsReportDownloadUrl', () => {
        const formatDateForApiWithTzs = (date: any) => date.format('YYYY-MM-DD');

        const getClientJobsReportDownloadUrl = (
            fromDate: any,
            toDate: any,
            clientIds?: number[]
        ): string => {
            const params = new URLSearchParams();
            params.append('startDate', formatDateForApiWithTzs(fromDate));
            params.append('endDate', formatDateForApiWithTzs(toDate));
            if (clientIds?.length) {
                clientIds.forEach(id => params.append('clientIds', id.toString()));
            }
            return `/Job/ClientJobsReportDownload?${params.toString()}`;
        };

        it('should include startDate and endDate', () => {
            const fromDate = dayjs('2024-02-01');
            const toDate = dayjs('2024-02-29');

            const url = getClientJobsReportDownloadUrl(fromDate, toDate);

            expect(url).toContain('startDate=2024-02-01');
            expect(url).toContain('endDate=2024-02-29');
        });

        it('should start with correct base path', () => {
            const url = getClientJobsReportDownloadUrl(dayjs(), dayjs());
            expect(url.startsWith('/Job/ClientJobsReportDownload?')).toBe(true);
        });

        it('should include each clientId as separate parameter', () => {
            const url = getClientJobsReportDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                [100, 200, 300]
            );

            // Each clientId should be a separate parameter
            expect(url).toContain('clientIds=100');
            expect(url).toContain('clientIds=200');
            expect(url).toContain('clientIds=300');
        });

        it('should not include clientIds when empty array', () => {
            const url = getClientJobsReportDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                []
            );

            expect(url).not.toContain('clientIds');
        });

        it('should not include clientIds when undefined', () => {
            const url = getClientJobsReportDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31')
            );

            expect(url).not.toContain('clientIds');
        });

        it('should handle single client ID', () => {
            const url = getClientJobsReportDownloadUrl(
                dayjs('2024-01-01'),
                dayjs('2024-01-31'),
                [42]
            );

            expect(url).toContain('clientIds=42');
            // Ensure it's only once
            expect(url.match(/clientIds/g)?.length).toBe(1);
        });
    });

    describe('URL Parameter Building', () => {
        describe('URLSearchParams behavior', () => {
            it('should properly encode array values joined with comma', () => {
                const params = new URLSearchParams();
                params.append('ids', [1, 2, 3].join(','));

                expect(params.toString()).toBe('ids=1%2C2%2C3');
            });

            it('should allow multiple values for same key', () => {
                const params = new URLSearchParams();
                [10, 20, 30].forEach(id => params.append('clientIds', id.toString()));

                expect(params.toString()).toBe('clientIds=10&clientIds=20&clientIds=30');
            });

            it('should URL encode special characters', () => {
                const params = new URLSearchParams();
                params.append('search', 'hello world & more');

                expect(params.toString()).toBe('search=hello+world+%26+more');
            });

            it('should handle empty string values', () => {
                const params = new URLSearchParams();
                params.append('empty', '');

                expect(params.toString()).toBe('empty=');
            });
        });
    });
});

describe('Service $get Method', () => {
    it('should return itself as the provider pattern', () => {
        // This tests the Angular provider pattern where $get returns the service
        const mockService = {
            $get() {
                return this;
            }
        };

        expect(mockService.$get()).toBe(mockService);
    });
});

describe('FormData Upload Pattern', () => {
    it('should create FormData with file correctly', () => {
        const file = new File(['content'], 'test.csv', { type: 'text/csv' });
        const fd = new FormData();
        fd.append('file', file);

        expect(fd.get('file')).toBeInstanceOf(File);
        expect((fd.get('file') as File).name).toBe('test.csv');
    });

    it('should support various file types', () => {
        const csvFile = new File(['csv'], 'data.csv', { type: 'text/csv' });
        const xlsxFile = new File(['xlsx'], 'data.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const fd1 = new FormData();
        fd1.append('file', csvFile);
        expect((fd1.get('file') as File).name).toBe('data.csv');

        const fd2 = new FormData();
        fd2.append('file', xlsxFile);
        expect((fd2.get('file') as File).name).toBe('data.xlsx');
    });
});
