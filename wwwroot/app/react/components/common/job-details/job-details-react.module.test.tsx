
const mockRender = jest.fn();
const mockUnmount = jest.fn();
const mockInvalidateQueries = jest.fn(() => Promise.resolve());

jest.mock('react-dom/client', () => ({
    createRoot: jest.fn(() => ({
        render: mockRender,
        unmount: mockUnmount,
    })),
}));


jest.mock('../../../query', () => ({
    ReactQueryProvider: ({children}: any) => children,
}));

jest.mock('../../../query/queryClient', () => ({
    queryClient: {
        invalidateQueries: mockInvalidateQueries,
    },
}));

let mountJobDetails: typeof import('./job-details-react.module').mountJobDetails;
let unmountJobDetails: typeof import('./job-details-react.module').unmountJobDetails;
let refreshJobDetails: typeof import('./job-details-react.module').refreshJobDetails;

beforeAll(() => {
    const angularModule = {service: jest.fn().mockReturnThis(), factory: jest.fn().mockReturnThis()};
    (window as any).angular = {module: jest.fn(() => angularModule)};
    const mod = require('./job-details-react.module');
    mountJobDetails = mod.mountJobDetails;
    unmountJobDetails = mod.unmountJobDetails;
    refreshJobDetails = mod.refreshJobDetails;
});

afterAll(() => {
    delete (window as any).angular;
    delete (window as any).ReactJobDetails;
});

const makeConfig = (jobId: number) => ({
    jobId,
    isRecurringJob: false,
    isBulkJob: false,
    isUsCustomer: false,
    showToast: jest.fn(),
});

describe('job-details-react.module', () => {
    beforeEach(() => {
        mockRender.mockClear();
        mockUnmount.mockClear();
        mockInvalidateQueries.mockClear();
    });

    describe('Window Global Registration', () => {
        it('should expose ReactJobDetails with mount, unmount, and refresh on window', () => {
            const global = (window as any).ReactJobDetails;
            expect(global).toBeDefined();
            expect(typeof global.mount).toBe('function');
            expect(typeof global.unmount).toBe('function');
            expect(typeof global.refresh).toBe('function');
        });
    });

    describe('refreshJobDetails', () => {
        it('should not invalidate queries when module has not been mounted', async () => {
            unmountJobDetails();

            await refreshJobDetails();

            expect(mockInvalidateQueries).not.toHaveBeenCalled();
        });

        it('should invalidate photos and priceBreakdowns and re-render with incremented nonce', async () => {
            const container = document.createElement('div');
            container.id = 'test-refresh';
            document.body.appendChild(container);

            mountJobDetails('test-refresh', makeConfig(1));
            mockInvalidateQueries.mockClear();
            mockRender.mockClear();

            await refreshJobDetails();

            // jobs/detail and notes are handled inside JobDetails via the nonce effect
            expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
            expect(mockInvalidateQueries).toHaveBeenCalledWith({queryKey: ['jobs', 'photos']});
            expect(mockInvalidateQueries).toHaveBeenCalledWith({queryKey: ['priceBreakdowns']});
            // Component re-rendered with incremented nonce so JobDetails triggers refetch()
            expect(mockRender).toHaveBeenCalledTimes(1);

            document.body.removeChild(container);
        });

        it('should not invalidate queries after unmount', async () => {
            const container = document.createElement('div');
            container.id = 'test-refresh-unmount';
            document.body.appendChild(container);

            mountJobDetails('test-refresh-unmount', makeConfig(2));
            unmountJobDetails();
            mockInvalidateQueries.mockClear();

            await refreshJobDetails();

            expect(mockInvalidateQueries).not.toHaveBeenCalled();

            document.body.removeChild(container);
        });

        it('should await both invalidations in parallel', async () => {
            const container = document.createElement('div');
            container.id = 'test-refresh-parallel';
            document.body.appendChild(container);

            mountJobDetails('test-refresh-parallel', makeConfig(3));
            mockInvalidateQueries.mockClear();

            const resolvers: Array<() => void> = [];
            mockInvalidateQueries.mockImplementation(
                () => new Promise<void>((resolve) => resolvers.push(resolve)),
            );

            const refreshPromise = refreshJobDetails();

            // Both calls made immediately (parallel), but promise not yet resolved
            expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
            expect(resolvers).toHaveLength(2);

            // Resolve all
            resolvers.forEach((r) => r());
            await refreshPromise;

            document.body.removeChild(container);
        });

        it('should return a promise', () => {
            expect(refreshJobDetails()).toBeInstanceOf(Promise);
        });
    });
});

export {};
