/**
 * SimplePriceEditDialog Component
 *
 * React replacement for the AngularJS simple-price-edit-dialog.
 * Provides a fallback pricing interface for non-US customers without price breakdowns.
 * Supports three pricing modes: recalculate, raw base amount, and gross amount.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { alpha } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Radio from '@mui/material/Radio';
import InputAdornment from '@mui/material/InputAdornment';
import PriceChangeIcon from '@mui/icons-material/PriceChange';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SyncIcon from '@mui/icons-material/Sync';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InfoIcon from '@mui/icons-material/Info';
import CheckIcon from '@mui/icons-material/Check';

import { SimplePriceEditDialogProps, PricingMode } from './types';

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
        title: 'Recalculate',
        description: 'Auto-price based on job details',
        icon: <SyncIcon sx={{ fontSize: 22 }} />,
        iconColorClass: 'recalculate',
    },
    {
        mode: 'base',
        title: 'Raw Base Amount',
        description: 'Set the base price directly',
        icon: <AddCircleIcon sx={{ fontSize: 22 }} />,
        iconColorClass: 'base',
    },
    {
        mode: 'gross',
        title: 'Gross Amount',
        description: 'Set final price directly',
        icon: <EditNoteIcon sx={{ fontSize: 22 }} />,
        iconColorClass: 'gross',
    },
];

/** Purple used exclusively for the "gross" pricing mode (no theme palette equivalent). */
const GROSS_MODE_COLOR = '#9c27b0';

const getSelectedIconColor = (mode: PricingMode) => {
    switch (mode) {
        case 'recalculate': return 'grey.600';
        case 'base': return 'success.main';
        case 'gross': return GROSS_MODE_COLOR;
    }
};

const getSubmitButtonText = (mode: PricingMode) => {
    switch (mode) {
        case 'recalculate': return 'Recalculate & Save';
        case 'base': return 'Apply Raw Base';
        case 'gross': return 'Apply Amount';
    }
};

const getModeSubtitle = (mode: PricingMode) => {
    switch (mode) {
        case 'recalculate': return 'Recalculated based on job details';
        case 'base': return 'Raw base amount applied';
        case 'gross': return 'Gross amount applied';
    }
};

export const SimplePriceEditDialog: React.FC<SimplePriceEditDialogProps> = ({
    open,
    jobNumber,
    currentCharge,
    onClose,
    onSubmit,
    showToast,
}) => {
    const [selectedMode, setSelectedMode] = useState<PricingMode>('recalculate');
    const [amount, setAmount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showResult, setShowResult] = useState(false);
    const [savedAmount, setSavedAmount] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedMode('recalculate');
            setAmount(Math.round(currentCharge * 100) / 100);
            setIsLoading(false);
            setShowResult(false);
            setSavedAmount(0);
            setErrorMessage('');
        }
    }, [open, currentCharge]);

    const isSubmitDisabled = useCallback(() => {
        if (isLoading) return true;
        if (selectedMode === 'recalculate') return false;
        return !amount || amount <= 0;
    }, [isLoading, selectedMode, amount]);

    const handleSubmit = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage('');

        try {
            const resultAmount = await onSubmit(selectedMode, amount);
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
    }, [selectedMode, amount, onSubmit, showToast]);

    const handleDone = useCallback(() => {
        onClose();
    }, [onClose]);

    // --- Render helpers ---

    const renderEditState = () => (
        <Box sx={{ p: '20px 24px 24px' }}>
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
                <Typography variant="body2" fontWeight={600} letterSpacing={0.5}>
                    {jobNumber}
                </Typography>
            </Box>

            {/* Pricing Options */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {MODE_OPTIONS.map((opt) => {
                    const isSelected = selectedMode === opt.mode;
                    return (
                        <Box
                            key={opt.mode}
                            onClick={() => setSelectedMode(opt.mode)}
                            sx={(theme) => ({
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.75,
                                p: '14px 16px',
                                border: 2,
                                borderColor: isSelected ? 'grey.600' : alpha(theme.palette.common.black, 0.08),
                                borderRadius: 2.5,
                                cursor: 'pointer',
                                bgcolor: isSelected ? alpha(theme.palette.grey[600], 0.06) : 'background.paper',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                    borderColor: isSelected ? 'grey.600' : alpha(theme.palette.common.black, 0.18),
                                    bgcolor: isSelected ? alpha(theme.palette.grey[600], 0.06) : alpha(theme.palette.common.black, 0.02),
                                },
                            })}
                        >
                            <Radio
                                checked={isSelected}
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
                                    gross: alpha(GROSS_MODE_COLOR, 0.12),
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
                                <Typography variant="body1" fontWeight={500}>
                                    {opt.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" lineHeight={1.4}>
                                    {opt.description}
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
                    <Typography variant="body2" fontWeight={500} color="text.secondary" sx={{ mb: 1.25 }}>
                        {selectedMode === 'base' ? 'Enter Raw Base Amount' : 'Enter Final Amount'}
                    </Typography>
                    <TextField
                        fullWidth
                        type="number"
                        value={amount || ''}
                        onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        autoFocus
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
            <Typography variant="body1" color="text.secondary" fontWeight={500}>
                Saving price...
            </Typography>
        </Box>
    );

    const renderSuccessState = () => (
        <Box sx={{ p: '32px 24px', textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                Price Updated
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
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
                <Typography variant="caption" color="text.secondary" sx={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    display: 'block',
                    mb: 0.5,
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
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            Previous Price
                        </Typography>
                        <Typography variant="body1" fontWeight={600} color="text.secondary">
                            ${currentCharge.toFixed(2)}
                        </Typography>
                    </Box>
                    <ArrowForwardIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            New Price
                        </Typography>
                        <Typography variant="body1" fontWeight={600} color="success.main">
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
                <Typography variant="caption" color="text.secondary">
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
                        borderRadius: 2,
                        overflow: 'hidden',
                        width: 420,
                        maxWidth: '95vw',
                    },
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    px: 3,
                    py: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    minHeight: 56,
                })}
            >
                <PriceChangeIcon sx={{ fontSize: 24 }} />
                <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
                    Edit Price
                </Typography>
                <IconButton
                    onClick={onClose}
                    disabled={isLoading}
                    sx={(theme) => ({
                        color: 'white',
                        '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.1) },
                    })}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            {isLoading && renderLoadingState()}
            {showResult && !isLoading && renderSuccessState()}
            {!showResult && !isLoading && renderEditState()}

            {/* Actions for result state */}
            {showResult && !isLoading && (
                <Box sx={{
                    px: 2,
                    py: 2,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    justifyContent: 'flex-end',
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
                }}>
                    <Button
                        variant="outlined"
                        onClick={onClose}
                        sx={{ minWidth: 80, color: 'text.secondary', borderColor: 'divider' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSubmit}
                        disabled={isSubmitDisabled()}
                        startIcon={selectedMode === 'recalculate' ? <SyncIcon /> : undefined}
                        sx={{ minWidth: 120, borderRadius: 2, fontWeight: 500 }}
                    >
                        {getSubmitButtonText(selectedMode)}
                    </Button>
                </Box>
            )}
        </Dialog>
    );
};

export default SimplePriceEditDialog;
