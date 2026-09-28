/**
 * SelectDialog Component
 *
 * React replacement for the AngularJS select-dialog.
 * Presents a dropdown selection with optional warning message and checkbox.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {Alert, Checkbox, Divider, Select, Stack} from '@mantine/core';
import { ListChecks, TriangleAlert } from 'lucide-react';
import { Icon } from '../../common/icon/Icon';
import { DialogShell, DialogHeader, DialogFooter, dialogContentBg } from '../shared/mantine';

import { SelectDialogProps, SelectDialogResult, SelectDialogItem } from './types';

export const SelectDialog: React.FC<SelectDialogProps> = ({
    open,
    title,
    fieldName,
    items,
    initialValue,
    warningMessage,
    showCheckbox = false,
    checkboxLabel = '',
    onClose,
    onSubmit,
    showToast,
}) => {
    const [selectedItem, setSelectedItem] = useState<SelectDialogItem | null>(null);
    const [checkboxValue, setCheckboxValue] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setCheckboxValue(false);
            setIsLoading(false);

            if (initialValue != null && items.length > 0) {
                const found = items.find(
                    item => item.text === initialValue || item.id === initialValue
                ) ?? null;
                setSelectedItem(found);
            } else {
                setSelectedItem(null);
            }
        }
    }, [open, initialValue, items]);

    // Mantine's Select is string-valued, so ids round-trip through String()/Number().
    const handleSelectChange = useCallback((value: string | null) => {
        const item = value == null ? null : items.find(i => String(i.id) === value) ?? null;
        setSelectedItem(item);
    }, [items]);

    const handleSubmit = useCallback(async () => {
        if (!selectedItem) {
            showToast('Please select an option', 'warning');
            return;
        }

        try {
            setIsLoading(true);

            const result: SelectDialogResult = {
                fieldName,
                value: selectedItem.id,
                text: selectedItem.text,
                checkboxValue: showCheckbox ? checkboxValue : undefined,
            };

            await onSubmit(result);
        } catch (error: unknown) {
            console.error('Error submitting selection:', error);
            showToast(error instanceof Error ? error.message : 'Failed to save selection', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [selectedItem, fieldName, showCheckbox, checkboxValue, onSubmit, showToast]);

    return (
        <DialogShell opened={open} onClose={onClose}>
            <DialogHeader
                icon={<Icon lucide={ListChecks}/>}
                title={`Edit ${title}`}
                subtitle="Select an option from the list"
                onClose={onClose}
                closeDisabled={isLoading}
            />
            {/* Content */}
            <Stack p="lg" gap="md" bg={dialogContentBg}>
                {/* Select Dropdown */}
                <Select
                    label={title}
                    data={items.map(item => ({value: String(item.id), label: item.text}))}
                    value={selectedItem ? String(selectedItem.id) : null}
                    onChange={handleSelectChange}
                    disabled={isLoading}
                    allowDeselect={false}
                />

                {/* Warning Message */}
                {warningMessage && (
                    <Alert color="orange" variant="light" icon={<Icon lucide={TriangleAlert}/>}>
                        {warningMessage}
                    </Alert>
                )}

                {/* Checkbox */}
                {showCheckbox && (
                    <>
                        <Divider />
                        <Checkbox
                            label={checkboxLabel}
                            checked={checkboxValue}
                            onChange={(e) => setCheckboxValue(e.currentTarget.checked)}
                            disabled={isLoading}
                        />
                    </>
                )}
            </Stack>
            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSubmit}
                confirmLabel={isLoading ? 'Saving...' : 'Save'}
                confirmDisabled={!selectedItem}
                submitting={isLoading}
            />
        </DialogShell>
    );
};

export default SelectDialog;
