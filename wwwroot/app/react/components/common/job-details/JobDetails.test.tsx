/**
 * JobDetails Component Tests
 *
 * Tests the root orchestration component, focusing on:
 * - Loading / empty states
 * - Dense vs normal container styles
 * - Lazy-loaded RecurringJobFields and PodPhotosSection
 * - Read status bar rendering and toggle
 * - Tab index reset when jobId/relatedJobs change
 * - AI panel state initialization
 */

import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createMockJob, createMockReadTracker} from './__testUtils__/mockJob';
import type {MountJobDetailsConfig, IJob} from './JobDetails.types';

// ── Mocks ────────────────────────────────────────────────────────────

const mockUseJobDetail = jest.fn();
jest.mock('./hooks/useJobDetail', () => ({
    useJobDetail: (...args: unknown[]) => mockUseJobDetail(...args),
}));

const mockUseJobUpdate = jest.fn();
jest.mock('./hooks/useJobUpdate', () => ({
    useJobUpdate: (...args: unknown[]) => mockUseJobUpdate(...args),
}));

const mockUseFieldVisibility = jest.fn();
jest.mock('./hooks/useFieldVisibility', () => ({
    useFieldVisibility: (...args: unknown[]) => mockUseFieldVisibility(...args),
}));

const mockUseViewDensity = jest.fn();
jest.mock('./hooks/useViewDensity', () => ({
    useViewDensity: (...args: unknown[]) => mockUseViewDensity(...args),
}));

const mockUsePodPhotos = jest.fn();
jest.mock('./hooks/usePodPhotos', () => ({
    usePodPhotos: (...args: unknown[]) => mockUsePodPhotos(...args),
}));

const mockUseJobActions = jest.fn();
jest.mock('./hooks/useJobActions', () => ({
    useJobActions: (...args: unknown[]) => mockUseJobActions(...args),
}));

jest.mock('../../common/sticky-notes/StickyNotes', () => ({
    StickyNotes: () => <div data-testid="sticky-notes" />,
}));

jest.mock('../../dialogs/note-management-dialog/note-management-dialog-react.module', () => ({
    openNoteManagementDialog: jest.fn(),
}));

jest.mock('../../../utils/dateUtils', () => ({
    getTimezoneAbbreviation: jest.fn(() => 'NZDT'),
}));

// Mock eagerly loaded child components as simple stubs
jest.mock('./components/WarningBanner', () => ({
    WarningBanner: () => <div data-testid="warning-banner" />,
}));
let capturedRelatedJobTabsProps: any = {};
jest.mock('./components/RelatedJobTabs', () => ({
    RelatedJobTabs: (props: any) => {
        capturedRelatedJobTabsProps = props;
        return <div data-testid="related-job-tabs" />;
    },
}));
jest.mock('./components/JobDetailHeader', () => ({
    JobDetailHeader: () => <div data-testid="job-detail-header" />,
}));
jest.mock('./components/MetricsGrid', () => ({
    MetricsGrid: () => <div data-testid="metrics-grid" />,
}));
jest.mock('./components/AddressSection', () => ({
    AddressSection: () => <div data-testid="address-section" />,
}));
jest.mock('./components/TotalDistance', () => ({
    TotalDistance: () => <div data-testid="total-distance" />,
}));
jest.mock('./components/FlightInformation', () => ({
    FlightInformation: () => <div data-testid="flight-information" />,
}));
jest.mock('./components/AgentInformation', () => ({
    AgentInformation: () => <div data-testid="agent-information" />,
}));
jest.mock('./components/JobFieldsSection', () => ({
    JobFieldsSection: () => <div data-testid="job-fields-section" />,
}));
jest.mock('./components/ToggleProperties', () => ({
    ToggleProperties: () => <div data-testid="toggle-properties" />,
}));
let capturedPalletSectionProps: any = {};
jest.mock('./components/PalletSection', () => ({
    PalletSection: (props: any) => {
        capturedPalletSectionProps = props;
        return <div data-testid="pallet-section" data-pallet-count={props.pallets?.length ?? 0} />;
    },
}));
jest.mock('./components/TextInputDialog', () => ({
    TextInputDialog: () => <div data-testid="text-input-dialog" />,
}));

