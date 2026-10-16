import React from 'react';
import {
    MessagesButton,
    RefreshButton,
    SettingsButton,
    ViewsMenu,
    LayoutsMenu,
    DateFilterMenu,
    ActionsMenu,
    View,
    Layout,
    DateFilterData,
} from '../app-toolbar/ToolbarActions';
import {ToolbarActionsBar, ToolbarActionItem} from '../app-toolbar/ToolbarActionsBar';
import {MessageSquare, RefreshCw, Settings as SettingsGlyph} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {PartnerApprovalsBadge} from '../../../pages/partner-approvals/PartnerApprovalsBadge';

export interface ToolbarActionsConfig {
    // Messages
    messages?: {
        unreadCount: number;
        onClick: (event: React.MouseEvent) => void;
    };
    // Refresh
    refresh?: {
        onClick: () => void;
        loading?: boolean;
    };
    // Settings
    settings?: {
        onClick: (event: React.MouseEvent) => void;
    };
    // Views Menu
    views?: {
        items: View[] | null;
        loading?: boolean;
        onToggleView: (view: View) => void;
        onClearAll: () => void;
    };
    // Layouts Menu
    layouts?: {
        items: Layout[];
        currentLayoutName?: string;
        onSaveLayout: () => void;
        onLoadLayout: (index: number) => void;
        onDeleteLayout: (index: number) => void;
        onRenameLayout?: (index: number) => void;
        onImportLayouts?: () => void;
        onCustomizePanels?: () => void;
        onResetLayout?: () => void;
        columnEditMode?: boolean;
        onToggleColumnEditMode?: () => void;
    };
    // Date Filter - React component
    dateFilter?: {
        data: DateFilterData | null;
        appPage?: string;
        timeZone?: string;
        onRefreshData: (dateFilterData: DateFilterData) => void;
        onShowToast?: (message: string, type: 'success' | 'warning' | 'error') => void;
    };
    // Actions Menu (Add New Job, Inter-Courier Charge)
    actionsMenu?: {
        onCreateNewJob: (event: React.MouseEvent) => void;
        onInterCourierCharge: (event: React.MouseEvent) => void;
    };
    // Partner approvals badge — global feed of pending inter-tenant change
    // requests this user must review. Always shown when present; the badge
    // hides its count when the inbox is empty.
    partnerApprovals?: {
        enabled: boolean;
        onOpenJob?: (jobId: number, jobNo: string) => void;
    };
    // Custom children (for any other content)
    customContent?: React.ReactNode;
}

/**
 * Builds toolbar children from actions config
 */
export function buildToolbarChildren(toolbarActions: ToolbarActionsConfig | null | undefined): React.ReactNode {
    if (!toolbarActions) return null;

    // Ordered left→right. Items with an `overflow` descriptor collapse into the
    // "More" menu on narrow viewports; dropdown-menu actions stay inline.
    const items: ToolbarActionItem[] = [];

    // Actions menu (Add New Job, Inter-Courier Charge)
    if (toolbarActions.actionsMenu) {
        items.push({
            key: 'actionsMenu',
            node: (
                <ActionsMenu
                    onCreateNewJob={toolbarActions.actionsMenu.onCreateNewJob}
                    onInterCourierCharge={toolbarActions.actionsMenu.onInterCourierCharge}
                />
            ),
        });
    }

    // Messages button
    if (toolbarActions.messages) {
        const {unreadCount, onClick} = toolbarActions.messages;
        items.push({
            key: 'messages',
            node: <MessagesButton unreadCount={unreadCount} onClick={onClick}/>,
            overflow: {
                label: unreadCount > 0 ? `Messages (${unreadCount > 99 ? '99+' : unreadCount})` : 'Messages',
                icon: <Icon lucide={MessageSquare} size={16}/>,
                onSelect: (event) => onClick(event),
            },
        });
    }

    // Partner approvals badge — drawer-based inbox of pending change
    // requests this user must approve. The query cache comes from the
    // shell's own provider stack.
    if (toolbarActions.partnerApprovals?.enabled) {
        const onOpenJob = toolbarActions.partnerApprovals.onOpenJob;
        items.push({
            key: 'partnerApprovals',
            node: (
                <PartnerApprovalsBadge
                    toolbarVariant
                    onOpenJob={onOpenJob}
                />
            ),
        });
    }

    // Date filter menu
    if (toolbarActions.dateFilter) {
        items.push({
            key: 'dateFilter',
            node: (
                <DateFilterMenu
                    dateFilterData={toolbarActions.dateFilter.data}
                    appPage={toolbarActions.dateFilter.appPage}
                    timeZone={toolbarActions.dateFilter.timeZone}
                    onRefreshData={toolbarActions.dateFilter.onRefreshData}
                    onShowToast={toolbarActions.dateFilter.onShowToast}
                />
            ),
        });
    }

    // Views menu
    if (toolbarActions.views) {
        items.push({
            key: 'views',
            node: (
                <ViewsMenu
                    views={toolbarActions.views.items}
                    loading={toolbarActions.views.loading}
                    onToggleView={toolbarActions.views.onToggleView}
                    onClearAll={toolbarActions.views.onClearAll}
                />
            ),
        });
    }

    // Layouts menu
    if (toolbarActions.layouts) {
        items.push({
            key: 'layouts',
            node: (
                <LayoutsMenu
                    layouts={toolbarActions.layouts.items}
                    currentLayoutName={toolbarActions.layouts.currentLayoutName}
                    onSaveLayout={toolbarActions.layouts.onSaveLayout}
                    onLoadLayout={toolbarActions.layouts.onLoadLayout}
                    onDeleteLayout={toolbarActions.layouts.onDeleteLayout}
                    onRenameLayout={toolbarActions.layouts.onRenameLayout}
                    onImportLayouts={toolbarActions.layouts.onImportLayouts}
                    onCustomizePanels={toolbarActions.layouts.onCustomizePanels}
                    onResetLayout={toolbarActions.layouts.onResetLayout}
                    columnEditMode={toolbarActions.layouts.columnEditMode}
                    onToggleColumnEditMode={toolbarActions.layouts.onToggleColumnEditMode}
                />
            ),
        });
    }

    // Refresh button
    if (toolbarActions.refresh) {
        const {onClick, loading} = toolbarActions.refresh;
        items.push({
            key: 'refresh',
            node: <RefreshButton onClick={onClick} loading={loading}/>,
            overflow: {
                label: loading ? 'Refreshing…' : 'Refresh',
                icon: <Icon lucide={RefreshCw} size={16}/>,
                onSelect: () => onClick(),
            },
        });
    }

    // Settings button
    if (toolbarActions.settings) {
        const {onClick} = toolbarActions.settings;
        items.push({
            key: 'settings',
            node: <SettingsButton onClick={onClick}/>,
            overflow: {
                label: 'Settings',
                icon: <Icon lucide={SettingsGlyph} size={16}/>,
                onSelect: (event) => onClick(event),
            },
        });
    }

    // Custom content
    if (toolbarActions.customContent) {
        items.push({
            key: 'custom',
            node: <>{toolbarActions.customContent}</>,
        });
    }

    return items.length > 0 ? <ToolbarActionsBar actions={items}/> : null;
}

