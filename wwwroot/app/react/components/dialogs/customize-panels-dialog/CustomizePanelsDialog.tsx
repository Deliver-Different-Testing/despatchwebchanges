/**
 * Customize Panels Dialog
 *
 * Dedicated home for dashboard panel visibility, split out of the gear
 * "Dashboard Settings" dialog and reachable via the Layouts menu's
 * "Customize panels…" entry.
 * Follows the canonical job-detail dialog design language (see CLAUDE.md →
 * "Dialog design language").
 */

import React, {useMemo, useState} from 'react';
import {Alert, Box, Group, Paper, Stack, Switch, Text, ThemeIcon} from '@mantine/core';
import {LayoutDashboard, Save} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    dialogSize,
    sectionLabelProps,
    sectionPaperProps,
} from '../shared/mantine';
import type {DashboardBox} from '../dashboard-settings-dialog/DashboardSettingsDialog';
import {SymbolIcon} from '../../common/symbol-icon';

export interface CustomizePanelsDialogProps {
    open: boolean;
    /** Layout name shown as the header subtitle. */
    title?: string;
    boxes: Record<string, DashboardBox>;
    /**
     * False for the read-only Default layout: the toggles are shown disabled with a
     * note, and Save is unavailable. Panel visibility belongs to a user layout.
     */
    layoutEditable?: boolean;
    onClose: () => void;
    onSave: (boxes: Record<string, DashboardBox>) => void;
}

export const CustomizePanelsDialog: React.FC<CustomizePanelsDialogProps> = ({
    open,
    title,
    boxes: initialBoxes,
    layoutEditable = true,
    onClose,
    onSave,
}) => {
    const [boxes, setBoxes] = useState<Record<string, DashboardBox>>(() => {
        const cloned: Record<string, DashboardBox> = {};
        for (const key of Object.keys(initialBoxes)) {
            cloned[key] = {...initialBoxes[key]};
        }
        return cloned;
    });

    const boxList = useMemo(
        () => Object.entries(boxes).map(([key, box]) => ({key, ...box})),
        [boxes],
    );

    const handleToggle = (key: string) => {
        if (!layoutEditable) return;
        setBoxes((prev) => ({
            ...prev,
            [key]: {...prev[key], visible: !(prev[key]?.visible ?? true)},
        }));
    };

    const handleSave = () => onSave(boxes);

    return (
        <DialogShell opened={open} onClose={onClose} size={dialogSize.md} label="Customize panels">
            <DialogHeader
                icon={<Icon lucide={LayoutDashboard}/>}
                title="Customize panels"
                subtitle={title}
                onClose={onClose}
            />

            {/* Content */}
            <Box bg={dialogContentBg}>
                <Stack p={24} gap={24}>
                    {!layoutEditable && (
                        <Alert color="blue" variant="light">
                            The Default layout is read-only. Save a layout of your own to choose
                            which panels appear.
                        </Alert>
                    )}
                    <Box>
                        <Text {...sectionLabelProps}>
                            Choose which panels appear on your dashboard
                        </Text>
                        <Paper {...sectionPaperProps}>
                            {/*
                              * Still a real list. Mantine has no row-with-a-control
                              * equivalent of MUI's List, but the count and position a
                              * list conveys are worth keeping, so the Stack and its
                              * rows carry the ul/li themselves.
                              */}
                            <Stack component="ul" gap={4} m={0} p={0} style={{listStyle: 'none'}}>
                                {boxList.map((box) => (
                                    <Group component="li" key={box.key} gap={16} wrap="nowrap" px={8} py={6}>
                                        <ThemeIcon variant="light" size={40} radius="md">
                                            {box.icon
                                                ? <SymbolIcon name={box.icon} aria-hidden size={22}/>
                                                : <Icon lucide={LayoutDashboard} size={22}/>}
                                        </ThemeIcon>
                                        <Box style={{flex: 1, minWidth: 0}}>
                                            <Text fz="sm">{box.title || box.name}</Text>
                                            {box.description && (
                                                <Text fz="xs" c="dimmed">{box.description}</Text>
                                            )}
                                        </Box>
                                        <Switch
                                            checked={box.visible ?? true}
                                            disabled={!layoutEditable}
                                            onChange={() => handleToggle(box.key)}
                                            aria-label={box.title || box.name || box.key}
                                        />
                                    </Group>
                                ))}
                            </Stack>
                        </Paper>
                    </Box>
                </Stack>
            </Box>

            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSave}
                confirmLabel="Save"
                confirmIcon={<Icon lucide={Save}/>}
                confirmDisabled={!layoutEditable}
            />
        </DialogShell>
    );
};

export default CustomizePanelsDialog;
