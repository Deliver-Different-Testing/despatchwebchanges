import React from 'react';
import {screen, waitFor, act} from '@testing-library/react';
import {renderWithProviders} from '../../test/utils';
import {setupUser} from '../../test/utils/setupUser';
import {NavigationProvider} from '../../routes/NavigationContext';
import {DispatchScreen} from './DispatchScreen';
import {createDefaultDispatchLayout} from './lib/boxDefinitions';
import {testDialogs} from '../../components/dialogs/testDialogRegistry';
jest.mock('../../components/dialogs/dialogRegistry', () => require('../../components/dialogs/testDialogRegistry').createDialogRegistryMock());

const pageProps = jest.fn();
const bridge = {
    setCurrentLayoutName: jest.fn(),
    reloadFromStorage: jest.fn(),
    promptSaveLayout: jest.fn(),
    promptDeleteLayout: jest.fn(),
    promptRenameLayout: jest.fn(),
    updateFilters: jest.fn(),
    registerViewsListener: jest.fn(),
    setViewSelection: jest.fn(),
    updateRefreshIntervals: jest.fn(),
    updateCourierDisplayMode: jest.fn(),
    resetCurrentLayout: jest.fn(),
    setColumnEditMode: jest.fn(),
    openInterCourierCharge: jest.fn(),
    jobCreated: jest.fn(),
    importLegacyLayouts: jest.fn(),
};
let viewsListener: (views: unknown[]) => void;

jest.mock('./DispatchPage', () => {
    const {useEffect} = jest.requireActual('react');
    return {
        DispatchPage: (props: {onLayoutBridgeReady: (b: unknown) => void}) => {
            pageProps(props);
            useEffect(() => props.onLayoutBridgeReady(bridge), []); // eslint-disable-line react-hooks/exhaustive-deps
            return <div data-testid="dispatch-page"/>;
        },
    };
});
jest.mock('../partner-approvals/PartnerApprovalsBadge', () => ({PartnerApprovalsBadge: () => null}));
jest.mock('../../hooks/useUnreadMessageCount', () => ({useUnreadMessageCount: () => ({count: 4, refresh: jest.fn()})}));
jest.mock('../../hooks/useMessagingDialog', () => ({useMessagingDialog: () => ({openMessaging: jest.fn()})}));
jest.mock('../../api/preferencesApi', () => ({getPreference: jest.fn().mockResolvedValue(null), savePreference: jest.fn()}));
jest.mock('../../services/navigationService', () => ({openJobInSearch: jest.fn(), openHubUrl: jest.fn()}));
jest.mock('../../services/toastService', () => ({
    toastService: {showToast: jest.fn(), showErrorToast: jest.fn(), showSuccessToast: jest.fn()},
}));
jest.mock('../../api/session', () => ({
    getContactId: () => 7, getTimeZone: () => '',
    getSession: () => ({
        contactId: 7, firstName: 'Jo', fullName: 'Jo Doe', isNetworkPartner: false,
        isUsCustomer: true, visibleFeatures: null, timeZone: '',
    }),
}));

const renderScreen = (ui: React.ReactElement = <DispatchScreen/>) =>
    renderWithProviders(<NavigationProvider value={{navigate: jest.fn(), currentState: 'dispatch'}}>{ui}</NavigationProvider>);

const seedCustomLayout = () => {
    localStorage.setItem('layoutV2-7', JSON.stringify([{name: 'Mine', layout: createDefaultDispatchLayout().layout}]));
    localStorage.setItem('lastActiveLayoutV2-7', 'Mine');
};

const openLayouts = async (user: ReturnType<typeof setupUser>) => {
    await user.click(screen.getByRole('button', {name: 'Layouts'}));
};

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    bridge.registerViewsListener.mockImplementation((l: (v: unknown[]) => void) => {
        viewsListener = l;
        return jest.fn();
    });
    delete testDialogs.CreateJob;
    delete testDialogs.DashboardSettings;
    delete testDialogs.CustomizePanels;
});

