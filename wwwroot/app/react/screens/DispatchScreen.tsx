import React, {useCallback, useMemo, useRef, useState} from 'react';
import {PageFrame} from '../app/PageFrame';
import {ErrorBoundary} from '../components/common/error-boundary';
import type {ToolbarActionsConfig} from '../components/common/app-shell/ToolbarActionsView';
import type {DateFilterData} from '../components/common/app-toolbar/ToolbarActions';
import type {LayoutStorageKeys} from '../components/common/box-shell/layoutPersistence';
import {AppPage} from '../../enums/app-pages.enum';
import type {DfrntPageViewModel} from '../../interfaces/dfrnt-page-view-model.interface';
import {DispatchPage, type DispatchLayoutBridge} from '../pages/dispatch/DispatchPage';
import {createDefaultDispatchLayout, createDispatchBoxes} from '../pages/dispatch/lib/boxDefinitions';
import {
    DATE_FILTER_KEY,
    DRIVER_LOCATION_REFRESH_KEY,
    REFRESH_INTERVAL_KEY,
    TASK_REFRESH_KEY,
    loadDateFilter,
} from '../pages/dispatch/lib/dispatchFilters';
import {useCustomizePanelsDialog} from '../hooks/useCustomizePanelsDialog';
import {useDashboardSettings} from '../hooks/useDashboardSettings';
import {useDateFilter} from '../hooks/useDateFilter';
import {useLayoutToolbar} from '../hooks/useLayoutToolbar';
import {useResetLayout} from '../hooks/useResetLayout';
import {getSession} from '../session';
import {toastService} from '../services/toastService';
import {showPageToast} from './pageToasts';
import {requireDialog} from '../dialogs/dialogRegistry';

const DEFAULT_TIME_ZONE = 'New Zealand Standard Time';

export interface DispatchScreenProps {
    /** The route parses the `jobId` query param and supplies it (react-router is not wired yet). */
    deepLinkJobId?: number;
}