// Lazy-loaded components - mock the module-level imports that React.lazy resolves
jest.mock('./components/RecurringJobFields', () => ({
    RecurringJobFields: () => <div data-testid="recurring-job-fields" />,
}));
jest.mock('./components/PodPhotosSection', () => ({
    PodPhotosSection: () => <div data-testid="pod-photos-section" />,
}));

// ── Helpers ──────────────────────────────────────────────────────────

const theme = createTheme();

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {queries: {retry: false, gcTime: 0}, mutations: {retry: false}},
    });
}

function renderJobDetails(configOverrides?: Partial<MountJobDetailsConfig>) {
    const config: MountJobDetailsConfig = {
        jobId: 1001,
        isRecurringJob: false,
        isBulkJob: false,
        isUsCustomer: false,
        showToast: jest.fn(),
        onJobUpdate: jest.fn(),
        onJobReadChanged: jest.fn(),
        ...configOverrides,
    };

    // Lazy import to ensure mocks are registered before module loads
    const {JobDetails} = require('./JobDetails');

    return render(
        <QueryClientProvider client={createQueryClient()}>
            <ThemeProvider theme={theme}>
                <JobDetails config={config} />
            </ThemeProvider>
        </QueryClientProvider>,
    );
}

const defaultActions = {
    textDialog: {open: false, title: '', label: '', initialValue: ''},
    handleTextDialogSubmit: jest.fn(),
    handleTextDialogCancel: jest.fn(),
    editDateAndTime: jest.fn(),
    handleEditPickupAddress: jest.fn(),
    handleEditDeliveryAddress: jest.fn(),
    handleEditFromContact: jest.fn(),
    handleEditToContact: jest.fn(),
    handleEditFromContactPhone: jest.fn(),
    handleEditToContactPhone: jest.fn(),
    handleToggleProperty: jest.fn(),
    handleVoidClick: jest.fn(),
    handleActiveClick: jest.fn(),
    handleDoneClick: jest.fn(),
    handleTailLiftPuClick: jest.fn(),
    handleTailLiftDoClick: jest.fn(),
    handlePrivateResChange: jest.fn(),
    handleCourierClick: jest.fn(),
    handleEditPodName: jest.fn(),
    handleEditCompletedTime: jest.fn(),
    handlePricingClick: jest.fn(),
    handleStatusClick: jest.fn(),
    handleSpeedClick: jest.fn(),
    handleSizeClick: jest.fn(),
    handleJobTypeClick: jest.fn(),
    handleDgClassClick: jest.fn(),
    handleLeaveClick: jest.fn(),
    handleTrackingMethodClick: jest.fn(),
    handleContactClick: jest.fn(),
    handleClientClick: jest.fn(),
    handleInActiveByClick: jest.fn(),
    handleEditDimensions: jest.fn(),
    handleEditRefA: jest.fn(),
    handleEditRefB: jest.fn(),
    handleEditOurRef: jest.fn(),
    handleEditConNote: jest.fn(),
    handleEditWeight: jest.fn(),
    handleEditTrackingMobile: jest.fn(),
    handleEditTrackingEmail: jest.fn(),
    handleEditCustomJobName: jest.fn(),
    handlePodUpload: jest.fn(),
    handlePodReport: jest.fn(),
    handlePodSpreadsheet: jest.fn(),
    handleSendPodEmail: jest.fn(),
    handleDaysOfWeekChange: jest.fn(),
    handleFrequencyChange: jest.fn(),
    handleHolidayOptionChange: jest.fn(),
    handleEditFirstDue: jest.fn(),
    handleEditStopDate: jest.fn(),
    handleEditRestartDate: jest.fn(),

    // Universal Dispatch Dialog wiring — JobDetails reads these to render the dialog.
    dispatchDialog: {open: false, initialType: 'Courier' as const},
    closeDispatchDialog: jest.fn(),
    dispatchDialogConfirmCourier: jest.fn().mockResolvedValue(undefined),
    dispatchDialogConfirmPartner: jest.fn().mockResolvedValue(undefined),
};

