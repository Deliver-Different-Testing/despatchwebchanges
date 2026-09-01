/**
 * Recurring Jobs Context Menu Component
 *
 * Right-click context menu for recurring job actions. Surfaces:
 *  - Add Pickup / Delivery Stop (always)
 *  - Insert to live (Manual-mode rows only — opens the date+scope modal)
 *  - Mode transitions tailored to the row's current RecurringMode:
 *      Active   → Move to Manual, Deactivate
 *      Manual   → Insert to live, Activate, Deactivate
 *      Inactive → Activate, Move to Manual
 */

import React from 'react';
import {Menu} from '@mantine/core';
import {Hammer, MapPin, Play, PlayCircle, Square} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {PrebookListModel, RecurringMode} from '../../../interfaces';

export interface RecurringJobsContextMenuProps {
    anchorPosition: { x: number; y: number } | null;
    job: PrebookListModel | null;
    onClose: () => void;
    onAddPickupStop: (job: PrebookListModel) => void;
    onAddDeliveryStop: (job: PrebookListModel) => void;
    onInsertToLive?: (job: PrebookListModel) => void;
    onSetMode?: (job: PrebookListModel, mode: RecurringMode) => void;
}

export const RecurringJobsContextMenu: React.FC<RecurringJobsContextMenuProps> = ({
                                                                                      anchorPosition,
                                                                                      job,
                                                                                      onClose,
                                                                                      onAddPickupStop,
                                                                                      onAddDeliveryStop,
                                                                                      onInsertToLive,
                                                                                      onSetMode,
                                                                                  }) => {
    const handleAddPickupStop = () => {
        if (job) {
            onAddPickupStop(job);
        }
        onClose();
    };

    const handleAddDeliveryStop = () => {
        if (job) {
            onAddDeliveryStop(job);
        }
        onClose();
    };

    const handleInsertToLive = () => {
        if (job && onInsertToLive) {
            onInsertToLive(job);
        }
        onClose();
    };

    const handleSetMode = (mode: RecurringMode) => {
        if (job && onSetMode) {
            onSetMode(job, mode);
        }
        onClose();
    };

    const currentMode = job?.recurringMode;
    const isActive = currentMode === RecurringMode.Active;
    const isManual = currentMode === RecurringMode.Manual;
    const isInactive = currentMode === RecurringMode.Inactive;
    // Insert-to-live only initiates from a parent (or standalone)
    // booking — the backend SP fans the family out from the parent's
    // ucbkID, so pushing a child in isolation isn't a supported flow.
    const isChild = job?.isChild === true;

    const opened = anchorPosition !== null && job !== null;

    return (
        // closeOnItemClick is off because every handler below already calls
        // onClose(); leaving it on fires the callback twice per click.
        <Menu
            opened={opened}
            onClose={onClose}
            closeOnItemClick={false}
            position="bottom-start"
            withinPortal
            shadow="md"
            width={200}
        >
            {/*
              * MUI positioned this menu with anchorReference="anchorPosition".
              * Mantine anchors to its own Target, so the target is a zero-size
              * element parked at the pointer — it renders nothing visible and
              * exists only to give the dropdown somewhere to attach.
              */}
            <Menu.Target>
                <div
                    aria-hidden
                    style={{
                        position: 'fixed',
                        top: anchorPosition?.y ?? 0,
                        left: anchorPosition?.x ?? 0,
                        width: 0,
                        height: 0,
                    }}
                />
            </Menu.Target>

            <Menu.Dropdown>
                <Menu.Item
                    onClick={handleAddPickupStop}
                    leftSection={<Icon lucide={MapPin} size={16} color="var(--mantine-color-green-6)" data-stop-icon="pickup"/>}
                >
                    Add Pickup Stop
                </Menu.Item>
                <Menu.Item
                    onClick={handleAddDeliveryStop}
                    leftSection={<Icon lucide={MapPin} size={16} color="var(--mantine-color-red-6)" data-stop-icon="delivery"/>}
                >
                    Add Delivery Stop
                </Menu.Item>

                {isManual && !isChild && onInsertToLive && (
                    <>
                        <Menu.Divider/>
                        <Menu.Item
                            onClick={handleInsertToLive}
                            leftSection={<Icon lucide={PlayCircle} size={16} color="var(--mantine-color-yellow-6)"/>}
                        >
                            Insert to live...
                        </Menu.Item>
                    </>
                )}

                {onSetMode && currentMode !== undefined && (
                    <>
                        <Menu.Divider/>
                        {!isActive && (
                            <Menu.Item
                                onClick={() => handleSetMode(RecurringMode.Active)}
                                leftSection={<Icon lucide={Play} size={16} color="var(--mantine-color-green-6)"/>}
                            >
                                Activate
                            </Menu.Item>
                        )}
                        {!isManual && (
                            <Menu.Item
                                onClick={() => handleSetMode(RecurringMode.Manual)}
                                leftSection={<Icon lucide={Hammer} size={16} color="var(--mantine-color-yellow-6)"/>}
                            >
                                Move to Manual
                            </Menu.Item>
                        )}
                        {!isInactive && (
                            <Menu.Item
                                onClick={() => handleSetMode(RecurringMode.Inactive)}
                                leftSection={<Icon lucide={Square} size={16} color="var(--mantine-color-gray-6)"/>}
                            >
                                Deactivate
                            </Menu.Item>
                        )}
                    </>
                )}
            </Menu.Dropdown>
        </Menu>
    );
};

export default RecurringJobsContextMenu;