describe('DispatchScreen', () => {
    it('frames the page, forwards props and pushes the date filter once the bridge is ready', async () => {
        renderScreen(<DispatchScreen deepLinkJobId={55}/>);

        expect(screen.getByRole('heading', {name: 'Dispatch'})).toBeInTheDocument();
        expect(screen.getAllByText('Dashboards').length).toBeGreaterThan(0);
        expect(pageProps.mock.calls.at(-1)![0]).toMatchObject({
            deepLinkJobId: 55, isUsCustomer: true, timeZone: 'New Zealand Standard Time',
        });
        await waitFor(() => expect(bridge.updateFilters).toHaveBeenCalledWith(
            expect.objectContaining({startDate: expect.anything(), endDate: expect.anything(), useTime: expect.any(Boolean)}),
        ));
        expect(bridge.registerViewsListener).toHaveBeenCalledTimes(1);
    });

    it('shows the unread message count', () => {
        renderScreen();
        expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('mirrors the page views into the Views menu and toggles/clears the selection through the bridge', async () => {
        const user = setupUser();
        renderScreen();
        act(() => viewsListener([{id: 1, name: 'North', selected: true}, {id: 2, name: 'South', selected: false}]));

        await user.click(screen.getByRole('button', {name: 'Views'}));
        await user.click(await screen.findByRole('menuitemcheckbox', {name: 'South'}));
        expect(bridge.setViewSelection).toHaveBeenLastCalledWith([1, 2]);

        await user.click(screen.getByRole('menuitemcheckbox', {name: 'North'}));
        expect(bridge.setViewSelection).toHaveBeenLastCalledWith([]);

        await user.click(screen.getByRole('button', {name: 'Clear selected views'}));
        expect(bridge.setViewSelection).toHaveBeenLastCalledWith([]);
    });

    it('opens the create-job dialog with the tenant flag and reports the new job to the bridge', async () => {
        const open = jest.fn().mockResolvedValue(321);
        testDialogs.CreateJob = {open};
        const user = setupUser();
        renderScreen();

        await user.click(screen.getByRole('button', {name: 'Actions menu'}));
        await user.click(await screen.findByRole('menuitem', {name: /add new job/i}));

        expect(open).toHaveBeenCalledWith(true);
        await waitFor(() => expect(bridge.jobCreated).toHaveBeenCalledWith(321));

        await user.click(screen.getByRole('button', {name: 'Actions menu'}));
        await user.click(await screen.findByRole('menuitem', {name: /inter-courier charge/i}));
        expect(bridge.openInterCourierCharge).toHaveBeenCalled();
    });

    it('does not notify the bridge when job creation is cancelled', async () => {
        testDialogs.CreateJob = {open: jest.fn().mockResolvedValue(null)};
        const user = setupUser();
        renderScreen();

        await user.click(screen.getByRole('button', {name: 'Actions menu'}));
        await user.click(await screen.findByRole('menuitem', {name: /add new job/i}));
        await act(async () => undefined);

        expect(bridge.jobCreated).not.toHaveBeenCalled();
    });

    it('runs layout actions against the exact storage keys and the bridge', async () => {
        const user = setupUser();
        bridge.promptSaveLayout.mockResolvedValue('Fresh');
        renderScreen();

        await openLayouts(user);
        await user.click(await screen.findByText('Add layout'));

        await waitFor(() => expect(bridge.reloadFromStorage).toHaveBeenCalled());
        expect(bridge.setCurrentLayoutName).toHaveBeenCalledWith('Fresh');
        expect(JSON.parse(localStorage.getItem('layoutV2-7')!).map((l: {name: string}) => l.name)).toContain('Fresh');
        expect(localStorage.getItem('lastActiveLayoutV2-7')).toBe('Fresh');
    });

    it('toggles column edit mode and resets the layout after confirmation', async () => {
        seedCustomLayout();
        const user = setupUser();
        const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
        renderScreen();

        await openLayouts(user);
        await user.click(await screen.findByText('Edit columns'));
        expect(bridge.setColumnEditMode).toHaveBeenLastCalledWith(true);

        await openLayouts(user);
        await user.click(await screen.findByText('Done editing columns'));
        expect(bridge.setColumnEditMode).toHaveBeenLastCalledWith(false);

        await openLayouts(user);
        await user.click(await screen.findByText('Reset layout'));
        expect(confirm).toHaveBeenCalledWith(expect.stringContaining('"Mine"'));
        expect(bridge.resetCurrentLayout).toHaveBeenCalledTimes(1);
    });

    it('leaves column edit mode when the page asks to exit', () => {
        renderScreen();
        act(() => pageProps.mock.calls.at(-1)![0].onExitColumnEditMode());
        expect(bridge.setColumnEditMode).toHaveBeenCalledWith(false);
    });

    it('persists customised panel visibility under the V2 key and reloads the page layout', async () => {
        seedCustomLayout();
        const open = jest.fn().mockImplementation(async (boxes: Record<string, {visible?: boolean}>) => boxes);
        testDialogs.CustomizePanels = {open};
        const user = setupUser();
        renderScreen();

        await openLayouts(user);
        await user.click(await screen.findByText('Show/Hide Panels…'));

        await waitFor(() => expect(bridge.reloadFromStorage).toHaveBeenCalled());
        expect(open).toHaveBeenCalledWith(expect.any(Object), 'Mine', true);
        expect(Object.keys(localStorage).some(k => k.startsWith('boxVisibilityV2-1-7'))).toBe(true);
    });

    it('opens the Dispatch settings dialog and pushes refresh intervals to the bridge', async () => {
        const open = jest.fn().mockResolvedValue({
            selectedRefreshInterval: {id: 30, text: ''},
            selectedDriverLocationRefreshInterval: {id: 0, text: ''},
            selectedTaskRefreshInterval: {id: 60, text: ''},
        });
        testDialogs.DashboardSettings = {open};
        const user = setupUser();
        renderScreen();

        await user.click(screen.getByRole('button', {name: 'Settings'}));

        await waitFor(() => expect(bridge.updateRefreshIntervals).toHaveBeenCalledWith(
            {jobsMs: 30000, driverLocationsMs: false, tasksMs: 60000},
        ));
        expect(open.mock.calls[0][0]).toEqual({
            title: 'Dispatch Dashboard Settings',
            showRefreshInterval: true,
            showDriverLocationRefresh: true,
            showTaskRefresh: true,
            showCourierDisplayMode: true,
        });
    });
});
