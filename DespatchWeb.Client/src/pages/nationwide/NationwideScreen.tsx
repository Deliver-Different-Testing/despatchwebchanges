import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {PageFrame} from '../../components/layout/PageFrame';
import {ErrorBoundary} from '../../components/common/error-boundary';
import type {DateFilterData} from '../../components/common/date-filter-menu/DateFilterMenu';
import type {ToolbarActionsConfig} from '../../components/common/app-shell/ToolbarActionsView';
import {AppPage} from '../../types/enums/app-pages.enum';
import type {DfrntPageViewModel} from '../../types/interfaces/dfrnt-page-view-model.interface';
import {useCustomizePanelsDialog} from '../../hooks/useCustomizePanelsDialog';
import {useDashboardSettings} from '../../hooks/useDashboardSettings';
import {useDateFilter} from '../../hooks/useDateFilter';
import {useLayoutToolbar} from '../../hooks/useLayoutToolbar';
import {useResetLayout} from '../../hooks/useResetLayout';
import {NationwidePage} from './NationwidePage';
import type {NationwideLayoutBridge} from './NationwidePageProps';
import {createDefaultNationwideLayout, createNationwideBoxes} from './lib/boxDefinitions';
import {buildRefreshIntervalOptions, resolveSavedInterval} from './lib/refreshInterval';
import {loadDateFilterFrom, type StoredDateFilter} from '../../utils/dateFilterStorage';
import {getSession} from '../../api/session';
import {showPageToast} from '../pageToasts';

const DEFAULT_TIME_ZONE = 'New Zealand Standard Time';

const readSnappedJobsSeconds = (raw: string | null): number =>
    resolveSavedInterval(raw, buildRefreshIntervalOptions())?.id ?? 0;

export interface NationwideScreenProps {
    /** Job to select on mount. The route supplies it from `?jobId` (react-router is not installed yet). */
    deepLinkJobId?: number;
}

export const NationwideScreen: React.FC<NationwideScreenProps> = ({deepLinkJobId}) => {
    const session = getSession();
    const contactId = session.contactId;
    const isUsCustomer = session.isUsCustomer ?? false;
    const timeZone = session.timeZone || DEFAULT_TIME_ZONE;

    const storageKeys = useMemo(() => ({
        layoutsKey: `layoutsNWV2-${contactId}`,
        lastActiveLayoutKey: `lastActiveLayoutNWV2-${contactId}`,
        boxVisibilityKeyBase: `boxVisibilityV2-${AppPage.Domestic}-${contactId}`,
    }), [contactId]);
    const refreshIntervalKey = `refreshInterval-${AppPage.Domestic}-${contactId}`;
    const dateFilterKey = `dateFilter-${AppPage.Domestic}-${contactId}`;
    const defaultLayout = useMemo(createDefaultNationwideLayout, []);

    const [bridge, setBridge] = useState<NationwideLayoutBridge | undefined>();
    const handleBridgeReady = useCallback((next: NationwideLayoutBridge) => setBridge(next), []);

    const layoutBridge = useMemo(() => bridge && {
        setCurrentLayoutName: bridge.setCurrentLayoutName,
        reloadLayoutsFromStorage: bridge.reloadFromStorage,
        promptSaveLayout: bridge.promptSaveLayout,
        promptDeleteLayout: bridge.promptDeleteLayout,
        promptRenameLayout: bridge.promptRenameLayout,
        importLegacyLayouts: bridge.importLegacyLayouts,
    }, [bridge]);

    const layoutToolbar = useLayoutToolbar({getBridge: () => layoutBridge, storageKeys, defaultLayout});

    const [dateFilter, setDateFilter] = useDateFilter(dateFilterKey, () => loadDateFilterFrom(dateFilterKey));
    const refreshDateFilter = useCallback((data: DateFilterData) => {
        const next: StoredDateFilter = {...data, useTime: data.useTime ?? false};
        setDateFilter(next);
        bridge?.updateFilters(next);
    }, [setDateFilter, bridge]);

    const [views, setViews] = useState<DfrntPageViewModel[]>([]);
    const [viewsInitialized, setViewsInitialized] = useState(false);
    useEffect(() => {
        if (!bridge) return;
        // The persisted filter is pushed once per bridge, as the route controller did on mount.
        bridge.updateFilters(dateFilter);
        return bridge.registerViewsListener(next => {
            setViews(next);
            setViewsInitialized(true);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bridge]);

    const {resetLayout} = useResetLayout({
        currentLayoutName: layoutToolbar.currentLayoutName,
        resetCurrentLayout: () => bridge?.resetCurrentLayout(),
    });
    const {openCustomizePanels} = useCustomizePanelsDialog({
        storageKeys,
        createBoxes: createNationwideBoxes,
        currentLayoutName: layoutToolbar.currentLayoutName,
        onVisibilityChanged: () => bridge?.reloadFromStorage(),
    });
    const {openSettings} = useDashboardSettings({
        title: 'Nationwide Dashboard Settings',
        intervalKeys: {jobs: refreshIntervalKey},
        readJobsSeconds: readSnappedJobsSeconds,
        successMessage: 'Settings saved and applied successfully',
        onRefreshIntervals: ({jobsMs}) => bridge?.updateRefreshIntervalMs(jobsMs),
    });

    const toolbarActions: ToolbarActionsConfig = {
        views: {
            items: views,
            loading: !viewsInitialized,
            onToggleView: view => bridge?.setViewSelection(
                views.filter(v => (v.id === view.id ? !v.selected : v.selected)).map(v => v.id),
            ),
            onClearAll: () => bridge?.setViewSelection([]),
        },
        layouts: {
            items: layoutToolbar.layouts,
            currentLayoutName: layoutToolbar.currentLayoutName,
            onSaveLayout: () => void layoutToolbar.saveLayout(),
            onLoadLayout: layoutToolbar.loadLayout,
            onDeleteLayout: index => void layoutToolbar.deleteLayout(index),
            onRenameLayout: index => void layoutToolbar.renameLayout(index),
            onImportLayouts: layoutToolbar.importLayouts,
            onCustomizePanels: () => void openCustomizePanels(),
            onResetLayout: resetLayout,
        },
        settings: {onClick: () => void openSettings()},
        dateFilter: {
            data: dateFilter,
            appPage: 'nationwide',
            onRefreshData: refreshDateFilter,
        },
    };

    return (
        <PageFrame section="Operations" title="Nationwide" toolbarActions={toolbarActions}>
            <ErrorBoundary>
                <NationwidePage
                    showToast={showPageToast}
                    isUsCustomer={isUsCustomer}
                    timeZone={timeZone}
                    deepLinkJobId={deepLinkJobId}
                    onLayoutBridgeReady={handleBridgeReady}
                />
            </ErrorBoundary>
        </PageFrame>
    );
};
