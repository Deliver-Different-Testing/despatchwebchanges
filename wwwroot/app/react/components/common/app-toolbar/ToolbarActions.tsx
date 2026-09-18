/**
 * React Toolbar Action Components
 *
 * Toolbar action buttons and menus for the Ink-Blue app bar. Every button is a
 * 34px circle with the shared cyan hover wash — see `toolbarIconStyles`.
 */

import React from 'react';
import {
    ActionIcon,
    Box,
    Button,
    Divider,
    Group,
    Indicator,
    Loader,
    Menu,
    Popover,
    Text,
    Tooltip,
    UnstyledButton,
} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import {
    Check,
    Columns3,
    Download,
    Eye,
    EyeOff,
    FilePen,
    LayoutGrid,
    ListX,
    MessageSquare,
    Plus,
    RefreshCw,
    RotateCcw,
    Settings,
    Trash2,
} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {
    badgeOverflowStyle,
    SHELL_ICON_HOVER_FILL,
    toolbarIconButtonStyle,
} from './toolbarIconStyles';
import classes from './LayoutsMenu.module.css';

// Re-export DateFilterMenu
export {DateFilterMenu} from '../date-filter-menu/DateFilterMenu';
export type {DateFilterData, DateFilterMenuProps, DateRangeOption} from '../date-filter-menu/DateFilterMenu';

// Re-export ActionsMenu
export {ActionsMenu} from './ActionsMenu';
export type {ActionsMenuProps} from './ActionsMenu';

// Re-exported so the existing import sites keep working now the tokens live in a leaf module.
export {badgeOverflowStyle, SHELL_ICON_HOVER_FILL, toolbarIconButtonStyle};

/** Glyph size shared by the toolbar's icon buttons. */
const TOOLBAR_ICON_SIZE = 18;

/** Menu/popover row height and dropdown offset, matching the old MUI chrome. */
const DROPDOWN_OFFSET = 4;

// Messages Button
export interface MessagesButtonProps {
    unreadCount: number;
    onClick: (event: React.MouseEvent) => void;
}

export const MessagesButton: React.FC<MessagesButtonProps> = ({unreadCount, onClick}) => {
    const displayCount = unreadCount > 99 ? '99+' : unreadCount;

    return (
        <Tooltip label="Messages">
            <ActionIcon
                variant="subtle"
                size="lg"
                radius="xl"
                onClick={onClick}
                style={{...toolbarIconButtonStyle, ...badgeOverflowStyle}}
                aria-label="Messages"
            >
                <Indicator
                    label={unreadCount > 0 ? displayCount : undefined}
                    disabled={unreadCount === 0}
                    color="red"
                    size={18}
                    offset={2}
                >
                    <Icon lucide={MessageSquare} size={TOOLBAR_ICON_SIZE} />
                </Indicator>
            </ActionIcon>
        </Tooltip>
    );
};

