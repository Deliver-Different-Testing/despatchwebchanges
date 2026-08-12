/**
 * SimplePriceEditDialog Component
 *
 * React replacement for the AngularJS simple-price-edit-dialog.
 * Provides a fallback pricing interface for non-US customers without price breakdowns.
 * Supports three pricing modes: recalculate, raw base amount, and gross amount.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Button, Divider, Group, Loader, Radio, Stack, Text, TextInput, ThemeIcon, alpha, NumberInput} from '@mantine/core';
import { ArrowRight, Check, CircleCheck, CirclePlus, Info, Lock, NotebookPen, RefreshCw, Tag } from 'lucide-react';
import { IconTruck } from '@tabler/icons-react';
import { DialogShell, DialogHeader, DialogFooter } from '../shared/mantine';
import { Icon } from '../../common/icon/Icon';
import { grossModeColor } from '../../../theme/designTokens';

import { SimplePriceEditDialogProps, PricingMode, ChildPriceUpdate } from './types';

interface ModeOption {
    mode: PricingMode;
    title: string;
    description: string;
    icon: React.ReactNode;
}

const MODE_OPTIONS: ModeOption[] = [
    {
        mode: 'recalculate',
        title: 'Auto-Calculate Prices',
        description: 'Recalculate from job details & current rates',
        icon: <Icon lucide={RefreshCw} size={22} />,
    },
    {
        mode: 'base',
        title: 'Base Price (add surcharges)',
        description: 'Enter the base amount; PPD & fuel added on top',
        icon: <Icon lucide={CirclePlus} size={22} />,
    },
    {
        mode: 'gross',
        title: 'Final Price (use as-is)',
        description: 'Enter the final amount; applied as-is',
        icon: <Icon lucide={NotebookPen} size={22} />,
    },
];

const SELECTED_ICON_COLOR: Record<PricingMode, string> = {
    recalculate: 'var(--mantine-color-gray-6)',
    base: 'var(--mantine-color-green-6)',
    gross: grossModeColor,
};

const SELECTED_ICON_BG: Record<PricingMode, string> = {
    recalculate: alpha('var(--mantine-color-gray-6)', 0.12),
    base: alpha('var(--mantine-color-green-6)', 0.12),
    gross: alpha(grossModeColor, 0.12),
};

const scrim = (opacity: number) => alpha('var(--mantine-color-black)', opacity);

const getSubmitButtonText = (mode: PricingMode) => {
    switch (mode) {
        case 'recalculate': return 'Recalculate & Save';
        case 'base': return 'Apply Base Amount';
        case 'gross': return 'Apply Final Amount';
    }
};

const getModeSubtitle = (mode: PricingMode) => {
    switch (mode) {
        case 'recalculate': return 'Recalculated based on job details';
        case 'base': return 'Base price applied';
        case 'gross': return 'Final price applied';
    }
};

/** The rounded job-number pill used in the header area and on each child row. */
function JobPill({jobNumber, compact = false}: {jobNumber: string; compact?: boolean}): React.ReactElement {
    return (
        <Group
            gap={compact ? 6 : 'xs'}
            wrap="nowrap"
            display="inline-flex"
            style={{
                paddingInline: compact ? 10 : 14,
                paddingBlock: compact ? 4 : 6,
                backgroundColor: compact ? alpha('var(--mantine-color-gray-6)', 0.1) : scrim(0.06),
                borderRadius: compact ? 16 : 20,
                flexShrink: 0,
            }}
        >
            <Box c="dimmed" style={{display: 'flex'}}>
                <Icon tabler={IconTruck} size={compact ? 13 : 18} />
            </Box>
            <Text size={compact ? 'xs' : 'sm'} fw={600} style={compact ? undefined : {letterSpacing: 0.5}} truncate>
                {jobNumber}
            </Text>
        </Group>
    );
}

