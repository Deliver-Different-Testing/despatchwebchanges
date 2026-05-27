/**
 * Tests for Edit Date Time Dialog Service
 */

import dayjs from 'dayjs';
import {
    showEditTimeDialog,
    showEditDateDialog,
    showEditDateAndTimeDialog,
    setToastService,
    editDateTimeDialogService,
} from './editDateTimeDialogService';

// Mock the window.ReactEditDateTimeDialog
const mockShowEditTimeDialog = jest.fn();
const mockShowEditDateDialog = jest.fn();
const mockShowEditDateAndTimeDialog = jest.fn();
const mockSetToastService = jest.fn();

beforeEach(() => {
    // Setup mock on window
    (window as any).ReactEditDateTimeDialog = {
        showEditTimeDialog: mockShowEditTimeDialog,
        showEditDateDialog: mockShowEditDateDialog,
        showEditDateAndTimeDialog: mockShowEditDateAndTimeDialog,
        setToastService: mockSetToastService,
    };
});

afterEach(() => {
    delete (window as any).ReactEditDateTimeDialog;
});

describe('editDateTimeDialogService', () => {
    describe('showEditTimeDialog', () => {
        it('should call the dialog manager with correct options', async () => {
            const testDate = dayjs('2024-03-15T14:30:00');
            const expectedResult = {
                fieldName: 'readyTime',
                value: testDate,
                timezone: 'America/New_York',
            };
            mockShowEditTimeDialog.mockResolvedValue(expectedResult);

            const result = await showEditTimeDialog({
                title: 'Edit Ready Time',
                fieldName: 'readyTime',
                dateTime: testDate,
                defaultTimeZone: 'America/New_York',
            });

            expect(mockShowEditTimeDialog).toHaveBeenCalledWith({
                title: 'Edit Ready Time',
                fieldName: 'readyTime',
                dateTime: testDate,
                defaultTimeZone: 'America/New_York',
                showDate: false,
                showTime: true,
            });
            expect(result).toEqual(expectedResult);
        });

        it('should return null when dialog is cancelled', async () => {
            mockShowEditTimeDialog.mockResolvedValue(null);

            const result = await showEditTimeDialog({
                title: 'Edit Time',
                fieldName: 'time',
            });

            expect(result).toBeNull();
        });

        it('should pass isUSCustomer option', async () => {
            mockShowEditTimeDialog.mockResolvedValue(null);

            await showEditTimeDialog({
                title: 'Edit Time',
                fieldName: 'time',
                isUSCustomer: true,
            });

            expect(mockShowEditTimeDialog).toHaveBeenCalledWith(
                expect.objectContaining({
                    isUSCustomer: true,
                })
            );
        });
    });

    describe('showEditDateDialog', () => {
        it('should call the dialog manager with correct options', async () => {
            const testDate = dayjs('2024-03-15');
            const expectedResult = {
                fieldName: 'deliveryDate',
                value: testDate,
                timezone: 'Pacific/Auckland',
            };
            mockShowEditDateDialog.mockResolvedValue(expectedResult);

            const result = await showEditDateDialog({
                title: 'Edit Delivery Date',
                fieldName: 'deliveryDate',
                dateTime: testDate,
            });

            expect(mockShowEditDateDialog).toHaveBeenCalledWith({
                title: 'Edit Delivery Date',
                fieldName: 'deliveryDate',
                dateTime: testDate,
                showDate: true,
                showTime: false,
            });
            expect(result).toEqual(expectedResult);
        });

        it('should return null when dialog is cancelled', async () => {
            mockShowEditDateDialog.mockResolvedValue(null);

            const result = await showEditDateDialog({
                title: 'Edit Date',
                fieldName: 'date',
            });

            expect(result).toBeNull();
        });
    });

    describe('showEditDateAndTimeDialog', () => {
        it('should call the dialog manager with correct options', async () => {
            const testDate = dayjs('2024-03-15T14:30:00');
            const expectedResult = {
                fieldName: 'deliverBy',
                value: testDate,
                timezone: 'America/New_York',
            };
            mockShowEditDateAndTimeDialog.mockResolvedValue(expectedResult);

            const result = await showEditDateAndTimeDialog({
                title: 'Edit Deliver By',
                fieldName: 'deliverBy',
                dateTime: testDate,
                defaultTimeZone: 'America/New_York',
                isUSCustomer: true,
            });

            expect(mockShowEditDateAndTimeDialog).toHaveBeenCalledWith({
                title: 'Edit Deliver By',
                fieldName: 'deliverBy',
                dateTime: testDate,
                defaultTimeZone: 'America/New_York',
                isUSCustomer: true,
                showDate: true,
                showTime: true,
            });
            expect(result).toEqual(expectedResult);
        });

        it('should return null when dialog is cancelled', async () => {
            mockShowEditDateAndTimeDialog.mockResolvedValue(null);

            const result = await showEditDateAndTimeDialog({
                title: 'Edit DateTime',
                fieldName: 'dateTime',
            });

            expect(result).toBeNull();
        });
    });

    describe('setToastService', () => {
        it('should set the toast service on the dialog manager', () => {
            const mockShowToast = jest.fn();

            setToastService(mockShowToast);

            expect(mockSetToastService).toHaveBeenCalledWith({
                showToast: mockShowToast,
            });
        });
    });

    describe('error handling', () => {
        it('should throw error when dialog manager is not loaded', async () => {
            delete (window as any).ReactEditDateTimeDialog;

            await expect(showEditTimeDialog({
                title: 'Test',
                fieldName: 'test',
            })).rejects.toThrow('EditDateTimeDialog React module not loaded');
        });
    });

    describe('editDateTimeDialogService object', () => {
        it('should export all functions', () => {
            expect(editDateTimeDialogService.showEditTimeDialog).toBe(showEditTimeDialog);
            expect(editDateTimeDialogService.showEditDateDialog).toBe(showEditDateDialog);
            expect(editDateTimeDialogService.showEditDateAndTimeDialog).toBe(showEditDateAndTimeDialog);
            expect(editDateTimeDialogService.setToastService).toBe(setToastService);
        });
    });
});
