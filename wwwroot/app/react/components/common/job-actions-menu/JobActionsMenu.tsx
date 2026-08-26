/**
 * Job actions menu
 *
 * The overflow (kebab) menu in the Job Detail panel header. Dispatch and Job Search each
 * mirror a different AngularJS `md-fab-speed-dial`, so they own different action lists —
 * but the menu around those lists is the same, and used to be written out twice.
 */

import React from 'react';
import {Menu} from '@mantine/core';
import {EllipsisVertical} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {MuiThemeIsland} from '../mui-interop/MuiThemeIsland';
import {SymbolIcon} from '../symbol-icon';
import {HeaderActionIcon, PANEL_CONTROL_GLYPH_SIZE} from '../panel-controls';
import type {DispatchJob} from '../../../interfaces/dispatchJob';

export interface JobAction<TActionId extends string> {
    id: TActionId;
    label: string;
    /** Material Symbols glyph name. */
    icon: string;
    /** Availability condition, matching the AngularJS `ng-if` the action came from. */
    available: (job: DispatchJob) => boolean;
}

export function JobActionsMenu<TActionId extends string>({actions, currentJob, onAction}: {
    actions: JobAction<TActionId>[];
    currentJob?: DispatchJob;
    onAction?: (actionId: TActionId, job: DispatchJob) => void;
}) {
    if (!currentJob) return null;

    const visibleActions = actions.filter(a => a.available(currentJob));

    return (
        <Menu position="bottom-end" shadow="md" withinPortal>
            <Menu.Target>
                <HeaderActionIcon label="Job actions">
                    <Icon lucide={EllipsisVertical} size={PANEL_CONTROL_GLYPH_SIZE}/>
                </HeaderActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                {/*
                  * `SymbolIcon` is a shared MUI leaf that moves with its other hosts, not
                  * here. `MuiThemeIsland` renders no DOM of its own, so the menu items stay
                  * direct children of the dropdown.
                  */}
                <MuiThemeIsland>
                    {visibleActions.map(action => (
                        <Menu.Item
                            key={action.id}
                            onClick={() => onAction?.(action.id, currentJob)}
                            leftSection={<SymbolIcon name={action.icon} size={20} aria-hidden/>}
                        >
                            {action.label}
                        </Menu.Item>
                    ))}
                </MuiThemeIsland>
            </Menu.Dropdown>
        </Menu>
    );
}
