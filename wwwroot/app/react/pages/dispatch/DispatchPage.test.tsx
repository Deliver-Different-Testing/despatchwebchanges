/** @jest-environment jest-environment-jsdom */
import React from 'react';
import {act, render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {DispatchPage} from './DispatchPage';
import {DispatchBox} from './DispatchPage.interfaces';
import {createTestQueryClient} from '../../__testUtils__';
import dayjs from 'dayjs';
import type {DispatchJob} from '../../interfaces/dispatchJob';
import type {TruckMode} from '../../components/common/driver-locations/DriverLocations.types';

// ── Hook mocks ──────────────────────────────────────────────────────────

jest.mock('./hooks/useDispatchLayout');
jest.mock('./hooks/useJobSelection');
jest.mock('./hooks/useCurrentWork');
jest.mock('./hooks/useSupportTasks');
jest.mock('./hooks/usePageViews');
jest.mock('./hooks/useDateFilter');
jest.mock('./hooks/useMessaging');
jest.mock('./hooks/useAutoRefresh');
jest.mock('./hooks/useDriverLocations');

import {useDispatchLayout} from './hooks/useDispatchLayout';
import {useJobSelection} from './hooks/useJobSelection';
import {useCurrentWork} from './hooks/useCurrentWork';
import {useSupportTasks} from './hooks/useSupportTasks';
import {usePageViews} from './hooks/usePageViews';
import {useDateFilter} from './hooks/useDateFilter';
import {useMessaging} from './hooks/useMessaging';
import {useAutoRefresh} from './hooks/useAutoRefresh';
import {useDriverLocations} from './hooks/useDriverLocations';

const mockLayout = useDispatchLayout as jest.MockedFunction<typeof useDispatchLayout>;
const mockJobSelection = useJobSelection as jest.MockedFunction<typeof useJobSelection>;
const mockCurrentWork = useCurrentWork as jest.MockedFunction<typeof useCurrentWork>;
const mockSupportTasks = useSupportTasks as jest.MockedFunction<typeof useSupportTasks>;
const mockPageViews = usePageViews as jest.MockedFunction<typeof usePageViews>;
const mockDateFilter = useDateFilter as jest.MockedFunction<typeof useDateFilter>;
const mockMessaging = useMessaging as jest.MockedFunction<typeof useMessaging>;
const mockAutoRefresh = useAutoRefresh as jest.MockedFunction<typeof useAutoRefresh>;
const mockDriverLocations = useDriverLocations as jest.MockedFunction<typeof useDriverLocations>;

// ── Child component stubs ───────────────────────────────────────────────

jest.mock('../../components/common/app-shell/AppShell', () => ({
    AppShell: ({children, title}: any) => (
        <div data-testid="app-shell" data-title={title}>
            <span>{title}</span>
            {children}
        </div>
    ),
}));

jest.mock('../../components/common/app-toolbar/ToolbarActions', () => ({
    ActionsMenu: (_props: any) => <div data-testid="actions-menu">ActionsMenu</div>,
    MessagesButton: (props: any) => (
        <div data-testid="messages-button" data-unread={props.unreadCount}>
            MessagesButton
        </div>
    ),
    DateFilterMenu: (_props: any) => <div data-testid="date-filter-menu">DateFilterMenu</div>,
    ViewsMenu: (_props: any) => <div data-testid="views-menu">ViewsMenu</div>,
    LayoutsMenu: (props: any) => (
        <div data-testid="layouts-menu">
            <button data-testid="save-layout-btn" onClick={props.onSaveLayout}>SaveLayout</button>
            LayoutsMenu
        </div>
    ),
    SettingsButton: (_props: any) => <div data-testid="settings-button">SettingsButton</div>,
}));

// DashboardGrid mock: reads widgets, toolbarActions, subtitles maps, exposes onRefresh
jest.mock('./components/DashboardGrid', () => ({
    DashboardGrid: (props: any) => (
        <div data-testid="dashboard-grid">
            {props.visibleBoxIds.map((boxId: string) => (
                <div key={boxId} data-testid={`box-${boxId}`}>
                    <div data-testid={`widget-${boxId}`}>
                        {props.widgets?.[boxId]}
                    </div>
                    <div data-testid={`toolbar-actions-${boxId}`}>
                        {props.toolbarActions?.[boxId]}
                    </div>
                    <div data-testid={`subtitle-${boxId}`}>
                        {props.subtitles?.[boxId] ?? ''}
                    </div>
                    <button
                        data-testid={`refresh-${boxId}`}
                        onClick={() => props.onRefresh?.(boxId)}
                    >
                        Refresh
                    </button>
                </div>
            ))}
        </div>
    ),
}));

// Track props passed to JobListPanel so filter integration tests can inspect fetchConfig
let lastJobListPanelProps: any = null;
jest.mock('../../components/common/job-list/JobListPanel', () => ({
    JobListPanel: (props: any) => {
        lastJobListPanelProps = props;
        return (
            <div
                data-testid="job-list-panel"
                data-storage-prefix={props.storagePrefix ?? ''}
                data-default-category={props.defaultCategory ?? ''}
            >
                JobListPanel
            </div>
        );
    },
}));

jest.mock('../../components/common/job-details/JobDetails', () => ({
    JobDetails: (_props: any) => <div data-testid="job-details">JobDetails</div>,
}));

jest.mock('../../components/common/dispatch-map/DispatchMap', () => ({
    DispatchMap: (_props: any) => <div data-testid="dispatch-map">DispatchMap</div>,
}));

jest.mock('../../components/common/driver-locations/DriverLocations', () => ({
    DriverLocations: (_props: any) => <div data-testid="driver-locations-widget">DriverLocations</div>,
}));

jest.mock('../../components/common/current-work-all-drivers/CurrentWorkAllDrivers', () => ({
    CurrentWorkAllDrivers: (_props: any) => (
        <div data-testid="current-work-all-drivers">CurrentWorkAllDrivers</div>
    ),
}));

jest.mock('./components/SupportTasksPanel', () => ({
    SupportTasksPanel: (_props: any) => <div data-testid="support-tasks-panel">SupportTasks</div>,
}));

jest.mock('./components/JobDetailFab', () => ({
    JobDetailFab: (_props: any) => <div data-testid="job-detail-fab">JobDetailFab</div>,
}));

// ── Service mocks ───────────────────────────────────────────────────────

jest.mock('../../services/dispatchApi', () => ({
    getPotentialCouriers: jest.fn(() => Promise.resolve([])),
    getExactCourierMatch: jest.fn(() => Promise.resolve(null)),
    getTruckCourierStatus: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../../services/jobDetailApi', () => ({
    updateJobDetail: jest.fn(() => Promise.resolve({})),
}));

jest.mock('../../services/navigationService', () => ({
    openHubUrl: jest.fn(),
}));

jest.mock('../../services/jobSearchApi', () => ({
    fetchDispatchJobs: jest.fn(() => Promise.resolve({items: [], total: 0})),
    fetchClearListJobs: jest.fn(() => Promise.resolve({items: [], total: 0})),
}));

jest.mock('../../query/queryClient', () => ({
    queryKeys: {
        dispatch: {
            jobs: jest.fn(() => ['dispatch', 'jobs']),
            clearList: jest.fn(() => ['dispatch', 'clearList']),
        },
    },
}));

// Dialog mocks (not deeply tested)
jest.mock('../../components/dialogs/create-job-dialog/create-job-dialog-react.module', () => ({
    openCreateJobDialog: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../components/dialogs/messaging-dialog', () => ({
    openMessagingDialog: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../components/dialogs/dashboard-settings-dialog/dashboard-settings-dialog-react.module', () => ({
    openDashboardSettingsDialog: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../components/dialogs/accessorial-charges-dialog', () => ({
    openAccessorialChargesDialog: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../components/dialogs/add-event-dialog', () => ({
    openAddEventDialog: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../services/splitJobFlow', () => ({
    executeSplitJobFlow: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../services/addStopFlow', () => ({
    executeAddStopFlow: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../components/dialogs/swap-pods-dialog/swap-pods-dialog-react.module', () => ({
    openSwapPodsDialog: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog-react.module', () => ({
    openInterCourierChargeDialog: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../services/angularDialogBridge', () => ({
    openJobFileUploadDialog: jest.fn(() => Promise.resolve()),
}));

import {getPotentialCouriers, getExactCourierMatch, getTruckCourierStatus} from '../../services/dispatchApi';
import {fetchDispatchJobs, fetchClearListJobs} from '../../services/jobSearchApi';
import {queryKeys} from '../../query/queryClient';

const mockGetPotentialCouriers = getPotentialCouriers as jest.MockedFunction<typeof getPotentialCouriers>;
const mockGetExactCourierMatch = getExactCourierMatch as jest.MockedFunction<typeof getExactCourierMatch>;
const mockGetTruckCourierStatus = getTruckCourierStatus as jest.MockedFunction<typeof getTruckCourierStatus>;
const mockFetchDispatchJobs = fetchDispatchJobs as jest.MockedFunction<typeof fetchDispatchJobs>;
const mockFetchClearListJobs = fetchClearListJobs as jest.MockedFunction<typeof fetchClearListJobs>;

// ── Test helpers ────────────────────────────────────────────────────────

const theme = createTheme();

const ALL_BOXES = [
    DispatchBox.JobsList,
    DispatchBox.JobDetail,
    DispatchBox.CurrentWork,
    DispatchBox.Supports,
    DispatchBox.DriverLocations,
    DispatchBox.Map,
];

function defaultLayoutReturn() {
    return {
        rglLayout: [],
        onLayoutChange: jest.fn(),
        boxStates: {},
        layouts: [{name: 'Default', layout: {columns: []}}],
        currentLayoutName: 'Default',
        isDefaultLayout: true,
        loadLayout: jest.fn(),
        saveLayoutAs: jest.fn(),
        deleteLayout: jest.fn(),
        cols: 12,
        visibleBoxIds: ALL_BOXES,
    } as any;
}

function defaultJobSelectionReturn(overrides: any = {}) {
    return {
        currentJobId: null,
        currentJob: null,
        currentSelection: '',
        selectJob: jest.fn(),
        selectJobById: jest.fn(),
        selectJobInListRef: {current: null},
        refreshJobListRef: {current: jest.fn()},
        ...overrides,
    } as any;
}

function defaultCurrentWorkReturn(overrides: any = {}) {
    return {
        drivers: [],
        loading: false,
        viewMode: 'overview' as const,
        selectedCourierId: undefined,
        selectedDriverName: '',
        currentWorkSelection: '',
        driverJobsFetchConfig: null,
        selectDriver: jest.fn(),
        backToOverview: jest.fn(),
        clearDriverSelection: jest.fn(),
        refetch: jest.fn(),
        ...overrides,
    } as any;
}

function defaultSupportTasksReturn(overrides: any = {}) {
    return {
        tasks: [],
        loading: false,
        refetch: jest.fn(),
        staffList: [],
        eventTypeList: [],
        selectedStaffId: undefined,
        selectedEventTypeId: undefined,
        setStaffId: jest.fn(),
        setEventTypeId: jest.fn(),
        closeTask: jest.fn(),
        ...overrides,
    } as any;
}

function defaultPageViewsReturn() {
    return {
        views: [],
        loading: false,
        selectedViewIds: [],
        toggleView: jest.fn(),
        clearAll: jest.fn(),
    } as any;
}

function defaultDateFilterReturn() {
    return {
        dateFilterData: null,
        onRefreshData: jest.fn(),
    } as any;
}

function defaultMessagingReturn() {
    return {
        unreadCount: 0,
        openMessages: jest.fn(),
    } as any;
}

function defaultAutoRefreshReturn() {
    return {
        intervalMs: 0,
        refetchInterval: false as const,
        setIntervalMs: jest.fn(),
    } as any;
}

function defaultDriverLocationsReturn(overrides: any = {}) {
    return {
        driverLocations: undefined,
        loading: false,
        truckMode: 'Off' as TruckMode,
        setTruckMode: jest.fn(),
        activeAreaId: undefined,
        setActiveAreaId: jest.fn(),
        refetch: jest.fn(),
        ...overrides,
    } as any;
}

const defaultProps = {
    showToast: jest.fn() as any,
    isUsCustomer: false,
    initialJobId: null,
    onNavigate: jest.fn(),
};

function setupDefaultMocks(overrides: {
    layout?: any;
    jobSelection?: any;
    currentWork?: any;
    supportTasks?: any;
    pageViews?: any;
    dateFilter?: any;
    messaging?: any;
    driverLocations?: any;
} = {}) {
    mockLayout.mockReturnValue(overrides.layout ?? defaultLayoutReturn());
    mockJobSelection.mockReturnValue(overrides.jobSelection ?? defaultJobSelectionReturn());
    mockCurrentWork.mockReturnValue(overrides.currentWork ?? defaultCurrentWorkReturn());
    mockSupportTasks.mockReturnValue(overrides.supportTasks ?? defaultSupportTasksReturn());
    mockPageViews.mockReturnValue(overrides.pageViews ?? defaultPageViewsReturn());
    mockDateFilter.mockReturnValue(overrides.dateFilter ?? defaultDateFilterReturn());
    mockMessaging.mockReturnValue(overrides.messaging ?? defaultMessagingReturn());
    mockAutoRefresh.mockReturnValue(overrides.driverLocations
        ? defaultAutoRefreshReturn() // doesn't matter, just needs to return something
        : defaultAutoRefreshReturn());
    mockDriverLocations.mockReturnValue(overrides.driverLocations ?? defaultDriverLocationsReturn());
}

function renderDispatchPage(propsOverrides: Partial<typeof defaultProps> = {}) {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <DispatchPage {...defaultProps} {...propsOverrides} />
            </ThemeProvider>
        </QueryClientProvider>,
    );
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('DispatchPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        lastJobListPanelProps = null;
        setupDefaultMocks();
    });

    describe('Basic rendering', () => {
        it('renders AppShell with title and all toolbar actions, plus DashboardGrid with all 6 widgets', () => {
            renderDispatchPage();

            // AppShell with title
            expect(screen.getByTestId('app-shell')).toBeInTheDocument();
            expect(screen.getByText('Dispatch Dashboard')).toBeInTheDocument();

            // All toolbar actions
            expect(screen.getByTestId('actions-menu')).toBeInTheDocument();
            expect(screen.getByTestId('messages-button')).toBeInTheDocument();
            expect(screen.getByTestId('date-filter-menu')).toBeInTheDocument();
            expect(screen.getByTestId('views-menu')).toBeInTheDocument();
            expect(screen.getByTestId('layouts-menu')).toBeInTheDocument();
            expect(screen.getByTestId('settings-button')).toBeInTheDocument();

            // DashboardGrid rendered
            expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();

            // All 6 widget boxes present
            for (const boxId of ALL_BOXES) {
                expect(screen.getByTestId(`box-${boxId}`)).toBeInTheDocument();
            }
        });
    });

    describe('Widget rendering - no job selected', () => {
        it('shows placeholder for JobDetail, overview mode for CurrentWork, and all widget components', () => {
            renderDispatchPage({isUsCustomer: true});

            // JobDetail shows placeholder
            expect(screen.getByText('Select a job to view details')).toBeInTheDocument();
            expect(screen.queryByTestId('job-details')).not.toBeInTheDocument();

            // No JobDetailFab when no job selected
            expect(screen.queryByTestId('job-detail-fab')).not.toBeInTheDocument();

            // CurrentWork in overview mode shows CurrentWorkAllDrivers
            expect(screen.getByTestId('current-work-all-drivers')).toBeInTheDocument();

            // Other widgets rendered
            expect(screen.getByTestId('job-list-panel')).toBeInTheDocument();
            expect(screen.getByTestId('support-tasks-panel')).toBeInTheDocument();
            expect(screen.getByTestId('driver-locations-widget')).toBeInTheDocument();
            expect(screen.getByTestId('dispatch-map')).toBeInTheDocument();
        });
    });

    describe('Widget rendering - job selected (assigned)', () => {
        it('renders JobDetails, JobDetailFab, and selectedDriver JobListPanel when job has courier', () => {
            const assignedJob = {
                id: 42,
                jobNo: 'J042',
                courier: 'John Smith',
                courierData: {courierId: 10, courierName: 'John Smith'},
                statusId: 3,
            } as unknown as DispatchJob;

            setupDefaultMocks({
                jobSelection: defaultJobSelectionReturn({
                    currentJobId: 42,
                    currentJob: assignedJob,
                    currentSelection: ' - Job #J042',
                }),
                currentWork: defaultCurrentWorkReturn({
                    viewMode: 'selectedDriver',
                    selectedCourierId: 10,
                    selectedDriverName: 'John Smith',
                    driverJobsFetchConfig: {fetchFn: jest.fn(), queryKeyFn: jest.fn(), initialParams: {}},
                }),
            });

            renderDispatchPage();

            // JobDetails rendered, placeholder gone
            expect(screen.getByTestId('job-details')).toBeInTheDocument();
            expect(screen.queryByText('Select a job to view details')).not.toBeInTheDocument();

            // JobDetailFab present in toolbar
            expect(screen.getByTestId('job-detail-fab')).toBeInTheDocument();

            // CurrentWork shows JobListPanel (selectedDriver mode) with storagePrefix
            const currentWorkWidget = screen.getByTestId(`widget-${DispatchBox.CurrentWork}`);
            const driverJobList = within(currentWorkWidget).getByTestId('job-list-panel');
            expect(driverJobList).toHaveAttribute('data-storage-prefix', 'currentWorkJobList');
        });
    });

    describe('Effect: assigned job triggers currentWork.selectDriver', () => {
        it('calls selectDriver with courier data when job has an assigned courier', () => {
            const selectDriver = jest.fn();
            const assignedJob = {
                id: 42,
                jobNo: 'J042',
                courier: 'John Smith',
                courierData: {courierId: 10, courierName: 'John Smith'},
                statusId: 3,
            } as unknown as DispatchJob;

            setupDefaultMocks({
                jobSelection: defaultJobSelectionReturn({
                    currentJobId: 42,
                    currentJob: assignedJob,
                }),
                currentWork: defaultCurrentWorkReturn({selectDriver}),
            });

            renderDispatchPage();

            expect(selectDriver).toHaveBeenCalledWith(
                expect.objectContaining({courierId: 10, name: 'John Smith'}),
            );
        });
    });

    describe('Effect: unassigned job fetches potential couriers', () => {
        it('calls getPotentialCouriers when job has no assigned courier', () => {
            const unassignedJob = {
                id: 99,
                jobNo: 'J099',
                courier: null,
                courierData: null,
                statusId: 1,
            } as unknown as DispatchJob;

            setupDefaultMocks({
                jobSelection: defaultJobSelectionReturn({
                    currentJobId: 99,
                    currentJob: unassignedJob,
                }),
            });

            renderDispatchPage();

            expect(mockGetPotentialCouriers).toHaveBeenCalledWith(99);
        });
    });

    describe('Save Layout Dialog', () => {
        beforeEach(() => { jest.useFakeTimers(); });
        afterEach(() => { jest.useRealTimers(); });

        it('opens via LayoutsMenu, disables Save when empty, saves on click, and dialog closes', () => {
            const saveLayoutAs = jest.fn();
            setupDefaultMocks({
                layout: {...defaultLayoutReturn(), saveLayoutAs},
            });

            renderDispatchPage();

            // Dialog not visible initially
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            // Open via LayoutsMenu save button
            fireEvent.click(screen.getByTestId('save-layout-btn'));
            expect(screen.getByText('Save Layout')).toBeInTheDocument();

            // Save button disabled when name is empty
            const saveButton = screen.getByRole('button', {name: 'Save'});
            expect(saveButton).toBeDisabled();

            // Type a name
            const input = screen.getByLabelText('Layout name');
            fireEvent.change(input, {target: {value: 'My Layout'}});
            expect(saveButton).not.toBeDisabled();

            // Click Save
            fireEvent.click(saveButton);
            expect(saveLayoutAs).toHaveBeenCalledWith('My Layout');

            // Flush MUI Dialog exit transition
            act(() => { jest.runAllTimers(); });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('saves on Enter key press in the text field', () => {
            const saveLayoutAs = jest.fn();
            setupDefaultMocks({
                layout: {...defaultLayoutReturn(), saveLayoutAs},
            });

            renderDispatchPage();
            fireEvent.click(screen.getByTestId('save-layout-btn'));

            const input = screen.getByLabelText('Layout name');
            fireEvent.change(input, {target: {value: 'Enter Layout'}});
            fireEvent.keyDown(input, {key: 'Enter'});

            expect(saveLayoutAs).toHaveBeenCalledWith('Enter Layout');
            act(() => { jest.runAllTimers(); });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('closes without saving when Cancel is clicked', () => {
            const saveLayoutAs = jest.fn();
            setupDefaultMocks({
                layout: {...defaultLayoutReturn(), saveLayoutAs},
            });

            renderDispatchPage();
            fireEvent.click(screen.getByTestId('save-layout-btn'));
            expect(screen.getByText('Save Layout')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

            act(() => { jest.runAllTimers(); });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(saveLayoutAs).not.toHaveBeenCalled();
        });
    });

    describe('refreshBox routing', () => {
        it('calls the correct refetch for each box type', () => {
            const refreshJobListRef = {current: jest.fn()};
            const driverLocRefetch = jest.fn();
            const currentWorkRefetch = jest.fn();
            const supportTasksRefetch = jest.fn();

            setupDefaultMocks({
                jobSelection: defaultJobSelectionReturn({refreshJobListRef}),
                driverLocations: defaultDriverLocationsReturn({refetch: driverLocRefetch}),
                currentWork: defaultCurrentWorkReturn({refetch: currentWorkRefetch}),
                supportTasks: defaultSupportTasksReturn({refetch: supportTasksRefetch}),
            });

            renderDispatchPage();

            fireEvent.click(screen.getByTestId(`refresh-${DispatchBox.JobsList}`));
            expect(refreshJobListRef.current).toHaveBeenCalled();

            fireEvent.click(screen.getByTestId(`refresh-${DispatchBox.DriverLocations}`));
            expect(driverLocRefetch).toHaveBeenCalled();

            fireEvent.click(screen.getByTestId(`refresh-${DispatchBox.CurrentWork}`));
            expect(currentWorkRefetch).toHaveBeenCalled();

            fireEvent.click(screen.getByTestId(`refresh-${DispatchBox.Supports}`));
            expect(supportTasksRefetch).toHaveBeenCalled();
        });
    });

    describe('CourierCodeSearch', () => {
        it('calls getExactCourierMatch on Enter and selectDriver on success', async () => {
            const selectDriver = jest.fn();
            mockGetExactCourierMatch.mockResolvedValueOnce({id: 5, text: 'Courier Five'} as any);

            setupDefaultMocks({
                currentWork: defaultCurrentWorkReturn({selectDriver}),
            });

            renderDispatchPage();

            const input = screen.getByPlaceholderText('Courier #');
            fireEvent.change(input, {target: {value: 'C005'}});
            fireEvent.keyDown(input, {key: 'Enter'});

            await waitFor(() => {
                expect(mockGetExactCourierMatch).toHaveBeenCalledWith('C005');
            });

            await waitFor(() => {
                expect(selectDriver).toHaveBeenCalledWith(
                    expect.objectContaining({courierId: 5, name: 'Courier Five'}),
                );
            });
        });

        it('calls showToast with warning when courier not found', async () => {
            mockGetExactCourierMatch.mockResolvedValueOnce(null as any);
            const showToast = jest.fn();

            setupDefaultMocks();
            renderDispatchPage({showToast});

            const input = screen.getByPlaceholderText('Courier #');
            fireEvent.change(input, {target: {value: 'INVALID'}});
            fireEvent.keyDown(input, {key: 'Enter'});

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(
                    'No courier found with code: INVALID',
                    'warning',
                );
            });
        });
    });

    describe('TruckModeMenu', () => {
        it('opens menu on chip click and sets truck mode on selection', () => {
            const setTruckMode = jest.fn();
            setupDefaultMocks({
                driverLocations: defaultDriverLocationsReturn({
                    truckMode: 'Off' as TruckMode,
                    setTruckMode,
                }),
            });

            renderDispatchPage();

            // Click the truck mode chip
            const chip = screen.getByText('Trucks: Off');
            fireEvent.click(chip);

            // Menu items appear
            expect(screen.getByRole('menuitem', {name: 'On'})).toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Off'})).toBeInTheDocument();
            expect(screen.getByRole('menuitem', {name: 'Only'})).toBeInTheDocument();

            // Click "On"
            fireEvent.click(screen.getByRole('menuitem', {name: 'On'}));
            expect(setTruckMode).toHaveBeenCalledWith('On');
        });
    });

    describe('CurrentWork toolbar (selectedDriver mode)', () => {
        it('shows back button and truck loading status button that opens React dialog', async () => {
            const backToOverview = jest.fn();
            mockGetTruckCourierStatus.mockResolvedValueOnce({
                courierId: 10,
                courierCode: 'C10',
                firstName: 'John',
                maxPallets: 20,
                maxPayLoad: 1000,
                currentPallets: 5,
                currentWeight: 300,
                availablePalletCapacity: 15,
                availablePallets: 15,
                lastUpdated: '2026-01-01',
            });

            setupDefaultMocks({
                currentWork: defaultCurrentWorkReturn({
                    viewMode: 'selectedDriver',
                    selectedCourierId: 10,
                    selectedDriverName: 'John Smith',
                    backToOverview,
                    driverJobsFetchConfig: {fetchFn: jest.fn(), queryKeyFn: jest.fn(), initialParams: {}},
                }),
            });

            renderDispatchPage({isUsCustomer: true});

            // Back button present and functional (US tenants only)
            const toolbarActions = screen.getByTestId(`toolbar-actions-${DispatchBox.CurrentWork}`);
            const backButton = within(toolbarActions).getByLabelText('Back to All Drivers');
            fireEvent.click(backButton);
            expect(backToOverview).toHaveBeenCalled();

            // Truck Loading Status button opens React dialog
            const truckButton = within(toolbarActions).getByLabelText('Truck Loading Status');
            fireEvent.click(truckButton);

            // Dialog should appear with the header and courier subtitle
            await waitFor(() => {
                expect(screen.getByText('Truck Loading Status')).toBeInTheDocument();
                expect(screen.getByText('C10 John')).toBeInTheDocument();
            });
            expect(mockGetTruckCourierStatus).toHaveBeenCalledWith(10);
        });
    });

    describe('CurrentWork toolbar (NZ tenant - no overview)', () => {
        it('does not show back button for NZ tenants', () => {
            setupDefaultMocks({
                currentWork: defaultCurrentWorkReturn({
                    viewMode: 'selectedDriver',
                    selectedCourierId: 10,
                    selectedDriverName: 'John Smith',
                    driverJobsFetchConfig: {fetchFn: jest.fn(), queryKeyFn: jest.fn(), initialParams: {}},
                }),
            });

            renderDispatchPage({isUsCustomer: false});

            const toolbarActions = screen.getByTestId(`toolbar-actions-${DispatchBox.CurrentWork}`);
            expect(within(toolbarActions).queryByLabelText('Back to All Drivers')).not.toBeInTheDocument();
        });

        it('shows NZ placeholder when no driver selected', () => {
            setupDefaultMocks({
                currentWork: defaultCurrentWorkReturn({
                    viewMode: 'selectedDriver',
                    selectedCourierId: undefined,
                    driverJobsFetchConfig: null,
                }),
            });

            renderDispatchPage({isUsCustomer: false});

            expect(screen.getByText('No Driver Selected')).toBeInTheDocument();
            expect(screen.queryByTestId('current-work-all-drivers')).not.toBeInTheDocument();
        });
    });

    describe('DriverLocations clear area button', () => {
        it('shows clear button when activeAreaId is set and clears on click', () => {
            const setActiveAreaId = jest.fn();
            setupDefaultMocks({
                driverLocations: defaultDriverLocationsReturn({
                    activeAreaId: 7,
                    setActiveAreaId,
                }),
            });

            renderDispatchPage();

            const toolbarActions = screen.getByTestId(`toolbar-actions-${DispatchBox.DriverLocations}`);
            const clearButton = within(toolbarActions).getByLabelText('Clear Driver Location Selection');
            fireEvent.click(clearButton);

            expect(setActiveAreaId).toHaveBeenCalledWith(undefined);
        });

        it('does not show clear button when no activeAreaId', () => {
            setupDefaultMocks();
            renderDispatchPage();

            const toolbarActions = screen.getByTestId(`toolbar-actions-${DispatchBox.DriverLocations}`);
            expect(within(toolbarActions).queryByLabelText('Clear Driver Location Selection')).not.toBeInTheDocument();
        });
    });

    describe('Subtitle computation', () => {
        it('returns currentSelection for JobDetail, currentWorkSelection for CurrentWork, empty for others', () => {
            setupDefaultMocks({
                jobSelection: defaultJobSelectionReturn({currentSelection: ' - Job #J042'}),
                currentWork: defaultCurrentWorkReturn({currentWorkSelection: ' - John Smith'}),
            });

            renderDispatchPage();

            expect(screen.getByTestId(`subtitle-${DispatchBox.JobDetail}`)).toHaveTextContent('- Job #J042');
            expect(screen.getByTestId(`subtitle-${DispatchBox.CurrentWork}`)).toHaveTextContent('- John Smith');
            expect(screen.getByTestId(`subtitle-${DispatchBox.JobsList}`)).toHaveTextContent('');
            expect(screen.getByTestId(`subtitle-${DispatchBox.Map}`)).toHaveTextContent('');
        });
    });

    describe('Filter integration: fetchConfig construction', () => {
        it('passes view IDs and date filter data into fetchConfig.fetchFn for dispatch jobs', () => {
            const startDate = dayjs('2026-03-01');
            const endDate = dayjs('2026-03-15');

            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [1, 2],
                },
                dateFilter: {
                    dateFilterData: {startDate, endDate, useTime: false},
                    onRefreshData: jest.fn(),
                },
            });

            renderDispatchPage();

            // The fetchConfig should have been passed to JobListPanel
            expect(lastJobListPanelProps).not.toBeNull();
            expect(lastJobListPanelProps.fetchConfig).toBeDefined();

            // Invoke the fetchFn to verify it calls fetchDispatchJobs with correct filter params
            const params = {page: 0, pageSize: 50};
            lastJobListPanelProps.fetchConfig.fetchFn(params, {});

            expect(mockFetchDispatchJobs).toHaveBeenCalledWith(
                expect.objectContaining({
                    despatchViewIds: [1, 2],
                    startDate,
                    endDate,
                    useTime: false,
                    page: 0,
                    pageSize: 50,
                }),
                {},
            );
            expect(mockFetchClearListJobs).not.toHaveBeenCalled();
        });

        it('passes useTime: true when date filter has useTime set', () => {
            const startDate = dayjs(0);
            const endDate = dayjs().add(3, 'hours');

            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [5],
                },
                dateFilter: {
                    dateFilterData: {startDate, endDate, useTime: true},
                    onRefreshData: jest.fn(),
                },
            });

            renderDispatchPage();
            lastJobListPanelProps.fetchConfig.fetchFn({}, {});

            expect(mockFetchDispatchJobs).toHaveBeenCalledWith(
                expect.objectContaining({
                    despatchViewIds: [5],
                    startDate,
                    endDate,
                    useTime: true,
                }),
                {},
            );
        });

        it('sends undefined dates when dateFilterData is null', () => {
            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [1],
                },
                dateFilter: defaultDateFilterReturn(), // dateFilterData: null
            });

            renderDispatchPage();
            lastJobListPanelProps.fetchConfig.fetchFn({}, {});

            expect(mockFetchDispatchJobs).toHaveBeenCalledWith(
                expect.objectContaining({
                    despatchViewIds: [1],
                    startDate: undefined,
                    endDate: undefined,
                    useTime: undefined,
                }),
                {},
            );
        });

        it('switches to fetchClearListJobs when activeAreaId is set', () => {
            const startDate = dayjs('2026-03-01');
            const endDate = dayjs('2026-03-15');

            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [3],
                },
                dateFilter: {
                    dateFilterData: {startDate, endDate, useTime: false},
                    onRefreshData: jest.fn(),
                },
                driverLocations: defaultDriverLocationsReturn({activeAreaId: 7}),
            });

            renderDispatchPage();

            lastJobListPanelProps.fetchConfig.fetchFn({page: 0}, {});

            expect(mockFetchClearListJobs).toHaveBeenCalledWith(
                expect.objectContaining({
                    despatchViewIds: [3],
                    startDate,
                    endDate,
                    useTime: false,
                    selectedClearListId: 7,
                    statusFilter: 'needs-dispatch',
                }),
                {},
            );
            expect(mockFetchDispatchJobs).not.toHaveBeenCalled();
        });

        it('sets defaultCategory to needs-dispatch when activeAreaId is set', () => {
            setupDefaultMocks({
                driverLocations: defaultDriverLocationsReturn({activeAreaId: 7}),
            });

            renderDispatchPage();

            const panel = screen.getByTestId('job-list-panel');
            expect(panel).toHaveAttribute('data-default-category', 'needs-dispatch');
        });

        it('does not set defaultCategory when no activeAreaId', () => {
            setupDefaultMocks();
            renderDispatchPage();

            const panel = screen.getByTestId('job-list-panel');
            expect(panel).toHaveAttribute('data-default-category', '');
        });

        // ── queryKeyFn must include all filter params (regression) ────
        // Without date/view params in the query key, React Query serves
        // cached data instead of re-fetching when filters change.

        it('includes date params in queryKeyFn for dispatch jobs', () => {
            const startDate = dayjs('2026-03-01');
            const endDate = dayjs('2026-03-15');

            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [1],
                },
                dateFilter: {
                    dateFilterData: {startDate, endDate, useTime: true},
                    onRefreshData: jest.fn(),
                },
            });

            renderDispatchPage();

            lastJobListPanelProps.fetchConfig.queryKeyFn({page: 0});

            expect(queryKeys.dispatch.jobs).toHaveBeenCalledWith(
                expect.objectContaining({
                    startDate,
                    endDate,
                    useTime: true,
                    despatchViewIds: [1],
                }),
            );
        });

        it('includes date params in queryKeyFn for clear list jobs', () => {
            const startDate = dayjs('2026-03-01');
            const endDate = dayjs('2026-03-15');

            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [1],
                },
                dateFilter: {
                    dateFilterData: {startDate, endDate, useTime: false},
                    onRefreshData: jest.fn(),
                },
                driverLocations: defaultDriverLocationsReturn({activeAreaId: 7}),
            });

            renderDispatchPage();

            lastJobListPanelProps.fetchConfig.queryKeyFn({page: 0});

            expect(queryKeys.dispatch.clearList).toHaveBeenCalledWith(
                expect.objectContaining({
                    startDate,
                    endDate,
                    useTime: false,
                    despatchViewIds: [1],
                    selectedClearListId: 7,
                }),
            );
        });

        it('queryKeyFn includes undefined dates when dateFilterData is null', () => {
            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [1],
                },
                dateFilter: defaultDateFilterReturn(),
            });

            renderDispatchPage();

            lastJobListPanelProps.fetchConfig.queryKeyFn({page: 0});

            expect(queryKeys.dispatch.jobs).toHaveBeenCalledWith(
                expect.objectContaining({
                    startDate: undefined,
                    endDate: undefined,
                    useTime: undefined,
                }),
            );
        });

        it('produces different query keys when date filter changes', () => {
            const mockJobsKeyFn = queryKeys.dispatch.jobs as jest.Mock;

            const startDate1 = dayjs('2026-03-01');
            const endDate1 = dayjs('2026-03-15');

            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [1],
                },
                dateFilter: {
                    dateFilterData: {startDate: startDate1, endDate: endDate1, useTime: false},
                    onRefreshData: jest.fn(),
                },
            });

            const {unmount} = renderDispatchPage();

            lastJobListPanelProps.fetchConfig.queryKeyFn({page: 0});
            const firstCallArgs = mockJobsKeyFn.mock.calls[mockJobsKeyFn.mock.calls.length - 1][0];

            unmount();
            mockJobsKeyFn.mockClear();

            // Re-render with different dates
            const startDate2 = dayjs('2026-04-01');
            const endDate2 = dayjs('2026-04-30');

            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [1],
                },
                dateFilter: {
                    dateFilterData: {startDate: startDate2, endDate: endDate2, useTime: true},
                    onRefreshData: jest.fn(),
                },
            });

            renderDispatchPage();

            lastJobListPanelProps.fetchConfig.queryKeyFn({page: 0});
            const secondCallArgs = mockJobsKeyFn.mock.calls[mockJobsKeyFn.mock.calls.length - 1][0];

            // The query key params must differ so React Query triggers a re-fetch
            expect(firstCallArgs.startDate).not.toBe(secondCallArgs.startDate);
            expect(firstCallArgs.endDate).not.toBe(secondCallArgs.endDate);
            expect(secondCallArgs.startDate).toBe(startDate2);
            expect(secondCallArgs.endDate).toBe(endDate2);
            expect(secondCallArgs.useTime).toBe(true);
        });

        it('produces different query keys when view IDs change', () => {
            const mockJobsKeyFn = queryKeys.dispatch.jobs as jest.Mock;

            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [1, 2],
                },
            });

            const {unmount} = renderDispatchPage();

            lastJobListPanelProps.fetchConfig.queryKeyFn({page: 0});
            const firstCallArgs = mockJobsKeyFn.mock.calls[mockJobsKeyFn.mock.calls.length - 1][0];

            unmount();
            mockJobsKeyFn.mockClear();

            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [3],
                },
            });

            renderDispatchPage();

            lastJobListPanelProps.fetchConfig.queryKeyFn({page: 0});
            const secondCallArgs = mockJobsKeyFn.mock.calls[mockJobsKeyFn.mock.calls.length - 1][0];

            expect(firstCallArgs.despatchViewIds).toEqual([1, 2]);
            expect(secondCallArgs.despatchViewIds).toEqual([3]);
        });
    });

    describe('Filter integration: driver locations receive date params', () => {
        it('passes date filter ISO strings to useDriverLocations', () => {
            const startDate = dayjs('2026-03-01T00:00:00Z');
            const endDate = dayjs('2026-03-15T23:59:59Z');

            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [1, 2],
                },
                dateFilter: {
                    dateFilterData: {startDate, endDate, useTime: false},
                    onRefreshData: jest.fn(),
                },
            });

            renderDispatchPage();

            expect(mockDriverLocations).toHaveBeenCalledWith(
                [1, 2],
                startDate.toISOString(),
                endDate.toISOString(),
                expect.anything(), // refetchInterval
            );
        });

        it('passes undefined dates to useDriverLocations when dateFilterData is null', () => {
            setupDefaultMocks({
                pageViews: {
                    ...defaultPageViewsReturn(),
                    selectedViewIds: [1],
                },
                dateFilter: defaultDateFilterReturn(),
            });

            renderDispatchPage();

            expect(mockDriverLocations).toHaveBeenCalledWith(
                [1],
                undefined,
                undefined,
                expect.anything(),
            );
        });
    });
});
