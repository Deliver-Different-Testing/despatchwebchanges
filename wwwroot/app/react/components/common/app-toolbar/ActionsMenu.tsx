/**
 * Actions Menu Component
 *
 * A dropdown menu for quick actions like creating new jobs
 * and inter-courier charges. Follows existing ToolbarActions patterns.
 */

import React from 'react';
import {ActionIcon, Menu, Tooltip} from '@mantine/core';
import {DollarSign, Plus} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {toolbarIconButtonStyle} from './ToolbarActions';

export interface ActionsMenuProps {
    onCreateNewJob: (event: React.MouseEvent) => void;
    onInterCourierCharge: (event: React.MouseEvent) => void;
}

export const ActionsMenu: React.FC<ActionsMenuProps> = ({
    onCreateNewJob,
    onInterCourierCharge,
}) => {
    return (
        <Menu position="bottom-end" offset={4} width={200} shadow="md">
            <Menu.Target>
                <Tooltip label="Actions">
                    <ActionIcon
                        variant="subtle"
                        size="lg"
                        style={toolbarIconButtonStyle}
                        aria-label="Actions menu"
                    >
                        <Icon lucide={Plus} size={18} />
                    </ActionIcon>
                </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Item leftSection={<Icon lucide={Plus} size={16} />} onClick={onCreateNewJob}>
                    Add New Job
                </Menu.Item>
                <Menu.Item leftSection={<Icon lucide={DollarSign} size={16} />} onClick={onInterCourierCharge}>
                    Inter-Courier Charge
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
};

export default ActionsMenu;