export const SimplePriceEditDialog: React.FC<SimplePriceEditDialogProps> = ({
    open,
    jobNumber,
    currentCharge,
    isBulk = false,
    hideRecalculate = false,
    childJobs,
    readOnly = false,
    onClose,
    onSubmit,
    showToast,
}) => {
    // Bulk jobs only support gross-amount editing — tblBulkJob has no fuel/PPD breakdown
    // and no SuburbID for the rating pipeline. Auto-Calculate/Base Price remain visible but disabled.
    const availableModes = hideRecalculate
        ? MODE_OPTIONS.filter(o => o.mode !== 'recalculate')
        : MODE_OPTIONS;
    const isModeDisabled = (mode: PricingMode) => isBulk && mode !== 'gross';
    const defaultMode: PricingMode = isBulk || hideRecalculate ? 'gross' : 'recalculate';

    const [selectedMode, setSelectedMode] = useState<PricingMode>(defaultMode);
    const [amount, setAmount] = useState<number>(0);
    const [childAmounts, setChildAmounts] = useState<Record<number, number>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [savedAmount, setSavedAmount] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedMode(defaultMode);
            setAmount(Math.round(currentCharge * 100) / 100);
            setIsLoading(false);
            setShowResult(false);
            setSavedAmount(0);
            setErrorMessage('');
            // Pre-fill child amounts from current charges
            const initial: Record<number, number> = {};
            (childJobs ?? []).forEach(c => { initial[c.jobId] = Math.round(c.charge * 100) / 100; });
            setChildAmounts(initial);
        }
    }, [open, currentCharge, childJobs, defaultMode]);

    // Sum of all current child amounts (null when no children)
    const childSum = useMemo(() => {
        if (!childJobs || childJobs.length === 0) return null;
        return childJobs.reduce((sum, c) => sum + (childAmounts[c.jobId] ?? c.charge), 0);
    }, [childJobs, childAmounts]);

    // In gross/base modes with children the parent amount must equal the sum of children
    const hasChildSumMismatch = (selectedMode === 'gross' || selectedMode === 'base') && childSum !== null && Math.abs(amount - childSum) > 0.001;

    const isSubmitDisabled = isLoading
        || (selectedMode !== 'recalculate' && (!amount || amount <= 0))
        || hasChildSumMismatch;

    const handleSubmit = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');

        const childUpdates: ChildPriceUpdate[] = selectedMode === 'recalculate' ? [] : (childJobs ?? [])
            .filter(c => Math.abs((childAmounts[c.jobId] ?? c.charge) - c.charge) > 0.001)
            .map(c => ({
                jobId: c.jobId,
                isPrebook: c.isPrebook,
                isBulkJob: c.isBulkJob,
                newPrice: childAmounts[c.jobId],
            }));

        try {
            const resultAmount = await onSubmit(selectedMode, amount, childUpdates);
            setSavedAmount(resultAmount);
            setShowResult(true);
        } catch (error: unknown) {
            console.error('Error saving price:', error);
            const msg = error instanceof Error ? error.message : 'Failed to save price. Please try again.';
            setErrorMessage(msg);
            showToast(msg, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [selectedMode, amount, childJobs, childAmounts, onSubmit, showToast]);

    const handleDone = useCallback(() => {
        onClose();
    }, [onClose]);

    // The dialog must not close mid-save
    const handleClose = useCallback(() => {
        if (!isLoading) onClose();
    }, [isLoading, onClose]);

    // --- Render helpers ---

    const renderEditState = () => (
        <Box pt="md" px="lg" pb="lg">
            {/* Job Reference Badge */}
            <Box mb="lg">
                <JobPill jobNumber={jobNumber} />
            </Box>

            {/* Pricing Options */}
            {/* One radiogroup, not three loose radios: Radio.Group owns the value and
                gives the set arrow-key navigation and a single tab stop. */}
            <Radio.Group
                value={selectedMode}
                onChange={(value) => { if (!readOnly) setSelectedMode(value as PricingMode); }}
            >
                <Stack gap={10}>
                {availableModes.map((opt) => {
                    const isSelected = selectedMode === opt.mode;
                    const disabled = isModeDisabled(opt.mode);
                    return (
                        <Group
                            key={opt.mode}
                            gap={14}
                            wrap="nowrap"
                            onClick={() => { if (!disabled && !readOnly) setSelectedMode(opt.mode); }}
                            title={disabled ? 'Not available for bulk jobs' : undefined}
                            style={{
                                paddingBlock: 14,
                                paddingInline: 16,
                                border: `2px solid ${isSelected ? 'var(--mantine-color-gray-6)' : scrim(0.08)}`,
                                borderRadius: 'var(--mantine-radius-lg)',
                                cursor: (disabled || readOnly) ? 'default' : 'pointer',
                                opacity: disabled ? 0.5 : 1,
                                backgroundColor: isSelected
                                    ? alpha('var(--mantine-color-gray-6)', 0.06)
                                    : 'var(--mantine-color-white)',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        >
                            <Radio
                                value={opt.mode}
                                disabled={disabled || readOnly}
                                color="gray.6"
                                aria-label={opt.title}
                            />
                            <ThemeIcon
                                size={40}
                                radius="lg"
                                style={{
                                    '--ti-bg': isSelected ? SELECTED_ICON_BG[opt.mode] : scrim(0.06),
                                    '--ti-color': isSelected ? SELECTED_ICON_COLOR[opt.mode] : 'var(--mantine-color-dimmed)',
                                    transition: 'all 0.2s ease',
                                } as React.CSSProperties}
                            >
                                {opt.icon}
                            </ThemeIcon>
                            <Stack gap={2} style={{minWidth: 0}}>
                                <Text fw={500}>{opt.title}</Text>
                                <Text size="xs" c="dimmed" style={{lineHeight: 1.4}}>
                                    {disabled ? 'Not available for bulk jobs' : opt.description}
                                </Text>
                            </Stack>
                        </Group>
                    );
                })}
            </Stack>
        </Radio.Group>

            {/* Amount Input (shown for base/gross modes) */}
            {(selectedMode === 'base' || selectedMode === 'gross') && (
<>
                    <Divider my="md" color={scrim(0.08)}/>
                    <Box>
                    <Text size="sm" fw={500} c="dimmed" mb={10}>
                        {selectedMode === 'base' ? 'Enter Base Amount' : 'Enter Final Amount'}
                    </Text>
                    <NumberInput
                        value={amount || ''}
                        onChange={(value) => setAmount(Number(value) || 0)}
                        placeholder="0.00"
                        disabled={readOnly}
                        data-autofocus={!readOnly || undefined}
                        step={0.01}
                        decimalScale={2}
                        min={0}
                        leftSection={<Text size="xl" fw={500} c="dimmed">$</Text>}
                        aria-label={selectedMode === 'base' ? 'Enter Base Amount' : 'Enter Final Amount'}
                        styles={{
                            input: {
                                fontSize: 28,
                                fontWeight: 600,
                                height: 'auto',
                                paddingBlock: 8,
                                backgroundColor: scrim(0.04),
                                borderRadius: 'var(--mantine-radius-lg)',
                                border: '2px solid transparent',
                            },
                        }}
                    />
                </Box>
                </>
            )}

            {/* Sum mismatch indicator — shown in gross/base modes when children are present */}
            {(selectedMode === 'gross' || selectedMode === 'base') && childSum !== null && (
                <Group
                    justify="space-between"
                    wrap="nowrap"
                    mt="sm"
                    px="sm"
                    py="xs"
                    style={{
                        borderRadius: 'var(--mantine-radius-md)',
                        backgroundColor: hasChildSumMismatch
                            ? alpha('var(--mantine-color-red-6)', 0.06)
                            : alpha('var(--mantine-color-green-6)', 0.06),
                        border: `1px solid ${hasChildSumMismatch
                            ? alpha('var(--mantine-color-red-6)', 0.25)
                            : alpha('var(--mantine-color-green-6)', 0.25)}`,
                    }}
                >
                    <Text size="xs" fw={500} c={hasChildSumMismatch ? 'red.6' : 'green.6'}>
                        {hasChildSumMismatch
                            ? `Parent must equal children total — set to $${childSum.toFixed(2)}`
                            : 'Parent matches children total'}
                    </Text>
                    <Text size="xs" fw={700} c={hasChildSumMismatch ? 'red.6' : 'green.6'}>
                        ${childSum.toFixed(2)}
                    </Text>
                </Group>
            )}

            {/* Child jobs — hidden in recalculate mode since the system sets the price */}
            {childJobs && childJobs.length > 0 && selectedMode !== 'recalculate' && (
<>
                    <Divider my="md" color={scrim(0.08)}/>
                    <Box>
                    <Group justify="space-between" mb="sm" wrap="nowrap">
                        <Text size="sm" fw={500} c="dimmed">Child Jobs</Text>
                        {(selectedMode === 'gross' || selectedMode === 'base') && amount > 0 && (
                            <Button
                                variant="subtle"
                                size="compact-xs"
                                disabled={readOnly}
                                onClick={() => {
                                    const currentSum = childJobs.reduce((s, c) => s + (childAmounts[c.jobId] ?? c.charge), 0);
                                    if (currentSum <= 0) return;
                                    const updated: Record<number, number> = {};
                                    childJobs.forEach((c, i) => {
                                        const ratio = (childAmounts[c.jobId] ?? c.charge) / currentSum;
                                        // Last child gets the remainder to avoid floating-point drift
                                        if (i === childJobs.length - 1) {
                                            const allocated = Object.values(updated).reduce((s, v) => s + v, 0);
                                            updated[c.jobId] = Math.round((amount - allocated) * 100) / 100;
                                        } else {
                                            updated[c.jobId] = Math.round(ratio * amount * 100) / 100;
                                        }
                                    });
                                    setChildAmounts(prev => ({...prev, ...updated}));
                                }}
                            >
                                Set proportionally
                            </Button>
                        )}
                    </Group>
                    <Stack gap="xs">
                        {childJobs.map((child) => {
                            const currentAmount = childAmounts[child.jobId] ?? child.charge;
                            const isChanged = Math.abs(currentAmount - child.charge) > 0.001;
                            return (
                                <Group
                                    key={child.jobId}
                                    gap="sm"
                                    wrap="nowrap"
                                    py={10}
                                    px="sm"
                                    style={{
                                        backgroundColor: scrim(0.03),
                                        borderRadius: 'var(--mantine-radius-md)',
                                        border: `1px solid ${isChanged ? 'var(--mantine-color-brand-6)' : scrim(0.08)}`,
                                        transition: 'border-color 0.2s ease',
                                    }}
                                >
                                    <JobPill jobNumber={child.jobNumber} compact />
                                    <NumberInput
                                        value={currentAmount || ''}
                                        onChange={(value) => {
                                            const val = Number(value) || 0;
                                            setChildAmounts(prev => ({...prev, [child.jobId]: val}));
                                        }}
                                        disabled={readOnly}
                                        size="sm"
                                        step={0.01}
                                        decimalScale={2}
                                        min={0}
                                        leftSection="$"
                                        aria-label={`Price for ${child.jobNumber}`}
                                        style={{flex: 1}}
                                        styles={isChanged
                                            ? {input: {borderColor: 'var(--mantine-color-brand-6)'}}
                                            : undefined}
                                    />
                                    {isChanged && (
                                        <Text size="xs" c="dimmed" ta="right" style={{flexShrink: 0, minWidth: 60}}>
                                            was ${child.charge.toFixed(2)}
                                        </Text>
                                    )}
                                </Group>
                            );
                        })}
                    </Stack>
                </Box>
                </>
            )}

            {/* Error message */}
            {errorMessage && (
                <Text c="red.6" size="sm" mt="md">{errorMessage}</Text>
            )}
        </Box>
    );

    const renderLoadingState = () => (
        <Stack align="center" justify="center" gap="md" py={60} px="lg">
            <Loader size={48} role="progressbar" aria-label="Saving price" />
            <Text fw={500} c="dimmed">Saving price...</Text>
        </Stack>
    );

    const renderSuccessState = () => (
        <Box py="xl" px="lg" ta="center">
            <Box c="green.6" mb="md" style={{display: 'flex', justifyContent: 'center'}}>
                <Icon lucide={CircleCheck} size={56} />
            </Box>
            <Text fw={600} fz="lg" mb="xs">Price Updated</Text>
            <Text size="sm" c="dimmed" mb="lg">{getModeSubtitle(selectedMode)}</Text>

            {/* New Price Display */}
            <Box
                p="md"
                mb="md"
                style={{
                    backgroundColor: alpha('var(--mantine-color-green-6)', 0.08),
                    border: `2px solid ${alpha('var(--mantine-color-green-6)', 0.2)}`,
                    borderRadius: 'var(--mantine-radius-lg)',
                }}
            >
                <Text size="xs" c="dimmed" tt="uppercase" display="block" mb={4} style={{letterSpacing: 0.5}}>
                    New Price
                </Text>
                <Text fz={36} fw={700} c="green.6">${savedAmount.toFixed(2)}</Text>
            </Box>

            {/* Price Comparison */}
            {currentCharge !== savedAmount && (
                <Group
                    justify="center"
                    align="center"
                    gap="md"
                    p="md"
                    mb="md"
                    style={{backgroundColor: scrim(0.03), borderRadius: 'var(--mantine-radius-lg)'}}
                >
                    <Box ta="center">
                        <Text size="xs" c="dimmed" display="block" mb={4}>Previous Price</Text>
                        <Text fw={600} c="dimmed">${currentCharge.toFixed(2)}</Text>
                    </Box>
                    <Box c="dimmed" style={{display: 'flex'}}>
                        <Icon lucide={ArrowRight} size={20} />
                    </Box>
                    <Box ta="center">
                        <Text size="xs" c="dimmed" display="block" mb={4}>New Price</Text>
                        <Text fw={600} c="green.6">${savedAmount.toFixed(2)}</Text>
                    </Box>
                </Group>
            )}

            <Group justify="center" gap={6} wrap="nowrap">
                <Box c="dimmed" style={{display: 'flex'}}>
                    <Icon lucide={Info} size={16} />
                </Box>
                <Text size="xs" c="dimmed">Job {jobNumber} has been updated</Text>
            </Group>
        </Box>
    );

    return (
        <DialogShell
            opened={open}
            onClose={handleClose}
            size={childJobs && childJobs.length > 0 ? 480 : 420}
            label="Edit Price"
            styles={{content: {overflow: 'hidden', maxHeight: '90vh'}}}
        >
            {/* Header */}
            <DialogHeader
                icon={<Icon lucide={readOnly ? Lock : Tag} />}
                title="Edit Price"
                subtitle={readOnly ? 'View only — this job is locked' : 'Adjust the job price'}
                onClose={onClose}
                closeDisabled={isLoading}
            />
            {/* Content — scrollable so action buttons remain visible */}
            <Box style={{overflowY: 'auto', flex: 1}}>
                {isLoading && renderLoadingState()}
                {showResult && !isLoading && renderSuccessState()}
                {!showResult && !isLoading && renderEditState()}
            </Box>
            {/* Actions for result state */}
            {showResult && !isLoading && (
                <DialogFooter
                    hideCancel
                    onConfirm={handleDone}
                    confirmLabel="Done"
                    confirmIcon={<Icon lucide={Check} />}
                />
            )}
            {/* Actions for edit state */}
            {!showResult && !isLoading && (
                <DialogFooter
                    onCancel={onClose}
                    cancelLabel={readOnly ? 'Close' : 'Cancel'}
                    onConfirm={handleSubmit}
                    confirmLabel={getSubmitButtonText(selectedMode)}
                    confirmIcon={selectedMode === 'recalculate' ? <Icon lucide={RefreshCw} /> : undefined}
                    confirmDisabled={isSubmitDisabled}
                    hideConfirm={readOnly}
                />
            )}
        </DialogShell>
    );
};

export default SimplePriceEditDialog;
