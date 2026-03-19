/** @jest-environment jest-environment-jsdom */
/**
 * Tests for EditDateTimeDialogService
 * Covers lazy loading of the React bundle, dialog opening for all three modes
 * (time-only, date-only, date-and-time), return value mapping with timezone,
 * cancellation, ISuggestion.text extraction, and error handling.
 */

jest.mock('angular', () => ({
    default: { module: jest.fn(() => ({})) },
    __esModule: true,
}));

import dayjs from 'dayjs';
import { EditDateTimeDialogService } from './edit-date-time-dialog.service';
import { JobProperty } from '../../../enums/job-property.enum';

// --- Mock factories ---

const createMockHttp = (manifestData: Record<string, string> = {}) => ({
    get: jest.fn().mockResolvedValue({ data: manifestData }),
});

const createMockOcLazyLoad = () => ({
    load: jest.fn().mockResolvedValue(undefined),
});

const mockEvent = {} as MouseEvent;

describe('EditDateTimeDialogService', () => {
    let service: EditDateTimeDialogService;
    let mockHttp: ReturnType<typeof createMockHttp>;
    let mockOcLazyLoad: ReturnType<typeof createMockOcLazyLoad>;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();

        mockHttp = createMockHttp({
            'vendor-react.js': 'vendor-react.abc123.js',
            'editDateTimeDialogReact.js': 'editDateTimeDialogReact.def456.js',
        });
        mockOcLazyLoad = createMockOcLazyLoad();

        service = new EditDateTimeDialogService(
            mockOcLazyLoad as any,
            mockHttp as any,
        );

        delete (window as any).React;
        delete (window as any).ReactEditDateTimeDialog;
    });

    afterEach(() => {
        delete (window as any).ReactEditDateTimeDialog;
        delete (window as any).React;
        jest.restoreAllMocks();
    });

    function setupWindowGlobal(result: any = { fieldName: 'PuTime', value: dayjs(), timezone: 'Pacific Standard Time' }) {
        (window as any).ReactEditDateTimeDialog = {
            showEditTimeDialog: jest.fn().mockResolvedValue(result),
            showEditDateDialog: jest.fn().mockResolvedValue(result),
            showEditDateAndTimeDialog: jest.fn().mockResolvedValue(result),
        };
    }

    describe('Service structure', () => {
        it('should have $inject with the expected dependencies', () => {
            expect(EditDateTimeDialogService.$inject).toEqual([
                '$ocLazyLoad',
                '$http',
            ]);
        });

        it('should implement $get returning itself', () => {
            expect(service.$get()).toBe(service);
        });
    });

    describe('Lazy Loading', () => {
        it('should fetch manifest.json on first dialog open', async () => {
            await service.showEditTimeDialog(
                mockEvent, 'Edit Time', JobProperty.PuTime
            ).catch(() => {});

            expect(mockHttp.get).toHaveBeenCalledWith('dist/manifest.json');
        });

        it('should load vendor-react.js with hashed filename from manifest', async () => {
            await service.showEditTimeDialog(
                mockEvent, 'Edit Time', JobProperty.PuTime
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.abc123.js');
        });

        it('should load the edit date time dialog React module with hashed filename', async () => {
            await service.showEditTimeDialog(
                mockEvent, 'Edit Time', JobProperty.PuTime
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.editDateTimeDialogReact',
                files: ['dist/editDateTimeDialogReact.def456.js'],
            });
        });

        it('should skip vendor-react loading if window.React already exists', async () => {
            (window as any).React = {};

            await service.showEditTimeDialog(
                mockEvent, 'Edit Time', JobProperty.PuTime
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledTimes(1);
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.editDateTimeDialogReact',
                files: ['dist/editDateTimeDialogReact.def456.js'],
            });
        });

        it('should skip loading entirely if ReactEditDateTimeDialog is already on window', async () => {
            setupWindowGlobal();

            await service.showEditTimeDialog(
                mockEvent, 'Edit Time', JobProperty.PuTime
            );

            expect(mockHttp.get).not.toHaveBeenCalled();
            expect(mockOcLazyLoad.load).not.toHaveBeenCalled();
        });

        it('should fall back to unmangled filename when manifest does not contain entry', async () => {
            mockHttp = createMockHttp({});
            service = new EditDateTimeDialogService(
                mockOcLazyLoad as any,
                mockHttp as any,
            );

            await service.showEditTimeDialog(
                mockEvent, 'Edit Time', JobProperty.PuTime
            ).catch(() => {});

            expect(mockOcLazyLoad.load).toHaveBeenCalledWith('dist/vendor-react.js');
            expect(mockOcLazyLoad.load).toHaveBeenCalledWith({
                name: 'uDispatch.editDateTimeDialogReact',
                files: ['dist/editDateTimeDialogReact.js'],
            });
        });
    });

    describe('showEditTimeDialog', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should call React dialog with showDate=false and showTime=true', async () => {
            const testDate = dayjs('2024-06-10T10:30:00');

            await service.showEditTimeDialog(
                mockEvent, 'Edit PU Time', JobProperty.PuTime, testDate
            );

            expect((window as any).ReactEditDateTimeDialog.showEditTimeDialog).toHaveBeenCalledWith({
                title: 'Edit PU Time',
                fieldName: JobProperty.PuTime,
                dateTime: testDate,
                defaultTimeZone: undefined,
                showDate: false,
                showTime: true,
            });
        });

        it('should extract text from ISuggestion for defaultTimeZone', async () => {
            const timezone = { id: 1, text: 'Pacific Standard Time' };

            await service.showEditTimeDialog(
                mockEvent, 'Edit PU Time', JobProperty.PuTime, undefined, timezone
            );

            expect((window as any).ReactEditDateTimeDialog.showEditTimeDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    defaultTimeZone: 'Pacific Standard Time',
                })
            );
        });

        it('should return mapped IDialogDateTimeResult on success', async () => {
            const resultValue = dayjs('2024-06-10T14:30:00');
            setupWindowGlobal({
                fieldName: 'PuTime',
                value: resultValue,
                timezone: 'Pacific Standard Time',
            });

            const result = await service.showEditTimeDialog(
                mockEvent, 'Edit PU Time', JobProperty.PuTime
            );

            expect(result).toEqual({
                fieldName: 'PuTime',
                value: resultValue,
                timezone: 'Pacific Standard Time',
            });
        });

        it('should return undefined when dialog is cancelled', async () => {
            setupWindowGlobal(null);

            const result = await service.showEditTimeDialog(
                mockEvent, 'Edit PU Time', JobProperty.PuTime
            );

            expect(result).toBeUndefined();
        });
    });

    describe('showEditDateDialog', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should call React dialog with showDate=true and showTime=false', async () => {
            const testDate = dayjs('2024-06-10');

            await service.showEditDateDialog(
                mockEvent, 'Edit Booked Date', JobProperty.Date, testDate
            );

            expect((window as any).ReactEditDateTimeDialog.showEditDateDialog).toHaveBeenCalledWith({
                title: 'Edit Booked Date',
                fieldName: JobProperty.Date,
                dateTime: testDate,
                defaultTimeZone: undefined,
                showDate: true,
                showTime: false,
            });
        });

        it('should extract text from ISuggestion for defaultTimeZone', async () => {
            const timezone = { id: 2, text: 'New Zealand Standard Time' };

            await service.showEditDateDialog(
                mockEvent, 'Edit Date', JobProperty.Date, undefined, timezone
            );

            expect((window as any).ReactEditDateTimeDialog.showEditDateDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    defaultTimeZone: 'New Zealand Standard Time',
                })
            );
        });

        it('should return mapped IDialogDateTimeResult on success', async () => {
            const resultValue = dayjs('2024-06-15');
            setupWindowGlobal({
                fieldName: 'Date',
                value: resultValue,
                timezone: 'New Zealand Standard Time',
            });

            const result = await service.showEditDateDialog(
                mockEvent, 'Edit Date', JobProperty.Date
            );

            expect(result).toEqual({
                fieldName: 'Date',
                value: resultValue,
                timezone: 'New Zealand Standard Time',
            });
        });

        it('should return undefined when dialog is cancelled', async () => {
            setupWindowGlobal(null);

            const result = await service.showEditDateDialog(
                mockEvent, 'Edit Date', JobProperty.Date
            );

            expect(result).toBeUndefined();
        });
    });

    describe('showEditDateAndTimeDialog', () => {
        beforeEach(() => {
            setupWindowGlobal();
        });

        it('should call React dialog with showDate=true and showTime=true', async () => {
            const testDate = dayjs('2024-06-10T17:00:00');

            await service.showEditDateAndTimeDialog(
                mockEvent, 'Edit Deliver By', JobProperty.DeliverBy, testDate
            );

            expect((window as any).ReactEditDateTimeDialog.showEditDateAndTimeDialog).toHaveBeenCalledWith({
                title: 'Edit Deliver By',
                fieldName: JobProperty.DeliverBy,
                dateTime: testDate,
                defaultTimeZone: undefined,
                showDate: true,
                showTime: true,
            });
        });

        it('should extract text from ISuggestion for defaultTimeZone', async () => {
            const timezone = { id: 3, text: 'Eastern Standard Time' };

            await service.showEditDateAndTimeDialog(
                mockEvent, 'Edit Deliver By', JobProperty.DeliverBy, undefined, timezone
            );

            expect((window as any).ReactEditDateTimeDialog.showEditDateAndTimeDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    defaultTimeZone: 'Eastern Standard Time',
                })
            );
        });

        it('should return mapped IDialogDateTimeResult on success', async () => {
            const resultValue = dayjs('2024-06-10T17:04:00');
            setupWindowGlobal({
                fieldName: 'DeliverBy',
                value: resultValue,
                timezone: 'Eastern Standard Time',
            });

            const result = await service.showEditDateAndTimeDialog(
                mockEvent, 'Edit Deliver By', JobProperty.DeliverBy
            );

            expect(result).toEqual({
                fieldName: 'DeliverBy',
                value: resultValue,
                timezone: 'Eastern Standard Time',
            });
        });

        it('should return undefined when dialog is cancelled', async () => {
            setupWindowGlobal(null);

            const result = await service.showEditDateAndTimeDialog(
                mockEvent, 'Edit Deliver By', JobProperty.DeliverBy
            );

            expect(result).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should throw when React dialog load fails (manifest fetch error)', async () => {
            mockHttp.get.mockRejectedValue(new Error('Network error'));

            await expect(
                service.showEditTimeDialog(mockEvent, 'Edit Time', JobProperty.PuTime)
            ).rejects.toThrow('Network error');
        });

        it('should throw when window global is missing after load', async () => {
            await expect(
                service.showEditTimeDialog(mockEvent, 'Edit Time', JobProperty.PuTime)
            ).rejects.toThrow('React edit date time dialog not loaded');
        });

        it('should throw when ocLazyLoad fails to load module', async () => {
            mockOcLazyLoad.load.mockRejectedValue(new Error('CDN timeout'));

            await expect(
                service.showEditDateDialog(mockEvent, 'Edit Date', JobProperty.Date)
            ).rejects.toThrow('CDN timeout');
        });

        it('should rethrow when the React dialog rejects with a real error', async () => {
            setupWindowGlobal();
            (window as any).ReactEditDateTimeDialog.showEditDateAndTimeDialog.mockRejectedValue(
                new Error('Dialog render failed')
            );

            await expect(
                service.showEditDateAndTimeDialog(mockEvent, 'Edit Deliver By', JobProperty.DeliverBy)
            ).rejects.toThrow('Dialog render failed');
        });
    });
});
