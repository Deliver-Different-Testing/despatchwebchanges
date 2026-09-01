import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {createTestQueryClient} from '../../../__testUtils__';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {DriverEmailsTab} from './DriverEmailsTab';
import {DriverEmail, PaginatedResponse} from '../../../interfaces';
import {useDriverEmails, useSendEmailToCouriers} from '../../../hooks/useDriverManagementApi';

// Mock the hooks
jest.mock('../../../hooks/useDriverManagementApi', () => ({
    useDriverEmails: jest.fn(),
    useSendEmailToCouriers: jest.fn(),
}));

// Mock the API
jest.mock('../../../services/driverManagementApi', () => ({
    driverManagementApi: {
        exportDriverEmailsCsv: jest.fn(),
    },
}));

const mockUseDriverEmails = useDriverEmails as jest.MockedFunction<typeof useDriverEmails>;
const mockUseSendEmailToCouriers = useSendEmailToCouriers as jest.MockedFunction<typeof useSendEmailToCouriers>;


const renderWithProviders = (showToast = jest.fn()) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <DriverEmailsTab showToast={showToast}/>
            </MantineTestProvider>
        </QueryClientProvider>
    );
};

const createMockData = (): PaginatedResponse<DriverEmail> => ({
    items: [
        {courierId: 1, code: 'C01', name: 'Alice Zara', email: 'a@test.com', phone: '111', fleet: 'Alpha'},
        {courierId: 2, code: 'A02', name: 'Bob Young', email: 'b@test.com', phone: '222', fleet: 'Beta'},
    ],
    total: 2,
    page: 1,
    pages: 1,
});

const setupMocks = (data?: PaginatedResponse<DriverEmail>, isLoading = false) => {
    mockUseDriverEmails.mockReturnValue({
        data: data ?? createMockData(),
        isLoading,
        isError: false,
        error: null,
        refetch: jest.fn(),
    } as any);

    mockUseSendEmailToCouriers.mockReturnValue({
        mutateAsync: jest.fn(),
        isPending: false,
    } as any);
};

describe('DriverEmailsTab', () => {
    describe('Column headers', () => {
        it('should render all column headers', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('Code')).toBeInTheDocument();
            expect(screen.getByText('Name')).toBeInTheDocument();
            expect(screen.getByText('Email')).toBeInTheDocument();
            expect(screen.getByText('Phone')).toBeInTheDocument();
            expect(screen.getByText('Fleet')).toBeInTheDocument();
            expect(screen.getByText('Actions')).toBeInTheDocument();
        });
    });

    describe('Sort clicks', () => {
        it('should set orderBy to code when Code header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            // Initial state is code/asc, clicking again toggles to desc
            fireEvent.click(screen.getByText('Code'));

            await waitFor(() => {
                const lastCall = mockUseDriverEmails.mock.calls[mockUseDriverEmails.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('code');
                expect(lastCall[0].sortDescending).toBe(true);
            });
        });

        it('should set orderBy to name when Name header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Name'));

            await waitFor(() => {
                const lastCall = mockUseDriverEmails.mock.calls[mockUseDriverEmails.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('name');
            });
        });

        it('should set orderBy to email when Email header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Email'));

            await waitFor(() => {
                const lastCall = mockUseDriverEmails.mock.calls[mockUseDriverEmails.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('email');
            });
        });

        it('should set orderBy to phone when Phone header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Phone'));

            await waitFor(() => {
                const lastCall = mockUseDriverEmails.mock.calls[mockUseDriverEmails.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('phone');
            });
        });

        it('should set orderBy to fleet when Fleet header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Fleet', {selector: 'span'}));

            await waitFor(() => {
                const lastCall = mockUseDriverEmails.mock.calls[mockUseDriverEmails.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('fleet');
            });
        });

        it('should not trigger sort when Actions header is clicked', () => {
            setupMocks();
            renderWithProviders();

            const callCountBefore = mockUseDriverEmails.mock.calls.length;
            fireEvent.click(screen.getByText('Actions'));

            // No re-render triggered for sort change
            const lastCallBefore = mockUseDriverEmails.mock.calls[callCountBefore - 1];
            const lastCallAfter = mockUseDriverEmails.mock.calls[mockUseDriverEmails.mock.calls.length - 1];
            expect(lastCallAfter[0].orderBy).toBe(lastCallBefore[0].orderBy);
        });
    });

    describe('Direction toggle', () => {
        it('should toggle direction: first click asc, second click desc, third click asc', async () => {
            setupMocks();
            renderWithProviders();

            // Click Name (starts not active, so first click → asc)
            fireEvent.click(screen.getByText('Name'));

            await waitFor(() => {
                const lastCall = mockUseDriverEmails.mock.calls[mockUseDriverEmails.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('name');
                expect(lastCall[0].sortDescending).toBe(false);
            });

            // Second click → desc
            fireEvent.click(screen.getByText('Name'));

            await waitFor(() => {
                const lastCall = mockUseDriverEmails.mock.calls[mockUseDriverEmails.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('name');
                expect(lastCall[0].sortDescending).toBe(true);
            });

            // Third click → asc
            fireEvent.click(screen.getByText('Name'));

            await waitFor(() => {
                const lastCall = mockUseDriverEmails.mock.calls[mockUseDriverEmails.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('name');
                expect(lastCall[0].sortDescending).toBe(false);
            });
        });
    });

    describe('Query state', () => {
        it('should reset page to 1 when sort changes', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Name'));

            await waitFor(() => {
                const lastCall = mockUseDriverEmails.mock.calls[mockUseDriverEmails.mock.calls.length - 1];
                expect(lastCall[0].page).toBe(1);
            });
        });

        it('should pass sortDescending correctly', async () => {
            setupMocks();
            renderWithProviders();

            // Code is default active column, clicking toggles to desc
            fireEvent.click(screen.getByText('Code'));

            await waitFor(() => {
                const lastCall = mockUseDriverEmails.mock.calls[mockUseDriverEmails.mock.calls.length - 1];
                expect(lastCall[0].sortDescending).toBe(true);
            });
        });
    });

    describe('Initial state', () => {
        it('should have code as the default sort column with asc direction', () => {
            setupMocks();
            renderWithProviders();

            const firstCall = mockUseDriverEmails.mock.calls[0];
            expect(firstCall[0].orderBy).toBe('code');
            expect(firstCall[0].sortDescending).toBe(false);
        });
    });

    describe('Loading state', () => {
        it('should show loading indicator when isLoading is true', () => {
            setupMocks(undefined, true);
            renderWithProviders();

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });

    describe('Empty state', () => {
        it('should show empty message when no items', () => {
            setupMocks({items: [], total: 0, page: 1, pages: 0});
            renderWithProviders();

            expect(screen.getByText('No Driver Emails')).toBeInTheDocument();
            expect(screen.getByText('No driver emails match your criteria.')).toBeInTheDocument();
        });
    });
});
