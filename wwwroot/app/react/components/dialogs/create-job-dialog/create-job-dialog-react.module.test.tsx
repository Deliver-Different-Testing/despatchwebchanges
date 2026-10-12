/**
 * Create job Dialog React Module Tests
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

// Use require() instead of import to load the module after the mocks are installed
let openCreateJobDialog: typeof import('./create-job-dialog-react.module').openCreateJobDialog;

beforeAll(() => {
    openCreateJobDialog = require('./create-job-dialog-react.module').openCreateJobDialog;
});

describe('CreateJobDialogReactModule', () => {
    beforeEach(() => {
        mockRender.mockClear();
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
