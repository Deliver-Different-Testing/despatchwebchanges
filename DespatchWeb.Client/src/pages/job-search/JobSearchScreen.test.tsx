import React from 'react';
import {act, screen} from '@testing-library/react';
import {renderWithProviders} from '../../test/utils';
import {NavigationProvider} from '../../routes/NavigationContext';
import {JobSearchScreen} from './JobSearchScreen';
import type {ToolbarActionsConfig} from '../../components/common/app-shell/ToolbarActionsView';
import {testDialogs} from '../../components/dialogs/testDialogRegistry';
vi.mock('../../components/dialogs/dialogRegistry', async () => (await import('../../components/dialogs/testDialogRegistry')).createDialogRegistryMock());

const mockBridge = {
    setCurrentLayoutName: vi.fn(),
    reloadFromStorage: vi.fn(),
    promptSaveLayout: vi.fn(),
    promptDeleteLayout: vi.fn(),
    promptRenameLayout: vi.fn(),
    resetCurrentLayout: vi.fn(),
    setColumnEditMode: vi.fn(),
    openInterCourierCharge: vi.fn(() => Promise.resolve()),
    jobCreated: vi.fn(),
};
const pageProps = vi.fn();
let captured: ToolbarActionsConfig;
const toolbarKeys = vi.fn();
const customizeKeys = vi.fn();
const layoutHook = {
    layouts: [], currentLayoutName: 'Mine',
    saveLayout: vi.fn(), loadLayout: vi.fn(), deleteLayout: vi.fn(), renameLayout: vi.fn(),
};
const openCustomizePanels = vi.fn();

vi.mock('./JobSearchPage', () => ({
    JobSearchPage: (props: any) => {
        pageProps(props);
        props.onLayoutBridgeReady(mockBridge);
        return <div data-testid="job-search"/>;
    },
}));
vi.mock('../../components/layout/PageFrame', async () => {
    const actual = (await vi.importActual<typeof import('../../components/layout/PageFrame')>('../../components/layout/PageFrame'));
    return {PageFrame: (p: any) => { captured = p.toolbarActions; return <actual.PageFrame {...p}/>; }};
});
vi.mock('../../hooks/useLayoutToolbar', () => ({
    useLayoutToolbar: (p: any) => { toolbarKeys(p.storageKeys); return layoutHook; },
}));
vi.mock('../../hooks/useCustomizePanelsDialog', () => ({
    useCustomizePanelsDialog: (p: any) => { customizeKeys(p); return {openCustomizePanels}; },
}));
vi.mock('../partner-approvals/PartnerApprovalsBadge', () => ({PartnerApprovalsBadge: () => null}));
vi.mock('../../hooks/useUnreadMessageCount', () => ({useUnreadMessageCount: () => ({count: 7, refresh: vi.fn()})}));
vi.mock('../../hooks/useMessagingDialog', () => ({useMessagingDialog: () => ({openMessaging: vi.fn()})}));
vi.mock('../../services/navigationService', () => ({openJobInSearch: vi.fn(), openHubUrl: vi.fn()}));
vi.mock('../../services/toastService', () => ({toastService: {showToast: vi.fn(), showErrorToast: vi.fn()}}));
vi.mock('../../api/session', () => ({
    getSession: () => ({
        contactId: 42, firstName: 'Jo', fullName: 'Jo Doe', isNetworkPartner: false,
        isUsCustomer: true, timeZone: 'Pacific Standard Time', visibleFeatures: null,
    }),
}));

const renderScreen = (jobId?: number) =>
    renderWithProviders(
        <NavigationProvider value={{navigate: vi.fn(), currentState: 'jobSearch'}}>
            <JobSearchScreen jobId={jobId}/>
        </NavigationProvider>,
    );

beforeEach(() => vi.clearAllMocks());

describe('JobSearchScreen', () => {
    it('renders the page in the frame with session props, deep link and unread badge', () => {
        renderScreen(99);

        expect(screen.getByTestId('job-search')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Search'})).toBeInTheDocument();
        expect(screen.getByLabelText('Messages')).toHaveTextContent('7');
        expect(pageProps.mock.calls.at(-1)![0]).toMatchObject({
            isUsCustomer: true, timeZone: 'Pacific Standard Time', deepLinkJobId: 99,
        });
    });

    it('uses the exact layout storage keys', () => {
        renderScreen();

        const expected = {
            layoutsKey: 'layoutsCSV2-42',
            lastActiveLayoutKey: 'lastActiveLayoutCSV2-42',
            boxVisibilityKeyBase: 'boxVisibilityV2-3-42',
        };
        expect(toolbarKeys).toHaveBeenCalledWith(expected);
        expect(customizeKeys.mock.calls.at(-1)![0].storageKeys).toEqual(expected);
    });

    it('routes toolbar actions to the page bridge', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        renderScreen();
        const layouts = captured.layouts!;

        act(() => layouts.onToggleColumnEditMode!());
        expect(mockBridge.setColumnEditMode).toHaveBeenLastCalledWith(true);

        const exit = pageProps.mock.calls.at(-1)![0].onExitColumnEditMode;
        await act(() => exit());
        expect(mockBridge.setColumnEditMode).toHaveBeenLastCalledWith(false);

        layouts.onResetLayout!();
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('"Mine"'));
        expect(mockBridge.resetCurrentLayout).toHaveBeenCalled();

        captured.actionsMenu!.onInterCourierCharge({} as React.MouseEvent);
        expect(mockBridge.openInterCourierCharge).toHaveBeenCalled();

        layouts.onCustomizePanels!();
        expect(openCustomizePanels).toHaveBeenCalled();
        customizeKeys.mock.calls.at(-1)![0].onVisibilityChanged();
        expect(mockBridge.reloadFromStorage).toHaveBeenCalled();
    });

    it('opens the create-job dialog with the tenant flag and hands the new id to the page', async () => {
        const open = vi.fn().mockResolvedValue(555);
        testDialogs.CreateJob = {open};
        renderScreen();

        captured.actionsMenu!.onCreateNewJob({} as React.MouseEvent);
        await act(async () => undefined);

        expect(open).toHaveBeenCalledWith(true);
        expect(mockBridge.jobCreated).toHaveBeenCalledWith(555);
        delete testDialogs.CreateJob;
    });
});
