/**
 * SaveLayoutDialog Component
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Box, Paper, Text, TextInput} from '@mantine/core';
import {LayoutGrid, Save} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    sectionLabelProps,
    sectionPaperProps,
} from '../shared/mantine';

export interface SaveLayoutDialogProps {
    open: boolean;
    /** Existing layout names — used to reject duplicates (case-insensitive). */
    existingNames: string[];
    onClose: () => void;
    /** Called with the trimmed, validated layout name. */
    onConfirm: (name: string) => void;
    /** Pre-fill the name field (e.g. when renaming an existing layout). */
    initialName?: string;
    /** Header title. Defaults to "Save Layout". */
    title?: string;
    /** Header subtitle. */
    subtitle?: string;
    /** Primary action label. Defaults to "Add Layout". */
    confirmLabel?: string;
}

export const SaveLayoutDialog: React.FC<SaveLayoutDialogProps> = ({
    open,
    existingNames,
    onClose,
    onConfirm,
    initialName = '',
    title = 'Save Layout',
    subtitle = 'Name the current arrangement to save it',
    confirmLabel = 'Add Layout',
}) => {
    const [name, setName] = useState(initialName);

    // Reset the field to the initial value each time the dialog opens.
    useEffect(() => {
        if (open) setName(initialName);
    }, [open, initialName]);

    const trimmed = name.trim();
    const normalizedExisting = useMemo(
        () => new Set(existingNames.map(n => n.trim().toLowerCase())),
        [existingNames],
    );
    const isDuplicate = trimmed.length > 0 && normalizedExisting.has(trimmed.toLowerCase());
    const isValid = trimmed.length > 0 && !isDuplicate;

    const duplicateError = isDuplicate ? 'A layout with this name already exists.' : undefined;

    const handleConfirm = useCallback(() => {
        if (!isValid) return;
        onConfirm(trimmed);
    }, [isValid, trimmed, onConfirm]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirm();
        }
    }, [handleConfirm]);

    return (
        <DialogShell opened={open} onClose={onClose} label={title}>
            <DialogHeader
                icon={<Icon lucide={LayoutGrid}/>}
                title={title}
                subtitle={subtitle}
                onClose={onClose}
            />

            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Text {...sectionLabelProps}>Layout name</Text>
                <Paper {...sectionPaperProps}>
                    <TextInput
                        size="sm"
                        data-autofocus
                        label="Layout name"
                        value={name}
                        onChange={e => setName(e.currentTarget.value)}
                        onKeyDown={handleKeyDown}
                        error={duplicateError}
                        maxLength={50}
                    />
                </Paper>
            </Box>

            <DialogFooter
                onCancel={onClose}
                onConfirm={handleConfirm}
                confirmLabel={confirmLabel}
                confirmIcon={<Icon lucide={Save} size={16}/>}
                confirmDisabled={!isValid}
            />
        </DialogShell>
    );
};

export default SaveLayoutDialog;
