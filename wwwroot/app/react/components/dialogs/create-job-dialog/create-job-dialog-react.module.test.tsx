/**
 * Create Job Dialog React Module Tests
 *
 * Tests for the module's open() method and window global registration.
 */

// Mock angular on window before importing the module
(window as any).angular = {
    module: jest.fn(() => ({})),
};

// Track render calls across test runs
const mockRender = jest.fn();

// Mock React DOM to prevent actual rendering
jest.mock('react-dom/client', () => ({
    createRoot: jest.fn(() => ({
        render: mockRender,
        unmount: jest.fn(),
    })),
}));

// Mock the theme
jest.mock('../../../theme/muiTheme', () => ({
    getTheme: jest.fn(() => ({})),
}));

// Mock ReactQueryProvider
jest.mock('../../../query', () => ({
    ReactQueryProvider: ({children}: any) => children,
}));

// Import the module after mocks are set up
import {openCreateJobDialog} from './create-job-dialog-react.module';

describe('CreateJobDialogReactModule', () => {
    beforeEach(() => {
        mockRender.mockClear();
    });

    afterAll(() => {
        delete (window as any).angular;
        delete (window as any).ReactCreateJobDialog;
    });

    describe('Window Global Registration', () => {
        it('should expose ReactCreateJobDialog on window', () => {
            expect((window as any).ReactCreateJobDialog).toBeDefined();
        });

        it('should expose an open function on ReactCreateJobDialog', () => {
            expect(typeof (window as any).ReactCreateJobDialog.open).toBe('function');
        });
    });

    describe('openCreateJobDialog', () => {
        it('should return a Promise', () => {
            const result = openCreateJobDialog(true);

            expect(result).toBeInstanceOf(Promise);
        });

        it('should call render when opening', () => {
            openCreateJobDialog(true);

            expect(mockRender).toHaveBeenCalled();
        });

        it('should accept isUsTenant parameter', () => {
            const result = openCreateJobDialog(true);
            expect(result).toBeInstanceOf(Promise);
        });

        it('should accept optional toastService parameter', () => {
            const mockToast = {
                showToast: jest.fn(),
            };

            const result = openCreateJobDialog(false, mockToast);
            expect(result).toBeInstanceOf(Promise);
        });

        it('should call render each time open is called', () => {
            mockRender.mockClear();

            openCreateJobDialog(false);
            openCreateJobDialog(true);

            expect(mockRender).toHaveBeenCalledTimes(2);
        });
    });
});
