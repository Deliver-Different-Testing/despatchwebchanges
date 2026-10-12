/**
 * Compose email Dialog React Module Tests
 *
 * Tests for the module's openComposeEmailDialog() function and
 * window global registration.
 */

// Mock React DOM to prevent actual rendering
const mockRender = jest.fn();
const mockCreateRoot = jest.fn(() => ({
    render: mockRender,
    unmount: jest.fn(),
}));
jest.mock('react-dom/client', () => ({
    createRoot: mockCreateRoot,
}));

// Mock the provider stack — this test is about the module's mount/open plumbing,
// not the theme.
jest.mock('../../../theme/DfrntMantineProvider', () => ({
    DfrntMantineProvider: ({children}: {children: React.ReactNode}) => children,
    islandTree: (node: React.ReactNode) => node,
}));

// Use require() instead of import to load the module after the mocks are installed
let openComposeEmailDialog: typeof import('./compose-email-dialog-react.module').openComposeEmailDialog;

beforeAll(() => {
    openComposeEmailDialog = require('./compose-email-dialog-react.module').openComposeEmailDialog;
});

describe('ComposeEmailDialogModule', () => {
    const createMockCouriers = () => [
        {courierId: 1, code: 'C01', name: 'Alice', email: 'a@test.com', phone: '111', fleet: 'Alpha'},
        {courierId: 2, code: 'C02', name: 'Bob', email: 'b@test.com', phone: '222', fleet: 'Beta'},
    ];

    describe('openComposeEmailDialog', () => {
        it('should create a React root and render when called', async () => {
            // Don't await — the promise only resolves when dialog closes, which never happens in mocks
            void openComposeEmailDialog(createMockCouriers());

            // Flush microtask queue for synchronous code
            await Promise.resolve();

            expect(mockCreateRoot).toHaveBeenCalled();
            expect(mockRender).toHaveBeenCalled();
        });

        it('should return a promise', () => {
            const result = openComposeEmailDialog(createMockCouriers());

            expect(result).toBeInstanceOf(Promise);
        });
    });

});

export {};
