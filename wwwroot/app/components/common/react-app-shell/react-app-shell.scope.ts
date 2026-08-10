import angular from "angular";

export interface ReactAppShellScope extends angular.IScope {
    title: string;
    section?: string;
    beta?: boolean;
    messagesCount?: number;
    onMessagesClick?: (event: { $event: MouseEvent }) => void;
    views?: any[];
    viewsLoading?: boolean;
    onToggleView?: (args: { view: any }) => void;
    onClearAllViews?: () => void;
    layouts?: any[];
    currentLayoutName?: string;
    onSaveLayout?: () => void;
    onLoadLayout?: (args: { index: number }) => void;
    onDeleteLayout?: (args: { index: number }) => void;
    onRenameLayout?: (args: { index: number }) => void;
    onImportLayouts?: () => void;
    onCustomizePanels?: () => void;
    onResetLayout?: () => void;
    columnEditMode?: boolean;
    onToggleColumnEditMode?: () => void;
    onSettingsClick?: (event: { $event: MouseEvent }) => void;
    onRefreshClick?: () => void;
    refreshLoading?: boolean;
    // Date filter
    dateFilterData?: any;
    appPage?: string;
    onDateFilterRefresh?: (args: { dateFilterData: any }) => void;
    // Actions menu
    onCreateNewJob?: (event: { $event: MouseEvent }) => void;
    onInterCourierCharge?: (event: { $event: MouseEvent }) => void;
}