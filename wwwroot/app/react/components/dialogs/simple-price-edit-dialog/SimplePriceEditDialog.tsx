/**
 * SimplePriceEditDialog Component
 *
 * React replacement for the AngularJS simple-price-edit-dialog.
 * Provides a fallback pricing interface for non-US customers without price breakdowns.
 * Supports three pricing modes: recalculate, raw base amount, and gross amount.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { alpha } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Radio from '@mui/material/Radio';
import InputAdornment from '@mui/material/InputAdornment';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import {DialogHeader} from '../shared';
import {grossModeColor} from '../../../theme/designTokens';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SyncIcon from '@mui/icons-material/Sync';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InfoIcon from '@mui/icons-material/Info';
import CheckIcon from '@mui/icons-material/Check';

import { SimplePriceEditDialogProps, PricingMode, ChildPriceUpdate } from './types';

interface ModeOption {
    mode: PricingMode;
    title: string;
    description: string;
    icon: React.ReactNode;
    iconColorClass: string;
}

const MODE_OPTIONS: ModeOption[] = [
    {
        mode: 'recalculate',
        title: 'Auto-Calculate Prices',
        description: 'Recalculate from job details & current rates',
        icon: <SyncIcon sx={{ fontSize: 22 }} />,
        iconColorClass: 'recalculate',
    },
    {
        mode: 'base',
        title: 'Base Price (add surcharges)',
        description: 'Enter the base amount; PPD & fuel added on top',
        icon: <AddCircleIcon sx={{ fontSize: 22 }} />,
        iconColorClass: 'base',
    },
    {
        mode: 'gross',
        title: 'Final Price (use as-is)',
        description: 'Enter the final amount; applied as-is',
        icon: <EditNoteIcon sx={{ fontSize: 22 }} />,
        iconColorClass: 'gross',
    },
];

const getSelectedIconColor = (mode: PricingMode) => {
    switch (mode) {
        case 'recalculate': return 'grey.600';
        case 'base': return 'success.main';
        case 'gross': return grossModeColor;
    }
};

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

    // --- Render helpers ---

    const renderEditState = () => (
        <Box sx={{ pt: 2.5, px: 3, pb: 3 }}>
            {/* Job Reference Badge */}
            <Box sx={(theme) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                px: 1.75,
                py: 0.75,
                bgcolor: alpha(theme.palette.common.black, 0.06),
                borderRadius: 5,
                mb: 2.5,
            })}>
                <LocalShippingIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 600,
                        letterSpacing: 0.5
                    }}>
                    {jobNumber}
                </Typography>
            </Box>

            {/* Pricing Options */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {availableModes.map((opt) => {
                    const isSelected = selectedMode === opt.mode;
                    const disabled = isModeDisabled(opt.mode);
                    return (
                        <Box
                            key={opt.mode}
                            onClick={() => { if (!disabled && !readOnly) setSelectedMode(opt.mode); }}
                            title={disabled ? 'Not available for bulk jobs' : undefined}
                            sx={(theme) => ({
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.75,
                                py: 1.75,
                                px: 2,
                                border: 2,
                                borderColor: isSelected ? 'grey.600' : alpha(theme.palette.common.black, 0.08),
                                borderRadius: 2.5,
                                cursor: (disabled || readOnly) ? 'default' : 'pointer',
                                opacity: disabled ? 0.5 : 1,
                                bgcolor: isSelected ? alpha(theme.palette.grey[600], 0.06) : 'background.paper',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': (disabled || readOnly) ? undefined : {
                                    borderColor: isSelected ? 'grey.600' : alpha(theme.palette.common.black, 0.18),
                                    bgcolor: isSelected ? alpha(theme.palette.grey[600], 0.06) : alpha(theme.palette.common.black, 0.02),
                                },
                            })}
                        >
                            <Radio
                                checked={isSelected}
                                disabled={disabled || readOnly}
                                sx={{
                                    p: 0,
                                    color: 'text.disabled',
                                    '&.Mui-checked': { color: 'grey.600' },
                                }}
                            />
                            <Box sx={(theme) => {
                                const iconBgMap: Record<PricingMode, string> = {
                                    recalculate: alpha(theme.palette.grey[600], 0.12),
                                    base: alpha(theme.palette.success.main, 0.12),
                                    gross: alpha(grossModeColor, 0.12),
                                };
                                return {
                                    width: 40,
                                    height: 40,
                                    borderRadius: 2.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    bgcolor: isSelected ? iconBgMap[opt.mode] : alpha(theme.palette.common.black, 0.06),
                                    color: isSelected ? getSelectedIconColor(opt.mode) : 'text.secondary',
                                    transition: 'all 0.2s ease',
                                };
                            }}>
                                {opt.icon}
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
                                <Typography variant="body1" sx={{
                                    fontWeight: 500
                                }}>
                                    {opt.title}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: "text.secondary",
                                        lineHeight: 1.4
                                    }}>
                                    {disabled ? 'Not available for bulk jobs' : opt.description}
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}
            </Box>

            {/* Amount Input (shown for base/gross modes) */}
            {(selectedMode === 'base' || selectedMode === 'gross') && (
                <Box sx={(theme) => ({
                    mt: 2.5,
                    pt: 2.5,
                    borderTop: `1px solid ${alpha(theme.palette.common.black, 0.08)}`,
                    '@keyframes slideDown': {
                        from: { opacity: 0, transform: 'translateY(-8px)' },
                        to: { opacity: 1, transform: 'translateY(0)' },
                    },
                    animation: 'slideDown 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                })}>
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 500,
                            color: "text.secondary",
                            mb: 1.25
                        }}>
                        {selectedMode === 'base' ? 'Enter Base Amount' : 'Enter Final Amount'}
                    </Typography>
                    <TextField
                        fullWidth
                        type="number"
                        value={amount || ''}
                        onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        disabled={readOnly}
                        autoFocus={!readOnly}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Typography sx={{ fontSize: 24, fontWeight: 500, color: 'text.secondary' }}>
                                            $
                                        </Typography>
                                    </InputAdornment>
                                ),
                            },
                            htmlInput: {
                                step: '0.01',
                                min: '0',
                                onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur(),
                                style: {
                                    fontSize: 28,
                                    fontWeight: 600,
                                    padding: '8px 0',
                                },
                            },
                        }}
                        sx={(theme) => ({
                            '& .MuiOutlinedInput-root': {
                                bgcolor: alpha(theme.palette.common.black, 0.04),
                                borderRadius: 2.5,
                                '& fieldset': { border: '2px solid transparent' },
                                '&:hover fieldset': { borderColor: 'transparent' },
                                '&.Mui-focused': {
                                    bgcolor: 'background.paper',
                                    '& fieldset': { borderColor: 'grey.600' },
                                },
                            },
                            // Hide number spinner
                            '& input[type=number]': {
                                MozAppearance: 'textfield',
                            },
                            '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0,
                            },
                        })}
                    />
                </Box>
            )}

            {/* Sum mismatch indicator — shown in gross/base modes when children are present */}
            {(selectedMode === 'gross' || selectedMode === 'base') && childSum !== null && (
                <Box sx={(theme) => ({
                    mt: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: hasChildSumMismatch
                        ? alpha(theme.palette.error.main, 0.06)
                        : alpha(theme.palette.success.main, 0.06),
                    border: `1px solid ${hasChildSumMismatch
                        ? alpha(theme.palette.error.main, 0.25)
                        : alpha(theme.palette.success.main, 0.25)}`,
                })}>
                    <Typography variant="caption" color={hasChildSumMismatch ? 'error.main' : 'success.main'} sx={{
                        fontWeight: 500
                    }}>
                        {hasChildSumMismatch
                            ? `Parent must equal children total — set to $${childSum.toFixed(2)}`
                            : 'Parent matches children total'}
                    </Typography>
                    <Typography variant="caption" color={hasChildSumMismatch ? 'error.main' : 'success.main'} sx={{
                        fontWeight: 700
                    }}>
                        ${childSum.toFixed(2)}
                    </Typography>
                </Box>
            )}

            {/* Child jobs — hidden in recalculate mode since the system sets the price */}
            {childJobs && childJobs.length > 0 && selectedMode !== 'recalculate' && (
                <Box sx={(theme) => ({
                    mt: 2.5,
                    pt: 2.5,
                    borderTop: `1px solid ${alpha(theme.palette.common.black, 0.08)}`,
                })}>
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5}}>
                        <Typography
                            variant="body2"
                            sx={{
                                fontWeight: 500,
                                color: "text.secondary"
                            }}>
                            Child Jobs
                        </Typography>
                        {(selectedMode === 'gross' || selectedMode === 'base') && amount > 0 && (
                            <Button
                                size="small"
                                variant="text"
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
                                sx={{fontSize: '0.75rem', py: 0.25, px: 1, minWidth: 0, textTransform: 'none'}}
                            >
                                Set proportionally
                            </Button>
                        )}
                    </Box>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
                        {childJobs.map((child) => {
                            const currentAmount = childAmounts[child.jobId] ?? child.charge;
                            const isChanged = Math.abs(currentAmount - child.charge) > 0.001;
                            return (
                                <Box
                                    key={child.jobId}
                                    sx={(theme) => ({
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        py: 1.25,
                                        px: 1.5,
                                        bgcolor: alpha(theme.palette.common.black, 0.03),
                                        borderRadius: 2,
                                        border: `1px solid ${isChanged ? theme.palette.primary.main : alpha(theme.palette.common.black, 0.08)}`,
                                        transition: 'border-color 0.2s ease',
                                    })}
                                >
                                    <Box sx={(theme) => ({
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 0.75,
                                        px: 1.25,
                                        py: 0.5,
                                        bgcolor: alpha(theme.palette.grey[600], 0.1),
                                        borderRadius: 4,
                                        flexShrink: 0,
                                    })}>
                                        <LocalShippingIcon sx={{fontSize: 13, color: 'text.secondary'}} />
                                        <Typography variant="caption" noWrap sx={{
                                            fontWeight: 600
                                        }}>
                                            {child.jobNumber}
                                        </Typography>
                                    </Box>
                                    <TextField
                                        type="number"
                                        value={currentAmount || ''}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            setChildAmounts(prev => ({...prev, [child.jobId]: val}));
                                        }}
                                        disabled={readOnly}
                                        size="small"
                                        slotProps={{
                                            input: {
                                                startAdornment: (
                                                    <InputAdornment position="start">$</InputAdornment>
                                                ),
                                            },
                                            htmlInput: {step: '0.01', min: '0', onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur()},
                                        }}
                                        sx={(theme) => ({
                                            flex: 1,
                                            '& .MuiOutlinedInput-root': {
                                                '& fieldset': {borderColor: isChanged ? theme.palette.primary.main : undefined},
                                            },
                                            // Hide number spinner
                                            '& input[type=number]': {MozAppearance: 'textfield'},
                                            '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                                WebkitAppearance: 'none',
                                                margin: 0,
                                            },
                                        })}
                                    />
                                    {isChanged && (
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: "text.disabled",
                                                flexShrink: 0,
                                                minWidth: 60,
                                                textAlign: 'right'
                                            }}>
                                            was ${child.charge.toFixed(2)}
                                        </Typography>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            )}

            {/* Error message */}
            {errorMessage && (
                <Typography color="error" variant="body2" sx={{ mt: 2 }}>
                    {errorMessage}
                </Typography>
            )}
        </Box>
    );

    const renderLoadingState = () => (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 7.5,
            px: 3,
            gap: 2,
        }}>
            <CircularProgress size={48} />
            <Typography
                variant="body1"
                sx={{
                    color: "text.secondary",
                    fontWeight: 500
                }}>
                Saving price...
            </Typography>
        </Box>
    );

    const renderSuccessState = () => (
        <Box sx={{ py: 4, px: 3, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
            <Typography
                variant="h6"
                sx={{
                    fontWeight: 600,
                    mb: 1
                }}>
                Price Updated
            </Typography>
            <Typography
                variant="body2"
                sx={{
                    color: "text.secondary",
                    mb: 3
                }}>
                {getModeSubtitle(selectedMode)}
            </Typography>

            {/* New Price Display */}
            <Box sx={(theme) => ({
                bgcolor: alpha(theme.palette.success.main, 0.08),
                border: `2px solid ${alpha(theme.palette.success.main, 0.2)}`,
                borderRadius: 3,
                p: 2.5,
                mb: 2.5,
            })}>
                <Typography
                    variant="caption"
                    sx={{
                        color: "text.secondary",
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        display: 'block',
                        mb: 0.5
                    }}>
                    New Price
                </Typography>
                <Typography sx={{ fontSize: 36, fontWeight: 700, color: 'success.main' }}>
                    ${savedAmount.toFixed(2)}
                </Typography>
            </Box>

            {/* Price Comparison */}
            {currentCharge !== savedAmount && (
                <Box sx={(theme) => ({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    p: 2,
                    bgcolor: alpha(theme.palette.common.black, 0.03),
                    borderRadius: 2.5,
                    mb: 2.5,
                })}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography
                            variant="caption"
                            sx={{
                                color: "text.secondary",
                                display: "block",
                                mb: 0.5
                            }}>
                            Previous Price
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                fontWeight: 600,
                                color: "text.secondary"
                            }}>
                            ${currentCharge.toFixed(2)}
                        </Typography>
                    </Box>
                    <ArrowForwardIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography
                            variant="caption"
                            sx={{
                                color: "text.secondary",
                                display: "block",
                                mb: 0.5
                            }}>
                            New Price
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                fontWeight: 600,
                                color: "success.main"
                            }}>
                            ${savedAmount.toFixed(2)}
                        </Typography>
                    </Box>
                </Box>
            )}

            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
            }}>
                <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" sx={{
                    color: "text.secondary"
                }}>
                    Job {jobNumber} has been updated
                </Typography>
            </Box>
        </Box>
    );

    return (
        <Dialog
            open={open}
            onClose={isLoading ? undefined : onClose}
            maxWidth="sm"
            disableEnforceFocus
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        overflow: 'hidden',
                        width: childJobs && childJobs.length > 0 ? 480 : 420,
                        maxWidth: '95vw',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                    },
                },
            }}
        >
            {/* Header */}
            <Box sx={{flexShrink: 0}}>
                <DialogHeader
                    icon={readOnly ? <LockOutlinedIcon/> : <PriceChangeIcon/>}
                    title="Edit Price"
                    subtitle={readOnly ? 'View only — this job is locked' : 'Adjust the job price'}
                    onClose={onClose}
                    closeDisabled={isLoading}
                />
            </Box>
            {/* Content — scrollable so action buttons remain visible */}
            <Box sx={{overflowY: 'auto', flex: 1}}>
                {isLoading && renderLoadingState()}
                {showResult && !isLoading && renderSuccessState()}
                {!showResult && !isLoading && renderEditState()}
            </Box>
            {/* Actions for result state */}
            {showResult && !isLoading && (
                <Box sx={{
                    px: 2,
                    py: 2,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    flexShrink: 0,
                }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleDone}
                        startIcon={<CheckIcon />}
                        sx={{ minWidth: 120, borderRadius: 2, fontWeight: 500 }}
                    >
                        Done
                    </Button>
                </Box>
            )}
            {/* Actions for edit state */}
            {!showResult && !isLoading && (
                <Box sx={{
                    px: 2,
                    py: 2,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 1,
                    flexShrink: 0,
                }}>
                    <Button
                        variant="outlined"
                        onClick={onClose}
                        sx={{ minWidth: 80, color: 'text.secondary', borderColor: 'divider' }}
                    >
                        {readOnly ? 'Close' : 'Cancel'}
                    </Button>
                    {!readOnly && (
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSubmit}
                            disabled={isSubmitDisabled}
                            startIcon={selectedMode === 'recalculate' ? <SyncIcon /> : undefined}
                            sx={{ minWidth: 120, borderRadius: 2, fontWeight: 500 }}
                        >
                            {getSubmitButtonText(selectedMode)}
                        </Button>
                    )}
                </Box>
            )}
        </Dialog>
    );
};

export default SimplePriceEditDialog;
