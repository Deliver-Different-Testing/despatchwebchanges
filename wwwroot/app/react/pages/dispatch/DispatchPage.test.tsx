/** @jest-environment jest-environment-jsdom */
import React from 'react';
import {act, render, screen, fireEvent, waitFor, within} from '@testing-library/react';
import {QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {DispatchPage} from './DispatchPage';
import {DispatchBox} from './DispatchPage.interfaces';
import {createTestQueryClient} from '../../__testUtils__';
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
    ActionsMenu: (props: any) => <div data-testid="actions-menu">ActionsMenu</div>,
    MessagesButton: (props: any) => (
        <div data-testid="messages-button" data-unread={props.unreadCount}>
            MessagesButton
        </div>
    ),
    DateFilterMenu: (props: any) => <div data-testid="date-filter-menu">DateFilterMenu</div>,
    ViewsMenu: (props: any) => <div data-testid="views-menu">ViewsMenu</div>,
    LayoutsMenu: (props: any) => (
        <div data-testid="layouts-menu">
            <button data-testid="save-layout-btn" onClick={props.onSaveLayout}>SaveLayout</button>
            LayoutsMenu
        </div>
    ),
    SettingsButton: (props: any) => <div data-testid="settings-button">SettingsButton</div>,
}));

// DashboardGrid mock: invokes renderWidget, renderToolbarActions, getSubtitle, exposes onRefresh
jest.mock('./components/DashboardGrid', () => ({
    DashboardGrid: (props: any) => (
        <div data-testid="dashboard-grid">
            {props.visibleBoxIds.map((boxId: string) => (
                <div key={boxId} data-testid={`box-${boxId}`}>
                    <div data-testid={`widget-${boxId}`}>
                        {props.renderWidget(boxId)}
                    </div>
                    <div data-testid={`toolbar-actions-${boxId}`}>
                        {props.renderToolbarActions?.(boxId)}
                    </div>
                    <div data-testid={`subtitle-${boxId}`}>
                        {props.getSubtitle?.(boxId) ?? ''}
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

jest.mock('../../components/job-list/JobListPanel', () => ({
    JobListPanel: (props: any) => (
        <div data-testid="job-list-panel" data-storage-prefix={props.storagePrefix ?? ''}>
            JobListPanel
        </div>
    ),
}));

jest.mock('../../components/common/job-details/JobDetails', () => ({
    JobDetails: (props: any) => <div data-testid="job-details">JobDetails</div>,
}));

jest.mock('../../components/common/dispatch-map/DispatchMap', () => ({
    DispatchMap: (props: any) => <div data-testid="dispatch-map">DispatchMap</div>,
}));

jest.mock('../../components/common/driver-locations/DriverLocations', () => ({
    DriverLocations: (props: any) => <div data-testid="driver-locations-widget">DriverLocations</div>,
}));

jest.mock('../../components/common/current-work-all-drivers/CurrentWorkAllDrivers', () => ({
    CurrentWorkAllDrivers: (props: any) => (
        <div data-testid="current-work-all-drivers">CurrentWorkAllDrivers</div>
    ),
}));

jest.mock('./components/SupportTasksPanel', () => ({
    SupportTasksPanel: (props: any) => <div data-testid="support-tasks-panel">SupportTasks</div>,
}));

jest.mock('./components/JobDetailFab', () => ({
    JobDetailFab: (props: any) => <div data-testid="job-detail-fab">JobDetailFab</div>,
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
jest.mock('../../services/angularDialogBridge', () => ({
    openInterCourierChargeDialog: jest.fn(() => Promise.resolve()),
    openJobFileUploadDialog: jest.fn(() => Promise.resolve()),
    openTruckCourierStatusDialog: jest.fn(() => Promise.resolve()),
}));

import {getPotentialCouriers, getExactCourierMatch, getTruckCourierStatus} from '../../services/dispatchApi';

const mockGetPotentialCouriers = getPotentialCouriers as jest.MockedFunction<typeof getPotentialCouriers>;
const mockGetExactCourierMatch = getExactCourierMatch as jest.MockedFunction<typeof getExactCourierMatch>;
const mockGetTruckCourierStatus = getTruckCourierStatus as jest.MockedFunction<typeof getTruckCourierStatus>;

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
        rowHeight: 80,
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
            renderDispatchPage();

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
        it('shows back button and truck loading status button', async () => {
            const backToOverview = jest.fn();
            mockGetTruckCourierStatus.mockResolvedValueOnce({} as any);

            setupDefaultMocks({
                currentWork: defaultCurrentWorkReturn({
                    viewMode: 'selectedDriver',
                    selectedCourierId: 10,
                    selectedDriverName: 'John Smith',
                    backToOverview,
                    driverJobsFetchConfig: {fetchFn: jest.fn(), queryKeyFn: jest.fn(), initialParams: {}},
                }),
            });

            renderDispatchPage();

            // Back button present and functional
            const toolbarActions = screen.getByTestId(`toolbar-actions-${DispatchBox.CurrentWork}`);
            const backButton = within(toolbarActions).getByLabelText('Back to All Drivers');
            fireEvent.click(backButton);
            expect(backToOverview).toHaveBeenCalled();

            // Truck Loading Status button present
            const truckButton = within(toolbarActions).getByLabelText('Truck Loading Status');
            fireEvent.click(truckButton);

            await waitFor(() => {
                expect(mockGetTruckCourierStatus).toHaveBeenCalledWith(10);
            });
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
});
