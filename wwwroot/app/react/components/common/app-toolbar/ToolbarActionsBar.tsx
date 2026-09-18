/**
 * ToolbarActionsBar
 *
 * Renders the app-bar trailing actions and, on narrow viewports, collapses the
 * lower-priority "simple" actions into a Material Design overflow ("More") menu.
 * Actions that are themselves dropdown menus (Views, Layouts, Date filter, …)
 * stay inline — they're the primary surfaces and can't be flattened into a
 * single menu item — so only actions that supply an `overflow` descriptor move.
 *
 * Compact mode is derived from the viewport via `useMediaQuery` (deterministic
 * and easy to test). A ResizeObserver-measured variant was considered but the
 * self-contained dropdown triggers make width measurement fragile; the
 * breakpoint approach matches MD3's "collapse at smaller window sizes" guidance.
 */

import React from 'react';
import {ActionIcon, Group, Menu, Tooltip, em} from '@mantine/core';
import {useMediaQuery} from '@mantine/hooks';
import {EllipsisVertical} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {toolbarIconButtonStyle} from './ToolbarActions';

export interface ToolbarOverflowEntry {
    label: string;
    icon?: React.ReactNode;
    onSelect: (event: React.MouseEvent) => void;
}

export interface ToolbarActionItem {
    key: string;
    /** Inline rendering (the existing icon button / menu component). */
    node: React.ReactNode;
    /**
     * When provided, this action collapses into the overflow menu in compact
     * mode. Omit for actions that must always stay inline (e.g. dropdown menus).
     */
    overflow?: ToolbarOverflowEntry;
}

export interface ToolbarActionsBarProps {
    actions: ToolbarActionItem[];
    /** Force compact mode (testing/stories). Otherwise derived from viewport width. */
    compact?: boolean;
}

/** Collapse below Mantine's `sm` (48em/768px) — the tablet-portrait threshold. */
const COMPACT_QUERY = `(max-width: ${em(768)})`;

export const ToolbarActionsBar: React.FC<ToolbarActionsBarProps> = ({actions, compact}) => {
    const isNarrow = useMediaQuery(COMPACT_QUERY);
    const compactMode = compact ?? isNarrow ?? false;

    const inlineItems = compactMode ? actions.filter(a => !a.overflow) : actions;
    const overflowItems = compactMode
        ? actions.filter((a): a is ToolbarActionItem & {overflow: ToolbarOverflowEntry} => !!a.overflow)
        : [];

    return (
        <Group gap={8} wrap="nowrap">
            {inlineItems.map(item => (
                <React.Fragment key={item.key}>{item.node}</React.Fragment>
            ))}

            {overflowItems.length > 0 && (
                <Menu position="bottom-end" offset={4} width={200} shadow="md">
                    <Menu.Target>
                        <Tooltip label="More actions">
                            <ActionIcon
                                variant="subtle"
                                size="lg"
                                radius="xl"
                                aria-label="More actions"
                                style={toolbarIconButtonStyle}
                            >
                                <Icon lucide={EllipsisVertical} size={18} />
                            </ActionIcon>
                        </Tooltip>
                    </Menu.Target>
                    <Menu.Dropdown>
                        {overflowItems.map(item => (
                            <Menu.Item
                                key={item.key}
                                leftSection={item.overflow.icon}
                                onClick={(event) => item.overflow.onSelect(event)}
                            >
                                {item.overflow.label}
                            </Menu.Item>
                        ))}
                    </Menu.Dropdown>
                </Menu>
            )}
        </Group>
    );
};

export default ToolbarActionsBar;
