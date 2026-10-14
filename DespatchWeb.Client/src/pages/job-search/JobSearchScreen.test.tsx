import React from 'react';
import {act, screen} from '@testing-library/react';
import {renderWithProviders} from '../../test/utils';
import {NavigationProvider} from '../../routes/NavigationContext';
import {JobSearchScreen} from './JobSearchScreen';
import type {ToolbarActionsConfig} from '../../components/common/app-shell/ToolbarActionsView';
import {testDialogs} from '../../components/dialogs/testDialogRegistry';
jest.mock('../../components/dialogs/dialogRegistry', () => require('../../components/dialogs/testDialogRegistry').createDialogRegistryMock());

const mockBridge = {
    setCurrentLayoutName: jest.fn(),
    reloadFromStorage: jest.fn(),
    promptSaveLayout: jest.fn(),
    promptDeleteLayout: jest.fn(),
    promptRenameLayout: jest.fn(),
    resetCurrentLayout: jest.fn(),
    setColumnEditMode: jest.fn(),
    openInterCourierCharge: jest.fn(() => Promise.resolve()),
    jobCreated: jest.fn(),
    importLegacyLayouts: jest.fn(),
};
const pageProps = jest.fn();
let captured: ToolbarActionsConfig;
const toolbarKeys = jest.fn();
const customizeKeys = jest.fn();
const layoutHook = {
    layouts: [], currentLayoutName: 'Mine',
    saveLayout: jest.fn(), loadLayout: jest.fn(), deleteLayout: jest.fn(), renameLayout: jest.fn(), importLayouts: jest.fn(),
};
const openCustomizePanels = jest.fn();

jest.mock('./JobSearchPage', () => ({
    JobSearchPage: (props: any) => {
        pageProps(props);
        props.onLayoutBridgeReady(mockBridge);
        return <div data-testid="job-search"/>;
    },
}));
jest.mock('../../components/layout/PageFrame', () => {
    const actual = jest.requireActual('../../components/layout/PageFrame');
    return {PageFrame: (p: any) => { captured = p.toolbarActions; return <actual.PageFrame {...p}/>; }};
});
jest.mock('../../hooks/useLayoutToolbar', () => ({
    useLayoutToolbar: (p: any) => { toolbarKeys(p.storageKeys); return layoutHook; },
}));
jest.mock('../../hooks/useCustomizePanelsDialog', () => ({
    useCustomizePanelsDialog: (p: any) => { customizeKeys(p); return {openCustomizePanels}; },
}));
jest.mock('../partner-approvals/PartnerApprovalsBadge', () => ({PartnerApprovalsBadge: () => null}));
jest.mock('../../hooks/useUnreadMessageCount', () => ({useUnreadMessageCount: () => ({count: 7, refresh: jest.fn()})}));
jest.mock('../../hooks/useMessagingDialog', () => ({useMessagingDialog: () => ({openMessaging: jest.fn()})}));
jest.mock('../../services/navigationService', () => ({openJobInSearch: jest.fn(), openHubUrl: jest.fn()}));
jest.mock('../../services/toastService', () => ({toastService: {showToast: jest.fn(), showErrorToast: jest.fn()}}));
jest.mock('../../api/session', () => ({
    getSession: () => ({
        contactId: 42, firstName: 'Jo', fullName: 'Jo Doe', isNetworkPartner: false,
        isUsCustomer: true, timeZone: 'Pacific Standard Time', visibleFeatures: null,
    }),
}));

const renderScreen = (jobId?: number) =>
    renderWithProviders(
        <NavigationProvider value={{navigate: jest.fn(), currentState: 'jobSearch'}}>
            <JobSearchScreen jobId={jobId}/>
        </NavigationProvider>,
    );

beforeEach(() => jest.clearAllMocks());

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
        jest.spyOn(window, 'confirm').mockReturnValue(true);
        renderScreen();
        const layouts = captured.layouts!;

        act(() => layouts.onToggleColumnEditMode!());
        expect(mockBridge.setColumnEditMode).toHaveBeenLastCalledWith(true);

        const exit = pageProps.mock.calls.at(-1)![0].onExitColumnEditMode;
        act(() => exit());
        expect(mockBridge.setColumnEditMode).toHaveBeenLastCalledWith(false);

        layouts.onResetLayout!();
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('"Mine"'));
        expect(mockBridge.resetCurrentLayout).toHaveBeenCalled();

        await captured.actionsMenu!.onInterCourierCharge({} as React.MouseEvent);
        expect(mockBridge.openInterCourierCharge).toHaveBeenCalled();

        layouts.onCustomizePanels!();
        expect(openCustomizePanels).toHaveBeenCalled();
        customizeKeys.mock.calls.at(-1)![0].onVisibilityChanged();
        expect(mockBridge.reloadFromStorage).toHaveBeenCalled();
    });

    it('opens the create-job dialog with the tenant flag and hands the new id to the page', async () => {
        const open = jest.fn().mockResolvedValue(555);
        testDialogs.CreateJob = {open};
        renderScreen();

        captured.actionsMenu!.onCreateNewJob({} as React.MouseEvent);
        await act(async () => undefined);

        expect(open).toHaveBeenCalledWith(true);
        expect(mockBridge.jobCreated).toHaveBeenCalledWith(555);
        delete testDialogs.CreateJob;
    });
});
