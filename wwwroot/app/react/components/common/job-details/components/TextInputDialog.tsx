/**
 * TextInputDialog - Small dialog for editing text fields
 *
 * Replaces $mdDialog.prompt() for editing text fields like
 * RefA, RefB, POD name, weight, tracking mobile/email, etc.
 */

import React, {useState, useEffect} from 'react';
import {Box, Button, TextInput} from '@mantine/core';
import {Pencil} from 'lucide-react';
import {Icon} from '../../icon/Icon';
import {DialogFooter, DialogHeader, DialogShell, dialogContentBg} from '../../../dialogs/shared/mantine';

export interface TextInputDialogProps {
    open: boolean;
    title: string;
    label: string;
    initialValue: string;
    okLabel?: string;
    cancelLabel?: string;
    required?: boolean;
    /** When true a "Clear" action is shown that submits an empty value to remove the field. */
    allowClear?: boolean;
    onSubmit: (value: string) => void;
    onCancel: () => void;
}

export function TextInputDialog({
    open,
    title,
    label,
    initialValue,
    okLabel = 'Save',
    cancelLabel = 'Cancel',
    required = true,
    allowClear = false,
    onSubmit,
    onCancel,
}: TextInputDialogProps) {
    const [value, setValue] = useState(initialValue);
    const isEmpty = required && !value.trim();
    // Only offer Clear when there is a value to remove.
    const canClear = allowClear && !!value.trim();

    useEffect(() => {
        if (open) {
            setValue(initialValue);
        }
    }, [open, initialValue]);

    const submit = () => {
        if (isEmpty) return;
        onSubmit(value);
    };

    // Clear submits an empty value, bypassing the required check, so the
    // field is removed rather than updated.
    const handleClear = () => {
        onSubmit('');
    };

    return (
        <DialogShell opened={open} onClose={onCancel} size={440} label={title}>
            <DialogHeader
                icon={<Icon lucide={Pencil}/>}
                title={title}
                subtitle="Update the field value"
                onClose={onCancel}
            />
            {/* The form is what makes Enter submit; the footer's confirm button is a
                plain button (Mantine's default type), so it can't double-submit. */}
            <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <Box p="lg" bg={dialogContentBg}>
                    <TextInput
                        data-autofocus
                        label={label}
                        value={value}
                        onChange={(e) => setValue(e.currentTarget.value)}
                        error={isEmpty ? 'This field is required' : undefined}
                    />
                </Box>
                <DialogFooter
                    onCancel={onCancel}
                    cancelLabel={cancelLabel}
                    onConfirm={submit}
                    confirmLabel={okLabel}
                    confirmDisabled={isEmpty}
                    secondaryAction={canClear ? (
                        <Button variant="outline" color="red" onClick={handleClear}>
                            Clear
                        </Button>
                    ) : undefined}
                />
            </form>
        </DialogShell>
    );
}
