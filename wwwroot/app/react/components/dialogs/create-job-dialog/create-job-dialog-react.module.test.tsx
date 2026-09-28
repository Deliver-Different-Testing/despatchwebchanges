/**
 * Create Job Dialog React Module Tests
 *
 * Tests for the module's open() method and window global registration.
 */

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

// Mock ReactQueryProvider
jest.mock('../../../query', () => ({
    ReactQueryProvider: ({children}: any) => children,
}));

// Use require() instead of import so that window.angular is set before module evaluation
let openCreateJobDialog: typeof import('./create-job-dialog-react.module').openCreateJobDialog;

beforeAll(() => {
    (window as any).angular = {module: jest.fn(() => ({}))};
    openCreateJobDialog = require('./create-job-dialog-react.module').openCreateJobDialog;
});

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

export {};
