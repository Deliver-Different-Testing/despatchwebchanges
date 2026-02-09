/**
 * Additional Services Dialog React Module Tests
 *
 * Tests for the module's open() method which handles pre-validation
 * before opening the dialog.
 */

import { additionalServicesApi } from '../../../services/additionalServicesApi';

// Mock angular on window before importing the module
(window as any).angular = {
    module: jest.fn(() => ({})),
};

// Mock the API service
jest.mock('../../../services/additionalServicesApi', () => ({
    additionalServicesApi: {
        hasClientItemsAvailable: jest.fn(),
        getServices: jest.fn(),
        calculatePpdExclusiveAmount: jest.fn(),
        addServicesToJob: jest.fn(),
    },
}));

// Mock React DOM to prevent actual rendering
jest.mock('react-dom/client', () => ({
    createRoot: jest.fn(() => ({
        render: jest.fn(),
        unmount: jest.fn(),
    })),
}));

// Mock the theme
jest.mock('../../../theme/muiTheme', () => ({
    getTheme: jest.fn(() => ({})),
}));

const mockAdditionalServicesApi = additionalServicesApi as jest.Mocked<typeof additionalServicesApi>;

// Import the module after mocks are set up
import { openAdditionalServicesDialog } from './additional-services-dialog-react.module';

describe('AdditionalServicesDialogManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        delete (window as any).angular;
        delete (window as any).ReactAdditionalServicesDialog;
    });

    const createMockJob = (overrides = {}) => ({
        id: 123,
        clientId: 456,
        speedId: 789,
        items: 5,
        speedName: 'Express',
        ...overrides,
    });

    const createMockToastService = () => ({
        showToast: jest.fn(),
    });

    describe('Pre-validation: Client and Speed Check', () => {
        it('should return false when clientId is 0', async () => {
            const job = createMockJob({ clientId: 0 });
            const toastService = createMockToastService();

            const result = await openAdditionalServicesDialog({ job, toastService });

            expect(result).toBe(false);
            expect(mockAdditionalServicesApi.hasClientItemsAvailable).not.toHaveBeenCalled();
        });

        it('should return false when speedId is 0', async () => {
            const job = createMockJob({ speedId: 0 });
            const toastService = createMockToastService();

            const result = await openAdditionalServicesDialog({ job, toastService });

            expect(result).toBe(false);
            expect(mockAdditionalServicesApi.hasClientItemsAvailable).not.toHaveBeenCalled();
        });

        it('should return false when both clientId and speedId are 0', async () => {
            const job = createMockJob({ clientId: 0, speedId: 0 });
            const toastService = createMockToastService();

            const result = await openAdditionalServicesDialog({ job, toastService });

            expect(result).toBe(false);
            expect(mockAdditionalServicesApi.hasClientItemsAvailable).not.toHaveBeenCalled();
        });

        it('should not show any toast when clientId or speedId is missing', async () => {
            const job = createMockJob({ clientId: 0 });
            const toastService = createMockToastService();

            await openAdditionalServicesDialog({ job, toastService });

            expect(toastService.showToast).not.toHaveBeenCalled();
        });
    });

    describe('Pre-validation: Services Availability Check', () => {
        it('should call hasClientItemsAvailable with correct params when client and speed are valid', async () => {
            const job = createMockJob({ clientId: 100, speedId: 200 });
            const toastService = createMockToastService();
            mockAdditionalServicesApi.hasClientItemsAvailable.mockResolvedValueOnce(false);

            await openAdditionalServicesDialog({ job, toastService });

            expect(mockAdditionalServicesApi.hasClientItemsAvailable).toHaveBeenCalledWith(100, 200);
        });

        it('should show warning toast and return false when no services available', async () => {
            const job = createMockJob();
            const toastService = createMockToastService();
            mockAdditionalServicesApi.hasClientItemsAvailable.mockResolvedValueOnce(false);

            const result = await openAdditionalServicesDialog({ job, toastService });

            expect(result).toBe(false);
            expect(toastService.showToast).toHaveBeenCalledWith(
                'No additional services have been set up for this client. Please add a service through Admin Manager and try again.',
                'warning'
            );
        });

        it('should not show toast when toastService is not provided and no services available', async () => {
            const job = createMockJob();
            mockAdditionalServicesApi.hasClientItemsAvailable.mockResolvedValueOnce(false);

            // Should not throw even without toastService
            const result = await openAdditionalServicesDialog({ job });

            expect(result).toBe(false);
        });

        it('should proceed to render dialog when services are available', async () => {
            const job = createMockJob();
            const toastService = createMockToastService();
            mockAdditionalServicesApi.hasClientItemsAvailable.mockResolvedValueOnce(true);

            // Start the dialog - it won't resolve because render is mocked
            // but we can verify the API was called correctly
            const openPromise = openAdditionalServicesDialog({ job, toastService });

            // Give time for async operations
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockAdditionalServicesApi.hasClientItemsAvailable).toHaveBeenCalledWith(456, 789);
            expect(toastService.showToast).not.toHaveBeenCalled();

            // The promise will hang since render is mocked, but that's expected
        });
    });

    describe('Pre-validation: API Error Handling', () => {
        it('should show error toast and return false when API call fails', async () => {
            const job = createMockJob();
            const toastService = createMockToastService();
            const apiError = new Error('Network error');
            mockAdditionalServicesApi.hasClientItemsAvailable.mockRejectedValueOnce(apiError);

            const result = await openAdditionalServicesDialog({ job, toastService });

            expect(result).toBe(false);
            expect(toastService.showToast).toHaveBeenCalledWith(
                'Error checking available services: Network error',
                'error'
            );
        });

        it('should handle API errors gracefully when toastService is not provided', async () => {
            const job = createMockJob();
            const apiError = new Error('Server error');
            mockAdditionalServicesApi.hasClientItemsAvailable.mockRejectedValueOnce(apiError);

            // Should not throw even without toastService
            const result = await openAdditionalServicesDialog({ job });

            expect(result).toBe(false);
        });

        it('should show error message from API error object', async () => {
            const job = createMockJob();
            const toastService = createMockToastService();
            const apiError = new Error('Connection timed out');
            mockAdditionalServicesApi.hasClientItemsAvailable.mockRejectedValueOnce(apiError);

            await openAdditionalServicesDialog({ job, toastService });

            expect(toastService.showToast).toHaveBeenCalledWith(
                'Error checking available services: Connection timed out',
                'error'
            );
        });
    });

    describe('Window Global Registration', () => {
        it('should expose ReactAdditionalServicesDialog on window', () => {
            expect((window as any).ReactAdditionalServicesDialog).toBeDefined();
            expect((window as any).ReactAdditionalServicesDialog.open).toBeDefined();
            expect(typeof (window as any).ReactAdditionalServicesDialog.open).toBe('function');
        });
    });
});
