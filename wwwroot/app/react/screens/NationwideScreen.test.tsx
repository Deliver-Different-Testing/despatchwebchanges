import React from 'react';
import {act, render, screen, waitFor} from '@testing-library/react';
import {NationwideScreen} from './NationwideScreen';
import type {ToolbarActionsConfig} from '../components/common/app-shell/ToolbarActionsView';
import {testDialogs} from '../dialogs/testDialogRegistry';
jest.mock('../dialogs/dialogRegistry', () => require('../dialogs/testDialogRegistry').createDialogRegistryMock());

const bridge = {
    setCurrentLayoutName: jest.fn(),
    reloadFromStorage: jest.fn(),
    promptSaveLayout: jest.fn(),
    promptDeleteLayout: jest.fn(),
    promptRenameLayout: jest.fn(),
    importLegacyLayouts: jest.fn(() => ({imported: [], skipped: []})),
    resetCurrentLayout: jest.fn(),
    registerViewsListener: jest.fn((listener: (v: unknown[]) => void) => {
        listener([{id: 1, name: 'North', selected: false}, {id: 2, name: 'South', selected: true}]);
        return jest.fn();
    }),
    setViewSelection: jest.fn(),
    updateRefreshIntervalMs: jest.fn(),
    updateFilters: jest.fn(),
};
const pageProps = jest.fn();
let toolbar: ToolbarActionsConfig = {};

jest.mock('../pages/nationwide/NationwidePage', () => ({
    NationwidePage: (props: {onLayoutBridgeReady: (b: unknown) => void}) => {
        pageProps(props);
        React.useEffect(() => props.onLayoutBridgeReady(bridge), [props]);
        return <div data-testid="nationwide-page"/>;
    },
}));
jest.mock('../app/PageFrame', () => ({
    PageFrame: (props: {title: string; section: string; toolbarActions: ToolbarActionsConfig; children: React.ReactNode}) => {
        toolbar = props.toolbarActions;
        return <div data-testid="frame" data-title={props.title} data-section={props.section}>{props.children}</div>;
    },
}));
jest.mock('../services/toastService', () => ({
    toastService: {showToast: jest.fn(), showErrorToast: jest.fn(), showSuccessToast: jest.fn()},
}));
jest.mock('../session', () => ({
    getContactId: () => 42, getTimeZone: () => 'Pacific Standard Time',
    getSession: () => ({contactId: 42, isUsCustomer: true, timeZone: 'Pacific Standard Time'}),
}));

const renderReady = async (props = {}) => {
    render(<NationwideScreen {...props}/>);
    await waitFor(() => expect(toolbar.views?.loading).toBe(false));
};

beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    delete testDialogs.CustomizePanels;
    delete testDialogs.DashboardSettings;
});