export const DispatchScreen: React.FC<DispatchScreenProps> = ({deepLinkJobId}) => {
    const session = getSession();
    const isUsCustomer = session.isUsCustomer ?? false;
    const timeZone = session.timeZone || DEFAULT_TIME_ZONE;
    const {contactId} = session;

    const bridgeRef = useRef<DispatchLayoutBridge | null>(null);
    const [views, setViews] = useState<DfrntPageViewModel[]>([]);
    const [viewsInitialized, setViewsInitialized] = useState(false);
    const [columnEditMode, setColumnEditMode] = useState(false);

    const storageKeys = useMemo<LayoutStorageKeys>(() => ({
        layoutsKey: `layoutV2-${contactId}`,
        lastActiveLayoutKey: `lastActiveLayoutV2-${contactId}`,
        boxVisibilityKeyBase: `boxVisibilityV2-${AppPage.Dispatch}-${contactId}`,
    }), [contactId]);
    const defaultLayout = useMemo(() => createDefaultDispatchLayout(), []);

    const [dateFilter, setDateFilter] = useDateFilter(DATE_FILTER_KEY, loadDateFilter);
    const dateFilterRef = useRef(dateFilter);
    dateFilterRef.current = dateFilter;

    const pushFilters = useCallback(() => {
        const {startDate, endDate, useTime} = dateFilterRef.current;
        bridgeRef.current?.updateFilters({startDate, endDate, useTime});
    }, []);

    const layoutToolbar = useLayoutToolbar({
        getBridge: () => {
            const bridge = bridgeRef.current;
            return bridge ? {...bridge, reloadLayoutsFromStorage: bridge.reloadFromStorage} : undefined;
        },
        storageKeys,
        defaultLayout,
    });

    const {openSettings} = useDashboardSettings({
        title: 'Dispatch Dashboard Settings',
        intervalKeys: {jobs: REFRESH_INTERVAL_KEY, driverLocations: DRIVER_LOCATION_REFRESH_KEY, tasks: TASK_REFRESH_KEY},
        showCourierDisplayMode: true,
        isUsCustomer,
        onRefreshIntervals: (intervals) => bridgeRef.current?.updateRefreshIntervals(intervals),
        onCourierDisplayMode: (mode) => bridgeRef.current?.updateCourierDisplayMode(mode),
    });

    const {openCustomizePanels} = useCustomizePanelsDialog({
        storageKeys,
        createBoxes: createDispatchBoxes,
        currentLayoutName: layoutToolbar.currentLayoutName,
        onVisibilityChanged: () => bridgeRef.current?.reloadFromStorage(),
    });

    const {resetLayout} = useResetLayout({
        currentLayoutName: layoutToolbar.currentLayoutName,
        resetCurrentLayout: () => bridgeRef.current?.resetCurrentLayout(),
    });

    // The page may report its bridge before or after the first date change; the ref buffers the latest filter.
    const handleBridgeReady = useCallback((bridge: DispatchLayoutBridge) => {
        bridgeRef.current = bridge;
        bridge.registerViewsListener((next) => {
            setViews(next);
            setViewsInitialized(true);
        });
        pushFilters();
    }, [pushFilters]);

    const handleExitColumnEditMode = useCallback(() => {
        setColumnEditMode(false);
        bridgeRef.current?.setColumnEditMode(false);
    }, []);

    const toggleColumnEditMode = () => {
        const next = !columnEditMode;
        setColumnEditMode(next);
        bridgeRef.current?.setColumnEditMode(next);
    };

    const createNewJob = async () => {
        const dialog = await requireDialog('CreateJob');
        if (!dialog) return;
        try {
            const newJobId = await dialog.open(isUsCustomer);
            if (newJobId) bridgeRef.current?.jobCreated(newJobId);
        } catch (err) {
            console.error('[dispatch] create job dialog error', err);
        }
    };

    const refreshDateFilter = (next: DateFilterData) => {
        const value = {startDate: next.startDate, endDate: next.endDate, useTime: next.useTime ?? false};
        dateFilterRef.current = value;
        setDateFilter(value);
        pushFilters();
    };

    const toolbarActions: ToolbarActionsConfig = {
        settings: {onClick: () => void openSettings()},
        views: {
            items: views,
            loading: !viewsInitialized,
            onToggleView: (view) => bridgeRef.current?.setViewSelection(
                views.filter(v => v.selected !== (v.id === view.id)).map(v => v.id),
            ),
            onClearAll: () => bridgeRef.current?.setViewSelection([]),
        },
        layouts: {
            items: layoutToolbar.layouts,
            currentLayoutName: layoutToolbar.currentLayoutName,
            onSaveLayout: () => void layoutToolbar.saveLayout(),
            onLoadLayout: layoutToolbar.loadLayout,
            onDeleteLayout: (index) => void layoutToolbar.deleteLayout(index),
            onRenameLayout: (index) => void layoutToolbar.renameLayout(index),
            onImportLayouts: layoutToolbar.importLayouts,
            onCustomizePanels: () => void openCustomizePanels(),
            onResetLayout: resetLayout,
            columnEditMode,
            onToggleColumnEditMode: toggleColumnEditMode,
        },
        dateFilter: {data: dateFilter, appPage: 'home', timeZone, onRefreshData: refreshDateFilter},
        actionsMenu: {
            onCreateNewJob: () => void createNewJob(),
            onInterCourierCharge: () => bridgeRef.current?.openInterCourierCharge(),
        },
    };

    return (
        <PageFrame section="Dashboards" title="Dispatch" toolbarActions={toolbarActions}>
            <ErrorBoundary>
                <DispatchPage
                    showToast={showPageToast}
                    isUsCustomer={isUsCustomer}
                    timeZone={timeZone}
                    deepLinkJobId={deepLinkJobId}
                    onExitColumnEditMode={handleExitColumnEditMode}
                    onLayoutBridgeReady={handleBridgeReady}
                />
            </ErrorBoundary>
        </PageFrame>
    );
};
