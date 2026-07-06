/**
 * React Bulk Price Upload Dialog
 *
 * A multi-step wizard dialog for bulk uploading price changes.
 * States: upload -> mode-select -> loading -> result
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {formatCurrency} from '../../../utils/currencyUtils';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import SyncIcon from '@mui/icons-material/Sync';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditNoteIcon from '@mui/icons-material/EditNote';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
    BulkPriceUploadDialogProps,
    BulkPricePreviewRow,
    BulkPricePreviewResponse,
    PricingMode,
    DialogState,
} from './types';
import {headerChipSx, headerChromeSx, headerOnColor, headerOverlayColor} from '../shared/styles';

const VALID_EXTENSIONS = ['.xls', '.xlsx', '.csv'];

export const BulkPriceUploadDialog: React.FC<BulkPriceUploadDialogProps> = ({
    open,
    onClose,
    onSubmit,
    showToast,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [currentState, setCurrentState] = useState<DialogState>('upload');
    const [selectedMode, setSelectedMode] = useState<PricingMode>('recalculate');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [resultRows, setResultRows] = useState<BulkPricePreviewRow[]>([]);
    const [filteredRows, setFilteredRows] = useState<BulkPricePreviewRow[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [totalJobs, setTotalJobs] = useState(0);
    const [skippedJobs, setSkippedJobs] = useState(0);
    const [totalOldAmount, setTotalOldAmount] = useState(0);
    const [totalNewAmount, setTotalNewAmount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [loadingMessage, setLoadingMessage] = useState('');

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setCurrentState('upload');
            setSelectedMode('recalculate');
            setUploadedFile(null);
            setIsDragOver(false);
            setResultRows([]);
            setFilteredRows([]);
            setSearchTerm('');
            setTotalJobs(0);
            setSkippedJobs(0);
            setTotalOldAmount(0);
            setTotalNewAmount(0);
            setIsLoading(false);
            setErrorMessage('');
            setLoadingMessage('');
        }
    }, [open]);

    // File handling
    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleFileSelect = useCallback((file: File): void => {
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!VALID_EXTENSIONS.includes(extension)) {
            setErrorMessage('Invalid file format. Please upload an Excel (.xls, .xlsx) or CSV file.');
            return;
        }

        setUploadedFile(file);
        setErrorMessage('');
        setCurrentState('mode-select');
    }, []);

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);

        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            handleFileSelect(files[0]);
        }
    }, [handleFileSelect]);

    const handleFileInputClick = useCallback((): void => {
        fileInputRef.current?.click();
    }, []);

    const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
        const files = event.target.files;
        if (files && files.length > 0) {
            handleFileSelect(files[0]);
        }
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [handleFileSelect]);

    // Mode selection
    const handleModeSelect = useCallback((mode: PricingMode): void => {
        setSelectedMode(mode);
    }, []);

    const modeDescription = useMemo((): string => {
        switch (selectedMode) {
            case 'recalculate':
                return 'Prices will be recalculated based on job details and current rates';
            case 'base':
                return 'Raw base amounts from file will be saved with PPD and Fuel added';
            case 'gross':
                return 'Amounts from file will be applied directly as final prices';
            default:
                return '';
        }
    }, [selectedMode]);

    const applyButtonText = useMemo((): string => {
        switch (selectedMode) {
            case 'recalculate':
                return 'Recalculate & Save';
            case 'base':
                return 'Apply Raw Base Amounts';
            case 'gross':
                return 'Apply Gross Amounts';
            default:
                return 'Apply';
        }
    }, [selectedMode]);

    // Apply prices
    const handleApplyPrices = useCallback(async (): Promise<void> => {
        if (!uploadedFile) return;

        setCurrentState('loading');
        setIsLoading(true);
        setLoadingMessage('Applying price changes...');
        setErrorMessage('');

        try {
            const response: BulkPricePreviewResponse = await onSubmit(uploadedFile, selectedMode);

            // The request succeeded, so treat it as applied. Read defensively: a missing or
            // misshaped body must not throw here, or the update would be wrongly reported as a
            // failure even though the server already committed the price changes.
            const rows = response?.rows ?? [];
            const updatedCount = response?.totalJobs ?? 0;
            const skippedCount = response?.skippedJobs ?? 0;

            setResultRows(rows);
            setFilteredRows([...rows]);
            setTotalJobs(updatedCount);
            setSkippedJobs(skippedCount);
            setTotalOldAmount(response?.totalOldAmount ?? 0);
            setTotalNewAmount(response?.totalNewAmount ?? 0);
            setCurrentState('result');
            setIsLoading(false);
            setLoadingMessage('');

            if (updatedCount === 0 && skippedCount > 0) {
                showToast(
                    `No prices were updated. ${skippedCount} ${skippedCount === 1 ? 'job' : 'jobs'} could not be updated.`,
                    'error',
                );
            } else if (skippedCount > 0) {
                showToast(
                    `Updated ${updatedCount} ${updatedCount === 1 ? 'job' : 'jobs'}; ${skippedCount} skipped.`,
                    'warning',
                );
            } else {
                showToast(`Successfully updated prices for ${updatedCount} jobs.`, 'success');
            }
        } catch (error: unknown) {
            console.error('Error applying prices:', error);
            const msg = error instanceof Error ? error.message : 'Failed to apply prices. Please try again.';
            setErrorMessage(msg);
            setCurrentState('mode-select');
            setIsLoading(false);
            setLoadingMessage('');
            showToast(msg, 'error');
        }
    }, [uploadedFile, selectedMode, onSubmit, showToast]);

    // Search and filter
    const filterByJobNumber = useCallback((term: string, rows: BulkPricePreviewRow[]): void => {
        if (!term.trim()) {
            setFilteredRows([...rows]);
            return;
        }

        const search = term.toLowerCase().trim();
        const filtered = rows.filter((row) =>
            row.jobNo.toLowerCase().includes(search)
        );
        setFilteredRows(filtered);
    }, []);

    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
        const newSearchTerm = event.target.value;
        setSearchTerm(newSearchTerm);
        filterByJobNumber(newSearchTerm, resultRows);
    }, [filterByJobNumber, resultRows]);

    const handleClearSearch = useCallback((): void => {
        setSearchTerm('');
        filterByJobNumber('', resultRows);
    }, [filterByJobNumber, resultRows]);

    // Navigation
    const handleBackToUpload = useCallback((): void => {
        setUploadedFile(null);
        setResultRows([]);
        setFilteredRows([]);
        setSearchTerm('');
        setErrorMessage('');
        setCurrentState('upload');
    }, []);

    const handleDone = useCallback((): void => {
        onClose();
    }, [onClose]);

    const handleCancel = useCallback((): void => {
        onClose();
    }, [onClose]);

    // Calculations
    const amountChange = useMemo((): number => {
        return totalNewAmount - totalOldAmount;
    }, [totalNewAmount, totalOldAmount]);

    const formatChange = (amount: number): string => {
        const formatted = formatCurrency(Math.abs(amount));
        return amount >= 0 ? `+${formatted}` : `-${formatted}`;
    };

    // Render methods
    const renderUploadState = (): React.ReactNode => {
        return (
            <Box sx={{ p: 3 }}>
                {/* Dropzone */}
                <Box sx={{ mb: 2.5 }}>
                    <Box
                        onClick={handleFileInputClick}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 5,
                            border: '2px dashed',
                            borderColor: isDragOver ? 'primary.main' : 'rgba(0, 0, 0, 0.2)',
                            borderRadius: 3,
                            bgcolor: isDragOver ? 'rgba(25, 118, 210, 0.08)' : 'rgba(0, 0, 0, 0.02)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                borderColor: 'rgba(0, 0, 0, 0.35)',
                                bgcolor: 'rgba(0, 0, 0, 0.04)',
                            },
                        }}
                    >
                        <CloudUploadIcon
                            sx={{ fontSize: 48, color: 'text.secondary', mb: 1.5 }}
                        />
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 500,
                                mb: 0.5
                            }}>
                            Drop your file here
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: "text.secondary",
                                mb: 1
                            }}>
                            or click to browse
                        </Typography>
                        <Typography variant="caption" sx={{
                            color: "text.disabled"
                        }}>
                            Supports .xls, .xlsx, .csv files
                        </Typography>
                    </Box>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xls,.xlsx,.csv"
                        style={{ display: 'none' }}
                        onChange={handleFileInputChange}
                    />
                </Box>
                {/* Error message */}
                {errorMessage && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            p: 1.5,
                            bgcolor: 'rgba(211, 47, 47, 0.1)',
                            borderRadius: 2,
                            mb: 2,
                        }}
                    >
                        <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                        <Typography variant="body2" sx={{
                            color: "error.main"
                        }}>
                            {errorMessage}
                        </Typography>
                    </Box>
                )}
                {/* File format info */}
                <Box
                    sx={{
                        p: 2,
                        bgcolor: 'rgba(0, 0, 0, 0.03)',
                        borderRadius: 2.5,
                    }}
                >
                    <Typography
                        variant="subtitle2"
                        sx={{
                            fontWeight: 600,
                            mb: 1
                        }}>
                        Expected File Format
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{
                            color: "text.secondary",
                            mb: 1
                        }}>
                        Your spreadsheet should contain a column named <strong>Id</strong> with job IDs, and optionally:
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                        {[
                            { label: 'Amount', desc: 'Raw base or gross amount (depending on mode selected)' },
                            { label: 'Fuel', desc: 'Fuel surcharge' },
                            { label: 'Ppd', desc: 'PPD amount' },
                            { label: 'CourierPayment', desc: 'Courier payment amount' },
                            { label: 'CourierFuel', desc: 'Courier fuel amount' },
                            { label: 'CourierBonus', desc: 'Courier bonus amount' },
                        ].map((item) => (
                            <Box component="li" key={item.label} sx={{ mb: 0.5 }}>
                                <Typography variant="caption" sx={{
                                    color: "text.secondary"
                                }}>
                                    <strong style={{ color: 'rgba(0, 0, 0, 0.87)' }}>{item.label}</strong>
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        );
    };

    const renderModeSelectState = (): React.ReactNode => {
        const modes: { value: PricingMode; title: string; desc: string; icon: React.ReactNode; colorClass: string }[] = [
            {
                value: 'recalculate',
                title: 'Recalculate',
                desc: 'Auto-price based on job details',
                icon: <SyncIcon />,
                colorClass: 'recalculate',
            },
            {
                value: 'base',
                title: 'Raw Base Amount',
                desc: 'Save base price directly from file',
                icon: <AddCircleIcon />,
                colorClass: 'base',
            },
            {
                value: 'gross',
                title: 'Gross Amount',
                desc: 'Apply file amounts directly',
                icon: <EditNoteIcon />,
                colorClass: 'gross',
            },
        ];

        return (
            <Box sx={{ p: 3 }}>
                {/* File badge */}
                <Box
                    sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 1,
                        pl: 1.75,
                        pr: 1,
                        bgcolor: 'rgba(0, 0, 0, 0.06)',
                        borderRadius: 6,
                        mb: 2.5,
                    }}
                >
                    <DescriptionIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                    <Typography
                        variant="body2"
                        sx={{
                            fontWeight: 500,
                            maxWidth: 280,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>
                        {uploadedFile?.name}
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={handleBackToUpload}
                        sx={{ width: 28, height: 28 }}
                    >
                        <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Box>
                {/* Error message */}
                {errorMessage && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            p: 1.5,
                            bgcolor: 'rgba(211, 47, 47, 0.1)',
                            borderRadius: 2,
                            mb: 2,
                        }}
                    >
                        <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                        <Typography variant="body2" sx={{
                            color: "error.main"
                        }}>
                            {errorMessage}
                        </Typography>
                    </Box>
                )}
                <Typography
                    variant="body1"
                    sx={{
                        fontWeight: 600,
                        mb: 2
                    }}>
                    How should prices be applied?
                </Typography>
                {/* Pricing options */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {modes.map((mode) => (
                        <Box
                            key={mode.value}
                            onClick={() => handleModeSelect(mode.value)}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.75,
                                p: 1.75,
                                border: '2px solid',
                                borderColor: selectedMode === mode.value ? 'grey.600' : 'rgba(0, 0, 0, 0.08)',
                                borderRadius: 2.5,
                                bgcolor: selectedMode === mode.value ? 'rgba(87, 83, 78, 0.06)' : 'white',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                    borderColor: selectedMode === mode.value ? 'grey.600' : 'rgba(0, 0, 0, 0.18)',
                                    bgcolor: selectedMode === mode.value ? 'rgba(87, 83, 78, 0.06)' : 'rgba(0, 0, 0, 0.02)',
                                },
                            }}
                        >
                            {/* Radio button */}
                            <Box
                                sx={{
                                    width: 20,
                                    height: 20,
                                    border: '2px solid',
                                    borderColor: selectedMode === mode.value ? 'grey.600' : 'rgba(0, 0, 0, 0.38)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                {selectedMode === mode.value && (
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            bgcolor: 'grey.600',
                                        }}
                                    />
                                )}
                            </Box>

                            {/* Icon */}
                            <Box
                                sx={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 2.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    bgcolor: selectedMode === mode.value
                                        ? mode.colorClass === 'recalculate'
                                            ? 'rgba(87, 83, 78, 0.12)'
                                            : mode.colorClass === 'base'
                                                ? 'rgba(76, 175, 80, 0.12)'
                                                : 'rgba(156, 39, 176, 0.12)'
                                        : 'rgba(0, 0, 0, 0.06)',
                                    color: selectedMode === mode.value
                                        ? mode.colorClass === 'recalculate'
                                            ? 'grey.600'
                                            : mode.colorClass === 'base'
                                                ? 'success.main'
                                                : 'secondary.main'
                                        : 'text.secondary',
                                    transition: 'all 0.2s ease',
                                    '& svg': { fontSize: 22 },
                                }}
                            >
                                {mode.icon}
                            </Box>

                            {/* Text */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
                                <Typography variant="body1" sx={{
                                    fontWeight: 500
                                }}>
                                    {mode.title}
                                </Typography>
                                <Typography variant="caption" sx={{
                                    color: "text.secondary"
                                }}>
                                    {mode.desc}
                                </Typography>
                            </Box>
                        </Box>
                    ))}
                </Box>
                {/* Mode hint */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mt: 2,
                        p: 1.5,
                        bgcolor: 'rgba(25, 118, 210, 0.08)',
                        borderRadius: 2,
                    }}
                >
                    <InfoIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="body2" sx={{
                        color: "text.secondary"
                    }}>
                        {modeDescription}
                    </Typography>
                </Box>
            </Box>
        );
    };

    const renderLoadingState = (): React.ReactNode => {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 7.5,
                    px: 3,
                    gap: 2,
                }}
            >
                <CircularProgress size={48} />
                <Typography
                    variant="body1"
                    sx={{
                        color: "text.secondary",
                        fontWeight: 500
                    }}>
                    {loadingMessage || 'Processing...'}
                </Typography>
            </Box>
        );
    };

    const renderResultState = (): React.ReactNode => {
        const noneUpdated = totalJobs === 0 && skippedJobs > 0;
        const partial = totalJobs > 0 && skippedJobs > 0;
        const headerColor = noneUpdated ? 'error.main' : partial ? 'warning.main' : 'success.main';
        const headerBg = noneUpdated
            ? 'rgba(211, 47, 47, 0.12)'
            : partial
                ? 'rgba(237, 108, 2, 0.12)'
                : 'rgba(76, 175, 80, 0.12)';
        const headerTitle = noneUpdated ? 'No Prices Updated' : partial ? 'Partially Updated' : 'Prices Updated';
        const HeaderIcon = noneUpdated ? ErrorIcon : partial ? WarningAmberIcon : CheckCircleIcon;

        return (
            <Box sx={{ p: 2 }}>
                {/* Result header */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        py: 3,
                    }}
                >
                    <Box
                        sx={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            bgcolor: headerBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 1.5,
                        }}
                    >
                        <HeaderIcon sx={{ fontSize: 32, color: headerColor }} />
                    </Box>
                    <Typography variant="h6" sx={{
                        fontWeight: 600
                    }}>
                        {headerTitle}
                    </Typography>
                    {skippedJobs > 0 && (
                        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                            {skippedJobs} {skippedJobs === 1 ? 'job' : 'jobs'} could not be updated — see the highlighted rows below.
                        </Typography>
                    )}
                </Box>
                {/* Summary stats */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        bgcolor: 'rgba(0, 0, 0, 0.03)',
                        borderRadius: 2.5,
                        mb: 2,
                        gap: 1.5,
                    }}
                >
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography variant="subtitle1" sx={{
                            fontWeight: 600
                        }}>
                            {totalJobs}
                        </Typography>
                        <Typography variant="caption" sx={{
                            color: "text.secondary"
                        }}>
                            Jobs Updated
                        </Typography>
                    </Box>
                    {skippedJobs > 0 && (
                        <Box sx={{ textAlign: 'center', flex: 1 }}>
                            <Typography variant="subtitle1" sx={{
                                fontWeight: 600,
                                color: 'warning.main'
                            }}>
                                {skippedJobs}
                            </Typography>
                            <Typography variant="caption" sx={{
                                color: "text.secondary"
                            }}>
                                Skipped
                            </Typography>
                        </Box>
                    )}
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography variant="subtitle1" sx={{
                            fontWeight: 600
                        }}>
                            {formatCurrency(totalOldAmount)}
                        </Typography>
                        <Typography variant="caption" sx={{
                            color: "text.secondary"
                        }}>
                            Previous Total
                        </Typography>
                    </Box>
                    <ArrowForwardIcon sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography variant="subtitle1" sx={{
                            fontWeight: 600
                        }}>
                            {formatCurrency(totalNewAmount)}
                        </Typography>
                        <Typography variant="caption" sx={{
                            color: "text.secondary"
                        }}>
                            New Total
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 600,
                                color: amountChange > 0 ? 'success.main' : amountChange < 0 ? 'error.main' : 'text.secondary'
                            }}>
                            {formatChange(amountChange)}
                        </Typography>
                        <Typography variant="caption" sx={{
                            color: "text.secondary"
                        }}>
                            Change
                        </Typography>
                    </Box>
                </Box>
                {/* Search */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        mb: 1.5,
                    }}
                >
                    <TextField
                        size="small"
                        placeholder="Search by job number..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        sx={{ flex: 1 }}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: searchTerm ? (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={handleClearSearch}>
                                            <CloseIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            },
                        }}
                    />
                    <Typography
                        variant="caption"
                        sx={{
                            color: "text.secondary",
                            whiteSpace: 'nowrap'
                        }}>
                        {filteredRows.length} of {resultRows.length} jobs
                    </Typography>
                </Box>
                {/* Results table */}
                <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{
                        maxHeight: 300,
                        border: '1px solid rgba(0, 0, 0, 0.08)',
                        borderRadius: 2,
                    }}
                >
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', bgcolor: 'rgba(0, 0, 0, 0.03)' }}>
                                    Job #
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', bgcolor: 'rgba(0, 0, 0, 0.03)' }}>
                                    Field
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', bgcolor: 'rgba(0, 0, 0, 0.03)' }}>
                                    Previous
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', bgcolor: 'rgba(0, 0, 0, 0.03)' }}>
                                    New Amount
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', bgcolor: 'rgba(0, 0, 0, 0.03)' }}>
                                    Change
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredRows.map((row) => {
                                const rowChange = row.newAmount - row.oldAmount;
                                return (
                                    <TableRow
                                        key={`${row.jobId}_${row.field}`}
                                        hover
                                        sx={{
                                            bgcolor: row.skipped ? 'rgba(237, 108, 2, 0.08)' : undefined,
                                        }}
                                    >
                                        <TableCell sx={{ fontWeight: 500 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                {row.skipped && (
                                                    <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                                                )}
                                                {row.jobNo}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            {row.skipped ? (
                                                <Typography variant="caption" sx={{ color: 'warning.dark' }}>
                                                    {row.error || 'Skipped'}
                                                </Typography>
                                            ) : (
                                                row.field
                                            )}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{ fontFamily: '"Roboto Mono", monospace' }}
                                        >
                                            {formatCurrency(row.oldAmount)}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{ fontFamily: '"Roboto Mono", monospace' }}
                                        >
                                            {row.skipped ? '—' : formatCurrency(row.newAmount)}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                fontFamily: '"Roboto Mono", monospace',
                                                color: row.skipped
                                                    ? 'warning.main'
                                                    : rowChange > 0 ? 'success.main' : rowChange < 0 ? 'error.main' : 'inherit',
                                            }}
                                        >
                                            {row.skipped ? 'Skipped' : formatChange(rowChange)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {filteredRows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                                        <SearchOffIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                                        <Typography variant="body2" sx={{
                                            color: "text.secondary"
                                        }}>
                                            No jobs match your search
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        );
    };

    return (
        <Dialog
            open={open}
            onClose={!isLoading ? onClose : undefined}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        overflow: 'hidden',
                        width: 600,
                        maxWidth: '95vw',
                        maxHeight: '90vh',
                    },
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    ...headerChromeSx(theme),
                    minHeight: 48,
                })}
            >
                <Box sx={(theme) => headerChipSx(theme)}>
                    <UploadFileIcon/>
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{
                        fontWeight: 500
                    }}>
                        Bulk Price Upload
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        Upload prices from a spreadsheet
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    disabled={isLoading}
                    sx={(theme) => ({
                        color: headerOnColor(theme),
                        '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)},
                    })}
                >
                    <CloseIcon />
                </IconButton>
            </Box>
            {/* Content */}
            <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
                {currentState === 'upload' && renderUploadState()}
                {currentState === 'mode-select' && renderModeSelectState()}
                {currentState === 'loading' && renderLoadingState()}
                {currentState === 'result' && renderResultState()}
            </DialogContent>
            {/* Actions */}
            <DialogActions
                sx={(theme) => ({
                    px: 2,
                    py: 2,
                    bgcolor: 'background.paper',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    gap: 1,
                })}
            >
                {currentState === 'upload' && (
                    <Button onClick={handleCancel} color="inherit">
                        Cancel
                    </Button>
                )}

                {currentState === 'mode-select' && (
                    <>
                        <Button
                            onClick={handleBackToUpload}
                            color="inherit"
                            startIcon={<ArrowBackIcon />}
                        >
                            Back
                        </Button>
                        <Button
                            onClick={handleApplyPrices}
                            variant="contained"
                            color="primary"
                            startIcon={<CheckIcon />}
                            sx={{ minWidth: 140 }}
                        >
                            {applyButtonText}
                        </Button>
                    </>
                )}

                {currentState === 'result' && (
                    <Button
                        onClick={handleDone}
                        variant="contained"
                        color="primary"
                        startIcon={<CheckIcon />}
                        sx={{ minWidth: 140 }}
                    >
                        Done
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default BulkPriceUploadDialog;