describe('NationwideScreen', () => {
    it('renders the page in the frame with session values and deep link, and syncs views and filter', async () => {
        await renderReady({deepLinkJobId: 99});

        expect(screen.getByTestId('frame')).toHaveAttribute('data-title', 'Nationwide');
        expect(screen.getByTestId('frame')).toHaveAttribute('data-section', 'Operations');
        expect(pageProps.mock.calls.at(-1)![0]).toMatchObject({
            isUsCustomer: true, timeZone: 'Pacific Standard Time', deepLinkJobId: 99,
        });
        expect(bridge.updateFilters).toHaveBeenCalledWith(expect.objectContaining({useTime: expect.any(Boolean)}));
        expect(toolbar.views?.items).toHaveLength(2);
    });

    it('toggles and clears views through the bridge', async () => {
        await renderReady();

        act(() => toolbar.views!.onToggleView(toolbar.views!.items![0]));
        expect(bridge.setViewSelection).toHaveBeenLastCalledWith([1, 2]);
        act(() => toolbar.views!.onToggleView(toolbar.views!.items![1]));
        expect(bridge.setViewSelection).toHaveBeenLastCalledWith([]);
        act(() => toolbar.views!.onClearAll());
        expect(bridge.setViewSelection).toHaveBeenLastCalledWith([]);
    });

    it('persists the date filter under dateFilter-2-<contactId> and pushes it to the bridge', async () => {
        await renderReady();
        const filter = toolbar.dateFilter!.data!;
        bridge.updateFilters.mockClear();

        act(() => toolbar.dateFilter!.onRefreshData({...filter, useTime: true}));

        expect(localStorage.getItem('dateFilter-2-42')).toContain('"useTime":true');
        expect(bridge.updateFilters).toHaveBeenCalledWith(expect.objectContaining({useTime: true}));
    });

    it('saves layouts under the NWV2 keys', async () => {
        await renderReady();
        bridge.promptSaveLayout.mockResolvedValue('Mine');

        await act(() => toolbar.layouts!.onSaveLayout() as unknown as Promise<void>);

        await waitFor(() => expect(localStorage.getItem('layoutsNWV2-42')).toContain('Mine'));
        expect(localStorage.getItem('lastActiveLayoutNWV2-42')).toContain('Mine');
    });

    it('resets the layout via the bridge after confirmation only', async () => {
        await renderReady();
        const confirm = jest.spyOn(window, 'confirm');

        confirm.mockReturnValueOnce(false);
        act(() => toolbar.layouts!.onResetLayout!());
        expect(bridge.resetCurrentLayout).not.toHaveBeenCalled();

        confirm.mockReturnValueOnce(true);
        act(() => toolbar.layouts!.onResetLayout!());
        expect(bridge.resetCurrentLayout).toHaveBeenCalledTimes(1);
        confirm.mockRestore();
    });

    it('saves customised panel visibility under boxVisibilityV2-2-<contactId> and reloads the page layout', async () => {
        await renderReady();
        await act(() => toolbar.layouts!.onSaveLayout() as unknown as Promise<void>);
        bridge.promptSaveLayout.mockResolvedValue('Mine');
        await act(() => toolbar.layouts!.onSaveLayout() as unknown as Promise<void>);
        await waitFor(() => expect(toolbar.layouts!.currentLayoutName).toBe('Mine'));
        const open = jest.fn(async (boxes: Record<string, unknown>) => boxes);
        testDialogs.CustomizePanels = {open};

        await act(() => toolbar.layouts!.onCustomizePanels!() as unknown as Promise<void>);

        expect(open).toHaveBeenCalled();
        expect(Object.keys(localStorage).some(k => k.startsWith('boxVisibilityV2-2-42'))).toBe(true);
        expect(bridge.reloadFromStorage).toHaveBeenCalled();
    });

    it('saves the jobs refresh interval under refreshInterval-2-<contactId> and pushes ms to the bridge', async () => {
        await renderReady();
        const open = jest.fn().mockResolvedValue({selectedRefreshInterval: {id: 60, text: '1 min'}});
        testDialogs.DashboardSettings = {open};

        await act(() => toolbar.settings!.onClick({} as React.MouseEvent) as unknown as Promise<void>);

        expect(open.mock.calls[0][0]).toMatchObject({title: 'Nationwide Dashboard Settings', showRefreshInterval: true});
        expect(localStorage.getItem('refreshInterval-2-42')).toBe('60');
        expect(bridge.updateRefreshIntervalMs).toHaveBeenCalledWith(60000);
    });

    it('snaps a stored interval that is no longer offered to Disabled in the settings dialog', async () => {
        await renderReady();
        localStorage.setItem('refreshInterval-2-42', '45');
        const open = jest.fn().mockResolvedValue(null);
        testDialogs.DashboardSettings = {open};

        await act(() => toolbar.settings!.onClick({} as React.MouseEvent) as unknown as Promise<void>);

        expect(open.mock.calls[0][1]).toEqual({id: 0, text: ''});
    });
});