// Refresh Button
export interface RefreshButtonProps {
    onClick: () => void;
    loading?: boolean;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({onClick, loading = false}) => {
    return (
        <Tooltip label={loading ? 'Refreshing...' : 'Refresh'}>
            {/* span wrapper so the tooltip still works while the button is disabled */}
            <span>
                <ActionIcon
                    variant="subtle"
                    size="lg"
                    radius="xl"
                    onClick={onClick}
                    disabled={loading}
                    style={toolbarIconButtonStyle}
                    aria-label="Refresh"
                >
                    {loading ? (
                        <Loader size={TOOLBAR_ICON_SIZE} color="currentColor" role="progressbar" aria-label="Refreshing" />
                    ) : (
                        <Icon lucide={RefreshCw} size={TOOLBAR_ICON_SIZE} />
                    )}
                </ActionIcon>
            </span>
        </Tooltip>
    );
};

// Settings Button
export interface SettingsButtonProps {
    onClick: (event: React.MouseEvent) => void;
}

export const SettingsButton: React.FC<SettingsButtonProps> = ({onClick}) => {
    return (
        <Tooltip label="Settings">
            <ActionIcon variant="subtle" size="lg" radius="xl" onClick={onClick} style={toolbarIconButtonStyle} aria-label="Settings">
                <Icon lucide={Settings} size={TOOLBAR_ICON_SIZE} />
            </ActionIcon>
        </Tooltip>
    );
};

// Views Menu
export interface View {
    id: number;
    name: string;
    selected: boolean;
}

export interface ViewsMenuProps {
    views: View[] | null;
    loading?: boolean;
    onToggleView: (view: View) => void;
    onClearAll: () => void;
}

export const ViewsMenu: React.FC<ViewsMenuProps> = ({
    views,
    loading = false,
    onToggleView,
    onClearAll,
}) => {
    const selectedCount = views?.filter(v => v.selected).length || 0;

    return (
        <Menu position="bottom-end" offset={DROPDOWN_OFFSET} width={220} shadow="md">
            <Menu.Target>
                <Tooltip label="Views">
                    <ActionIcon
                        variant="subtle"
                        size="lg"
                        radius="xl"
                        style={{...toolbarIconButtonStyle, ...badgeOverflowStyle}}
                        aria-label="Views"
                    >
                        {/*
                          * The Indicator carries no `c`: style props land on its root, which
                          * wraps the glyph, so a colour there leaks onto the eye through
                          * currentColor and puts it out of step with the rest of the bar. The
                          * badge digits come from the theme's `autoContrast` against the pill.
                          */}
                        {loading ? (
                            <Loader size={TOOLBAR_ICON_SIZE} color="currentColor" role="progressbar" aria-label="Loading views" />
                        ) : (
                            <Indicator
                                label={selectedCount > 0 ? selectedCount : undefined}
                                disabled={selectedCount === 0}
                                color="gray.0"
                                size={16}
                                offset={2}
                            >
                                <Icon lucide={Eye} size={TOOLBAR_ICON_SIZE} />
                            </Indicator>
                        )}
                    </ActionIcon>
                </Tooltip>
            </Menu.Target>
            <Menu.Dropdown mah={400} style={{overflowY: 'auto'}}>
                {(!views || views.length === 0) ? (
                    <Box p="lg" ta="center">
                        <Icon lucide={EyeOff} size={40} color="var(--mantine-color-gray-5)" />
                        <Text fz="sm" c="dimmed" mt="xs">No views available</Text>
                    </Box>
                ) : (
                    <>
                        {selectedCount > 0 && (
                            <>
                                <Group justify="space-between" align="center" px="sm" py={4} wrap="nowrap">
                                    <Text fz="xs" c="dimmed">{selectedCount} selected</Text>
                                    <Button
                                        variant="subtle"
                                        size="compact-xs"
                                        leftSection={<Icon lucide={ListX} size={14} />}
                                        onClick={onClearAll}
                                        aria-label="Clear selected views"
                                    >
                                        Clear
                                    </Button>
                                </Group>
                                <Menu.Divider />
                            </>
                        )}
                        {views.map((view) => (
                            <Menu.CheckboxItem
                                key={view.id}
                                checked={view.selected}
                                closeMenuOnClick={false}
                                onChange={() => onToggleView(view)}
                            >
                                <Text fz="sm" style={{fontWeight: view.selected ? 500 : 400}}>{view.name}</Text>
                            </Menu.CheckboxItem>
                        ))}
                    </>
                )}
            </Menu.Dropdown>
        </Menu>
    );
};

// Layouts Menu
export interface Layout {
    name: string;
}

export interface LayoutsMenuProps {
    layouts: Layout[];
    currentLayoutName?: string;
    onSaveLayout: () => void;
    onLoadLayout: (index: number) => void;
    onDeleteLayout: (index: number) => void;
    /** Optional: rename a custom layout. When provided, a rename control appears on each custom row. */
    onRenameLayout?: (index: number) => void;
    /** Optional: copy the user's legacy (V1) layouts into this page's store. */
    onImportLayouts?: () => void;
    /** Optional: opens the panel-visibility and column-count settings. */
    onCustomizePanels?: () => void;
    /** Optional: restore the current layout to the shipped arrangement. */
    onResetLayout?: () => void;
    /** Optional: whether the "Edit columns" bar is currently shown. */
    columnEditMode?: boolean;
    /** Optional: toggle the "Edit columns" bar. When provided, an Edit/Done item is shown. */
    onToggleColumnEditMode?: () => void;
}

const DEFAULT_LAYOUT_NAME = 'Default';

/**
 * A full-width row in the layouts popover, styled like a menu item. Forwards its
 * ref so a `<Tooltip>` can explain a disabled row (Mantine positions against the
 * child's DOM node).
 */
const PopoverRow = React.forwardRef<HTMLButtonElement, {
    onClick: () => void;
    disabled?: boolean;
    icon?: React.ReactNode;
    children: React.ReactNode;
}>(({onClick, disabled = false, icon, children}, ref) => (
    <UnstyledButton
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        w="100%"
        px="sm"
        py={6}
        style={{
            borderRadius: 'var(--mantine-radius-sm)',
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
        }}
    >
        <Group gap={10} wrap="nowrap">
            <Box w={20} style={{display: 'flex'}}>{icon}</Box>
            <Text fz="sm">{children}</Text>
        </Group>
    </UnstyledButton>
));
PopoverRow.displayName = 'PopoverRow';

export const LayoutsMenu: React.FC<LayoutsMenuProps> = ({
    layouts,
    currentLayoutName,
    onSaveLayout,
    onLoadLayout,
    onDeleteLayout,
    onRenameLayout,
    onImportLayouts,
    onCustomizePanels,
    onResetLayout,
    columnEditMode,
    onToggleColumnEditMode,
}) => {
    // `close` keeps the `handleClose` name the save/cancel handlers already call.
    const [opened, {close: handleClose, toggle}] = useDisclosure(false);

    const handleSave = () => {
        onSaveLayout();
        handleClose();
    };

    const handleLoad = (index: number) => {
        onLoadLayout(index);
        handleClose();
    };

    const handleDelete = (event: React.MouseEvent, index: number) => {
        // Keep the row's load action from firing; the confirmation dialog
        // owns the actual deletion.
        event.stopPropagation();
        onDeleteLayout(index);
    };

    const handleRename = (event: React.MouseEvent, index: number) => {
        // Keep the row's load action from firing; the rename dialog owns the change.
        event.stopPropagation();
        onRenameLayout?.(index);
        handleClose();
    };

    const handleCustomize = () => {
        onCustomizePanels?.();
        handleClose();
    };

    const handleToggleColumnEditMode = () => {
        onToggleColumnEditMode?.();
        handleClose();
    };

    const handleResetLayout = () => {
        onResetLayout?.();
        handleClose();
    };

    const handleImportLayouts = () => {
        onImportLayouts?.();
        handleClose();
    };

    // The Default layout is read-only, so the editing entries are shown disabled with
    // the reason rather than silently doing nothing. An absent name means Default too.
    const isDefaultLayout = !currentLayoutName || currentLayoutName === DEFAULT_LAYOUT_NAME;
    const editDisabledReason = 'The Default layout is read-only — save a layout of your own first';
    const tooltip = currentLayoutName ? `Layouts · ${currentLayoutName}` : 'Layouts';

    return (
        <Popover
            opened={opened}
            onDismiss={handleClose}
            position="bottom-end"
            offset={DROPDOWN_OFFSET}
            width={240}
            shadow="md"
            radius="sm"
        >
            <Popover.Target>
                <Tooltip label={tooltip}>
                    <ActionIcon
                        variant="subtle"
                        size="lg"
                        radius="xl"
                        onClick={toggle}
                        style={toolbarIconButtonStyle}
                        aria-label="Layouts"
                    >
                        <Icon lucide={LayoutGrid} size={TOOLBAR_ICON_SIZE} />
                    </ActionIcon>
                </Tooltip>
            </Popover.Target>
            <Popover.Dropdown p={4}>
                <PopoverRow onClick={handleSave} icon={<Icon lucide={Plus} size={16} />}>
                    Add layout
                </PopoverRow>

                {layouts.length > 0 && (
                    <Text px="sm" pt={6} pb={2} fz="xs" fw={600} c="dimmed">
                        Switch layout
                    </Text>
                )}

                {layouts.map((layout, index) => {
                    const isActive = layout.name === currentLayoutName;
                    const isDefault = layout.name === DEFAULT_LAYOUT_NAME;
                    return (
                        <Group key={index} className={classes.row} gap={0} wrap="nowrap">
                            <UnstyledButton
                                onClick={() => handleLoad(index)}
                                px="sm"
                                py={6}
                                style={{flex: 1, borderRadius: 'var(--mantine-radius-sm)'}}
                            >
                                <Group gap={10} wrap="nowrap">
                                    <Box w={20} style={{display: 'flex'}}>
                                        {isActive ? <Icon lucide={Check} size={16} color="var(--mantine-color-brand-7)" /> : null}
                                    </Box>
                                    <Text
                                        fz="sm"
                                        c={isActive ? 'brand.7' : undefined}
                                        style={{fontWeight: isActive ? 600 : 400}}
                                    >
                                        {layout.name}
                                    </Text>
                                </Group>
                            </UnstyledButton>
                            {!isDefault && (
                                <Group gap={0} pr={4} wrap="nowrap">
                                    {onRenameLayout && (
                                        <Tooltip label="Rename layout">
                                            <ActionIcon
                                                className={classes.action}
                                                variant="subtle"
                                                color="gray"
                                                size="sm"
                                                aria-label={`Rename ${layout.name}`}
                                                onClick={(e) => handleRename(e, index)}
                                            >
                                                <Icon lucide={FilePen} size={16} />
                                            </ActionIcon>
                                        </Tooltip>
                                    )}
                                    <Tooltip label="Delete layout">
                                        <ActionIcon
                                            className={classes.action}
                                            variant="subtle"
                                            color="red"
                                            size="sm"
                                            aria-label={`Delete ${layout.name}`}
                                            onClick={(e) => handleDelete(e, index)}
                                        >
                                            <Icon lucide={Trash2} size={16} />
                                        </ActionIcon>
                                    </Tooltip>
                                </Group>
                            )}
                        </Group>
                    );
                })}

                {onToggleColumnEditMode && (
                    <>
                        <Divider my={4} />
                        <Tooltip label={editDisabledReason} disabled={!isDefaultLayout} position="left">
                            <PopoverRow
                                onClick={handleToggleColumnEditMode}
                                disabled={isDefaultLayout}
                                icon={<Icon lucide={columnEditMode ? Check : Columns3} size={16} />}
                            >
                                {columnEditMode ? 'Done editing columns' : 'Edit columns'}
                            </PopoverRow>
                        </Tooltip>
                    </>
                )}

                {onCustomizePanels && (
                    <>
                        <Divider my={4} />
                        <Tooltip label={editDisabledReason} disabled={!isDefaultLayout} position="left">
                            <PopoverRow
                                onClick={handleCustomize}
                                disabled={isDefaultLayout}
                                icon={<Icon lucide={Settings} size={16} />}
                            >
                                Customize panels…
                            </PopoverRow>
                        </Tooltip>
                    </>
                )}

                {onResetLayout && !isDefaultLayout && (
                    <PopoverRow onClick={handleResetLayout} icon={<Icon lucide={RotateCcw} size={16} />}>
                        Reset layout
                    </PopoverRow>
                )}

                {onImportLayouts && (
                    <>
                        <Divider my={4} />
                        <PopoverRow onClick={handleImportLayouts} icon={<Icon lucide={Download} size={16} />}>
                            Import V1 layouts
                        </PopoverRow>
                    </>
                )}
            </Popover.Dropdown>
        </Popover>
    );
};

// Generic Icon Button - for custom toolbar actions
export interface ToolbarIconButtonProps {
    icon: React.ReactNode;
    tooltip: string;
    onClick: (event: React.MouseEvent) => void;
    disabled?: boolean;
}

export const ToolbarIconButton: React.FC<ToolbarIconButtonProps> = ({
    icon,
    tooltip,
    onClick,
    disabled = false,
}) => {
    return (
        <Tooltip label={tooltip}>
            {/* span wrapper so the tooltip still works while the button is disabled */}
            <span>
                <ActionIcon
                    variant="subtle"
                    size="lg"
                    radius="xl"
                    onClick={onClick}
                    disabled={disabled}
                    style={toolbarIconButtonStyle}
                    aria-label={tooltip}
                >
                    {icon}
                </ActionIcon>
            </span>
        </Tooltip>
    );
};