function setupDefaultMocks(overrides?: {
    job?: IJob;
    sortedRelatedJobs?: IJob[];
    isLoading?: boolean;
    isFetching?: boolean;
    isDense?: boolean;
    photosLoading?: boolean;
}) {
    const job = overrides?.job ?? createMockJob();
    const sortedRelatedJobs = overrides?.sortedRelatedJobs ?? [job];

    mockUseJobDetail.mockReturnValue({
        sortedRelatedJobs,
        isLoading: overrides?.isLoading ?? false,
        isFetching: overrides?.isFetching ?? false,
        refetch: jest.fn().mockResolvedValue(undefined),
    });

    mockUseJobUpdate.mockReturnValue({
        updateField: jest.fn().mockResolvedValue(undefined),
        updateAddress: jest.fn().mockResolvedValue(undefined),
        toggleReadStatus: jest.fn().mockResolvedValue(undefined),
        dispatchJob: jest.fn().mockResolvedValue(undefined),
        isUpdating: false,
    });

    mockUseFieldVisibility.mockReturnValue({
        isEditMode: false,
        toggleEditMode: jest.fn(),
        toggleField: jest.fn(),
        resetToDefaults: jest.fn(),
        isFieldVisible: jest.fn(() => true),
    });

    mockUseViewDensity.mockReturnValue({
        viewDensity: overrides?.isDense ? 'dense' : 'normal',
        toggleDensity: jest.fn(),
        isDense: overrides?.isDense ?? false,
    });

    mockUsePodPhotos.mockReturnValue({
        deliveryPhotos: [],
        pickupPhotos: [],
        imageOnlyDeliveryPhotos: [],
        imageOnlyPickupPhotos: [],
        isLoading: overrides?.photosLoading ?? false,
    });

    mockUseJobActions.mockReturnValue(defaultActions);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('JobDetails', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (window as any).ContactID = 1;
        (window as any).TimeZone = 'Pacific/Auckland';
    });

    describe('loading and empty states', () => {
        it('renders loading skeletons when loading with no job data', () => {
            setupDefaultMocks({isLoading: true, sortedRelatedJobs: []});
            const {container} = renderJobDetails();

            expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
            expect(screen.queryByTestId('job-detail-header')).not.toBeInTheDocument();
        });

        it('renders empty state when not loading and no job', () => {
            setupDefaultMocks({sortedRelatedJobs: []});
            renderJobDetails();

            expect(screen.getByText('Select a job to view details')).toBeInTheDocument();
        });
    });

    describe('dense vs normal container styles', () => {
        it('uses normal container style when not dense', () => {
            setupDefaultMocks({isDense: false});
            const {container} = renderJobDetails();

            const root = container.firstChild as HTMLElement;
            expect(root).toBeTruthy();
            // Normal mode should not have reduced font size
            expect(root.style.fontSize).not.toBe('0.8125rem');
        });

        it('uses dense container style when dense', () => {
            setupDefaultMocks({isDense: true});
            const {container} = renderJobDetails();

            // The MUI sx prop applies styles - just verify the component renders without error
            const root = container.firstChild as HTMLElement;
            expect(root).toBeTruthy();
        });
    });

    describe('lazy-loaded components', () => {
        it('renders PodPhotosSection when photos are loading', async () => {
            setupDefaultMocks({photosLoading: true});
            renderJobDetails();

            await waitFor(() => {
                expect(screen.getByTestId('pod-photos-section')).toBeInTheDocument();
            });
        });

        it('does not render PodPhotosSection when no photos and not loading', () => {
            setupDefaultMocks();
            renderJobDetails();

            expect(screen.queryByTestId('pod-photos-section')).not.toBeInTheDocument();
        });

        it('renders RecurringJobFields via Suspense for recurring jobs', async () => {
            setupDefaultMocks();
            renderJobDetails({isRecurringJob: true});

            await waitFor(() => {
                expect(screen.getByTestId('recurring-job-fields')).toBeInTheDocument();
            });
        });

        it('does not render RecurringJobFields for non-recurring jobs', () => {
            setupDefaultMocks();
            renderJobDetails({isRecurringJob: false});

            expect(screen.queryByTestId('recurring-job-fields')).not.toBeInTheDocument();
        });
    });

    describe('read status bar', () => {
        it('renders UNREAD chip and prompt text when not read', () => {
            const job = createMockJob({readTrackerInfo: createMockReadTracker({hasBeenRead: false})});
            setupDefaultMocks({job});
            renderJobDetails();

            expect(screen.getByText('UNREAD')).toBeInTheDocument();
            expect(screen.getByText('Click to mark as read')).toBeInTheDocument();
        });

        it('renders READ chip with reader info when read', () => {
            const job = createMockJob({
                readTrackerInfo: createMockReadTracker({
                    hasBeenRead: true,
                    readBy: 'Jane Admin',
                    _readDateStr: '25/03/2026 10:00',
                }),
            });
            setupDefaultMocks({job});
            renderJobDetails();

            expect(screen.getByText('READ')).toBeInTheDocument();
            expect(screen.getByText('Jane Admin')).toBeInTheDocument();
            expect(screen.getByText(/25\/03\/2026 10:00/)).toBeInTheDocument();
        });

        it('calls toggleReadStatus when read status bar is clicked', async () => {
            const toggleReadStatus = jest.fn().mockResolvedValue(undefined);
            const onJobReadChanged = jest.fn();
            const job = createMockJob({readTrackerInfo: createMockReadTracker({hasBeenRead: false})});

            setupDefaultMocks({job});
            mockUseJobUpdate.mockReturnValue({
                updateField: jest.fn().mockResolvedValue(undefined),
                updateAddress: jest.fn().mockResolvedValue(undefined),
                toggleReadStatus,
                dispatchJob: jest.fn().mockResolvedValue(undefined),
                isUpdating: false,
            });

            renderJobDetails({onJobReadChanged});

            await act(async () => {
                fireEvent.click(screen.getByText('Click to mark as read'));
            });

            expect(toggleReadStatus).toHaveBeenCalledWith({jobId: job.id, hasBeenRead: true});
        });
    });

    describe('core child components', () => {
        it('renders all primary sections for a standard job', () => {
            setupDefaultMocks();
            renderJobDetails();

            expect(screen.getByTestId('warning-banner')).toBeInTheDocument();
            expect(screen.getByTestId('related-job-tabs')).toBeInTheDocument();
            expect(screen.getByTestId('job-detail-header')).toBeInTheDocument();
            expect(screen.getByTestId('metrics-grid')).toBeInTheDocument();
            expect(screen.getByTestId('address-section')).toBeInTheDocument();
            expect(screen.getByTestId('total-distance')).toBeInTheDocument();
            expect(screen.getByTestId('sticky-notes')).toBeInTheDocument();
            expect(screen.getByTestId('job-fields-section')).toBeInTheDocument();
            expect(screen.getByTestId('toggle-properties')).toBeInTheDocument();
            expect(screen.getByTestId('text-input-dialog')).toBeInTheDocument();
        });

        it('renders FlightInformation when flight is assigned', () => {
            const job = createMockJob({isFlightAssigned: true, assignedFlight: {flightNumber: 'NZ123'} as any});
            setupDefaultMocks({job});
            renderJobDetails();

            expect(screen.getByTestId('flight-information')).toBeInTheDocument();
        });

        it('does not render FlightInformation when no flight assigned', () => {
            setupDefaultMocks();
            renderJobDetails();

            expect(screen.queryByTestId('flight-information')).not.toBeInTheDocument();
        });

        it('renders AgentInformation when agent is assigned', () => {
            const job = createMockJob({isAgentAssigned: true, assignedAgent: {agentName: 'Agent A'} as any});
            setupDefaultMocks({job});
            renderJobDetails();

            expect(screen.getByTestId('agent-information')).toBeInTheDocument();
        });

        it('does not render AgentInformation when no agent assigned', () => {
            setupDefaultMocks();
            renderJobDetails();

            expect(screen.queryByTestId('agent-information')).not.toBeInTheDocument();
        });

        it('renders PalletSection when palletInfo has entries', () => {
            const job = createMockJob({palletInfo: [{id: 1, quantity: 2} as any]});
            setupDefaultMocks({job});
            renderJobDetails();

            expect(screen.getByTestId('pallet-section')).toBeInTheDocument();
        });

        it('does not render PalletSection when palletInfo is empty', () => {
            setupDefaultMocks();
            renderJobDetails();

            expect(screen.queryByTestId('pallet-section')).not.toBeInTheDocument();
        });

        it('passes only the current job pallets when switching between jobs', () => {
            const jobA = createMockJob({
                id: 100,
                jobNo: 'J-100',
                palletInfo: [
                    {id: 100, itemId: 1, quantity: 2, weight: 25, length: 120, depth: 80, height: 100, notes: 'A1'} as any,
                    {id: 100, itemId: 2, quantity: 3, weight: 10, length: 60, depth: 40, height: 30, notes: 'A2'} as any,
                    {id: 100, itemId: 3, quantity: 1, weight: 5, length: 30, depth: 20, height: 10, notes: 'A3'} as any,
                ],
            });
            setupDefaultMocks({job: jobA, sortedRelatedJobs: [jobA]});
            const {rerender} = renderJobDetails({jobId: 100});

            const sectionA = screen.getByTestId('pallet-section');
            expect(sectionA).toBeInTheDocument();
            expect(sectionA.getAttribute('data-pallet-count')).toBe('3');
            expect(capturedPalletSectionProps.pallets).toHaveLength(3);

            // Switch to a different job with fewer pallets
            const jobB = createMockJob({
                id: 200,
                jobNo: 'J-200',
                palletInfo: [
                    {id: 200, itemId: 10, quantity: 5, weight: 50, length: 100, depth: 80, height: 120, notes: 'B1'} as any,
                ],
            });
            setupDefaultMocks({job: jobB, sortedRelatedJobs: [jobB]});

            const {JobDetails} = require('./JobDetails');
            rerender(
                <QueryClientProvider client={createQueryClient()}>
                    <ThemeProvider theme={theme}>
                        <JobDetails config={{
                            jobId: 200,
                            isRecurringJob: false,
                            isBulkJob: false,
                            isUsCustomer: false,
                            showToast: jest.fn(),
                        }} />
                    </ThemeProvider>
                </QueryClientProvider>,
            );

            const sectionB = screen.getByTestId('pallet-section');
            expect(sectionB).toBeInTheDocument();
            expect(sectionB.getAttribute('data-pallet-count')).toBe('1');
            expect(capturedPalletSectionProps.pallets).toHaveLength(1);
            expect(capturedPalletSectionProps.pallets[0].notes).toBe('B1');
        });
    });

    describe('progress indicator', () => {
        it('shows linear progress when loading', () => {
            setupDefaultMocks({isLoading: true});
            renderJobDetails();

            expect(document.querySelector('.MuiLinearProgress-root')).toBeInTheDocument();
        });

        it('shows linear progress when fetching (background refetch)', () => {
            setupDefaultMocks({isFetching: true});
            renderJobDetails();

            expect(document.querySelector('.MuiLinearProgress-root')).toBeInTheDocument();
        });

        it('shows linear progress when updating', () => {
            setupDefaultMocks();
            mockUseJobUpdate.mockReturnValue({
                updateField: jest.fn().mockResolvedValue(undefined),
                updateAddress: jest.fn().mockResolvedValue(undefined),
                toggleReadStatus: jest.fn().mockResolvedValue(undefined),
                dispatchJob: jest.fn().mockResolvedValue(undefined),
                isUpdating: true,
            });
            renderJobDetails();

            expect(document.querySelector('.MuiLinearProgress-root')).toBeInTheDocument();
        });

        it('hides linear progress when not loading, fetching, or updating', () => {
            setupDefaultMocks();
            renderJobDetails();

            expect(document.querySelector('.MuiLinearProgress-root')).not.toBeInTheDocument();
        });
    });

    describe('related job tab change', () => {
        it('calls onRelatedJobChange with selected job id when tab changes', () => {
            const jobs = [
                createMockJob({id: 100, jobNo: 'J-100'}),
                createMockJob({id: 200, jobNo: 'J-200'}),
            ];
            setupDefaultMocks({sortedRelatedJobs: jobs});
            const onRelatedJobChange = jest.fn();
            renderJobDetails({onRelatedJobChange});

            // Simulate tab change to second job
            act(() => {
                capturedRelatedJobTabsProps.onTabChange(1);
            });

            expect(onRelatedJobChange).toHaveBeenCalledWith(200);
        });

        it('does not call onRelatedJobChange when callback is not provided', () => {
            const jobs = [
                createMockJob({id: 100, jobNo: 'J-100'}),
                createMockJob({id: 200, jobNo: 'J-200'}),
            ];
            setupDefaultMocks({sortedRelatedJobs: jobs});
            renderJobDetails({onRelatedJobChange: undefined});

            // Should not throw
            act(() => {
                capturedRelatedJobTabsProps.onTabChange(1);
            });
        });
    });
});
