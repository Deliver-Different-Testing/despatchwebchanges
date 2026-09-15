/**
 * Change Paid Courier Dialog
 *
 * For a job that is already archived and completed, reassigns which courier
 * is invoiced and paid for the work. Payment amounts on the job are kept;
 * only the courier changes.
 *
 * Two-phase flow:
 *   Phase 1 — Input:   Pick the new courier (with an invoicing-impact warning)
 *   Phase 2 — Confirm: Review old → new courier and confirm the change
 */

import React, {useEffect, useState} from 'react';
import {Alert, Box, Group, Paper, Stack, Text, TextInput} from '@mantine/core';
import {useDebouncedValue} from '@mantine/hooks';
import {ArrowRight, TriangleAlert} from 'lucide-react';
import {IconTruck} from '@tabler/icons-react';
import {Icon} from '../../common/icon/Icon';
import {SearchSelect} from '../../common/search-select/SearchSelect';
import type {ShowToastFn} from '../../../services/toastService';
import type {ISuggestion} from '../../../../interfaces/job.interface';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg, sectionPaperProps} from '../shared/mantine';

/** The outgoing and incoming couriers, shown side by side in the confirm step. */
const CourierChip: React.FC<{label: string; value: string}> = ({label, value}) => (
    <Box
        p="sm"
        ta="center"
        style={{
            flex: 1,
            borderRadius: 'var(--mantine-radius-sm)',
            backgroundColor: 'var(--mantine-color-brand-0)',
            border: '1px solid var(--mantine-color-brand-3)',
        }}
    >
        <Text fz="xs" c="dimmed">{label}</Text>
        <Text fz="lg" fw={700} c="brand.7">{value}</Text>
    </Box>
);

export interface ChangeCourierDialogProps {
    open: boolean;
    jobNo: string;
    currentCourierName?: string;
    onClose: () => void;
    onSave: (courierId: number) => Promise<void>;
    showToast: ShowToastFn;
    searchCouriers: (searchTerm: string) => Promise<ISuggestion[]>;
}

type Phase = 'input' | 'confirm';

export function ChangeCourierDialog({
    open,
    jobNo,
    currentCourierName,
    onClose,
    onSave,
    showToast,
    searchCouriers,
}: ChangeCourierDialogProps): React.ReactElement | null {
    const [phase, setPhase] = useState<Phase>('input');
    const [newCourier, setNewCourier] = useState<ISuggestion | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState<ISuggestion[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Reset state when the dialog opens
    useEffect(() => {
        if (open) {
            setPhase('input');
            setNewCourier(null);
            setInputValue('');
            setOptions([]);
            setSaving(false);
        }
    }, [open]);

    const [debouncedTerm] = useDebouncedValue(inputValue, 300);

    // Debounced courier search — clearing the box empties the list immediately.
    useEffect(() => {
        if (!inputValue) {
            setOptions([]);
            return;
        }
        if (!debouncedTerm) return;
        let cancelled = false;
        void (async () => {
            setSearchLoading(true);
            try {
                const results = await searchCouriers(debouncedTerm);
                if (!cancelled) setOptions(results);
            } catch {
                if (!cancelled) setOptions([]);
            } finally {
                if (!cancelled) setSearchLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [inputValue, debouncedTerm, searchCouriers]);

    const handleConfirmChange = async (): Promise<void> => {
        if (!newCourier) return;
        setSaving(true);
        try {
            await onSave(newCourier.id);
            showToast('Paid courier changed successfully.', 'success');
            onClose();
        } catch {
            showToast('An error occurred while changing the courier. Please try again.', 'error');
            setSaving(false);
        }
    };

    return (
        <DialogShell opened={open} onClose={saving ? () => {} : onClose} size={520} label="Change paid courier">
            <DialogHeader
                icon={<Icon tabler={IconTruck}/>}
                title="Change Paid Courier"
                subtitle={`Job ${jobNo}`}
                variant="warning"
                onClose={onClose}
                closeDisabled={saving}
            />
            <Stack p="lg" gap="md" bg={dialogContentBg}>
                <Alert color="orange" variant="light" icon={<Icon lucide={TriangleAlert}/>}>
                    This changes which courier is invoiced and paid for this work.
                </Alert>

                {phase === 'input' ? (
                    <Stack gap="md">
                        <TextInput label="Current courier" value={currentCourierName ?? 'Unassigned'} disabled/>
                        <SearchSelect<ISuggestion>
                            aria-label="New courier"
                            placeholder="Search courier..."
                            autoFocus
                            autoHighlight
                            value={newCourier}
                            onChange={setNewCourier}
                            options={options}
                            onSearchChange={setInputValue}
                            loading={searchLoading}
                            disabled={saving}
                            getOptionKey={(option) => option.id}
                            getOptionLabel={(option) => option.text}
                            minSearchLength={1}
                        />
                    </Stack>
                ) : (
                    <Paper {...sectionPaperProps}>
                        <Text fz="sm" fw={600} mb="md">
                            Are you sure you want to change which courier is invoiced for this work?
                        </Text>
                        <Group gap="md" align="center" wrap="nowrap">
                            <CourierChip label="Current courier" value={currentCourierName ?? 'Unassigned'}/>
                            <Icon lucide={ArrowRight} size={28} color="var(--mantine-color-dimmed)"/>
                            <CourierChip label="New courier" value={newCourier?.text ?? ''}/>
                        </Group>
                    </Paper>
                )}
            </Stack>
            {phase === 'input' ? (
                <DialogFooter
                    onCancel={onClose}
                    onConfirm={() => setPhase('confirm')}
                    confirmLabel="Save"
                    confirmDisabled={!newCourier}
                />
            ) : (
                <DialogFooter
                    onCancel={() => setPhase('input')}
                    cancelLabel="Back"
                    onConfirm={handleConfirmChange}
                    confirmLabel={saving ? 'Saving...' : 'Confirm Change'}
                    confirmColor="orange"
                    submitting={saving}
                />
            )}
        </DialogShell>
    );
}

export default ChangeCourierDialog;
