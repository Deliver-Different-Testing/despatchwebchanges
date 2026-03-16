/**
 * React Bulk Price Upload Dialog
 *
 * A multi-step wizard dialog for bulk uploading price changes.
 * States: upload -> mode-select -> loading -> result
 */

import React from 'react';
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
import {
    BulkPriceUploadDialogProps,
    BulkPricePreviewRow,
    BulkPricePreviewResponse,
    PricingMode,
    DialogState,
} from './types';

interface BulkPriceUploadDialogState {
    currentState: DialogState;
    selectedMode: PricingMode;
    uploadedFile: File | null;
    isDragOver: boolean;
    resultRows: BulkPricePreviewRow[];
    filteredRows: BulkPricePreviewRow[];
    searchTerm: string;
    totalJobs: number;
    totalOldAmount: number;
    totalNewAmount: number;
    isLoading: boolean;
    errorMessage: string;
    loadingMessage: string;
}

const VALID_EXTENSIONS = ['.xls', '.xlsx', '.csv'];

export class BulkPriceUploadDialog extends React.Component<
    BulkPriceUploadDialogProps,
    BulkPriceUploadDialogState
> {
    private fileInputRef = React.createRef<HTMLInputElement>();

    constructor(props: BulkPriceUploadDialogProps) {
        super(props);
        this.state = this.getInitialState();
    }

    private getInitialState(): BulkPriceUploadDialogState {
        return {
            currentState: 'upload',
            selectedMode: 'recalculate',
            uploadedFile: null,
            isDragOver: false,
            resultRows: [],
            filteredRows: [],
            searchTerm: '',
            totalJobs: 0,
            totalOldAmount: 0,
            totalNewAmount: 0,
            isLoading: false,
            errorMessage: '',
            loadingMessage: '',
        };
    }

    componentDidUpdate(prevProps: BulkPriceUploadDialogProps): void {
        // Reset state when dialog opens
        if (this.props.open && !prevProps.open) {
            this.setState(this.getInitialState());
        }
    }

    // File handling
    private handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        this.setState({ isDragOver: true });
    };

    private handleDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        this.setState({ isDragOver: false });
    };

    private handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        this.setState({ isDragOver: false });

        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
            this.handleFileSelect(files[0]);
        }
    };

    private handleFileInputClick = (): void => {
        this.fileInputRef.current?.click();
    };

    private handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const files = event.target.files;
        if (files && files.length > 0) {
            this.handleFileSelect(files[0]);
        }
        // Reset input so same file can be selected again
        if (this.fileInputRef.current) {
            this.fileInputRef.current.value = '';
        }
    };

    private handleFileSelect = (file: File): void => {
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!VALID_EXTENSIONS.includes(extension)) {
            this.setState({
                errorMessage: 'Invalid file format. Please upload an Excel (.xls, .xlsx) or CSV file.',
            });
            return;
        }

        this.setState({
            uploadedFile: file,
            errorMessage: '',
            currentState: 'mode-select',
        });
    };

    // Mode selection
    private handleModeSelect = (mode: PricingMode): void => {
        this.setState({ selectedMode: mode });
    };

    private getModeDescription(): string {
        switch (this.state.selectedMode) {
            case 'recalculate':
                return 'Prices will be recalculated based on job details and current rates';
            case 'base':
                return 'Raw base amounts from file will be saved with PPD and Fuel added';
            case 'gross':
                return 'Amounts from file will be applied directly as final prices';
            default:
                return '';
        }
    }

    private getApplyButtonText(): string {
        switch (this.state.selectedMode) {
            case 'recalculate':
                return 'Recalculate & Save';
            case 'base':
                return 'Apply Raw Base Amounts';
            case 'gross':
                return 'Apply Gross Amounts';
            default:
                return 'Apply';
        }
    }

    // Apply prices
    private handleApplyPrices = async (): Promise<void> => {
        const { uploadedFile, selectedMode } = this.state;
        const { onSubmit, showToast } = this.props;

        if (!uploadedFile) return;

        this.setState({
            currentState: 'loading',
            isLoading: true,
            loadingMessage: 'Applying price changes...',
            errorMessage: '',
        });

        try {
            const response: BulkPricePreviewResponse = await onSubmit(uploadedFile, selectedMode);

            this.setState({
                resultRows: response.rows,
                filteredRows: [...response.rows],
                totalJobs: response.totalJobs,
                totalOldAmount: response.totalOldAmount,
                totalNewAmount: response.totalNewAmount,
                currentState: 'result',
                isLoading: false,
                loadingMessage: '',
            });

            showToast(`Successfully updated prices for ${response.totalJobs} jobs.`, 'success');
        } catch (error: unknown) {
            console.error('Error applying prices:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to apply prices. Please try again.';
            this.setState({
                errorMessage,
                currentState: 'mode-select',
                isLoading: false,
                loadingMessage: '',
            });
            showToast(errorMessage, 'error');
        }
    };

    // Search and filter
    private handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const searchTerm = event.target.value;
        this.setState({ searchTerm }, () => this.filterByJobNumber());
    };

    private handleClearSearch = (): void => {
        this.setState({ searchTerm: '' }, () => this.filterByJobNumber());
    };

    private filterByJobNumber(): void {
        const { searchTerm, resultRows } = this.state;

        if (!searchTerm.trim()) {
            this.setState({ filteredRows: [...resultRows] });
            return;
        }

        const search = searchTerm.toLowerCase().trim();
        const filteredRows = resultRows.filter((row) =>
            row.jobNo.toLowerCase().includes(search)
        );
        this.setState({ filteredRows });
    }

    // Navigation
    private handleBackToUpload = (): void => {
        this.setState({
            uploadedFile: null,
            resultRows: [],
            filteredRows: [],
            searchTerm: '',
            errorMessage: '',
            currentState: 'upload',
        });
    };

    private handleDone = (): void => {
        this.props.onClose();
    };

    private handleCancel = (): void => {
        this.props.onClose();
    };

    // Calculations
    private getAmountChange(): number {
        return this.state.totalNewAmount - this.state.totalOldAmount;
    }

    private formatCurrency(amount: number): string {
        return `$${amount.toFixed(2)}`;
    }

    private formatChange(amount: number): string {
        if (amount >= 0) {
            return `+$${amount.toFixed(2)}`;
        }
        return `-$${Math.abs(amount).toFixed(2)}`;
    }

    // Render methods
    private renderUploadState(): React.ReactNode {
        const { isDragOver, errorMessage } = this.state;

        return (
            <Box sx={{ p: 3 }}>
                {/* Dropzone */}
                <Box sx={{ mb: 2.5 }}>
                    <Box
                        onClick={this.handleFileInputClick}
                        onDragOver={this.handleDragOver}
                        onDragLeave={this.handleDragLeave}
                        onDrop={this.handleDrop}
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
                        <Typography variant="subtitle1" fontWeight={500} sx={{ mb: 0.5 }}>
                            Drop your file here
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            or click to browse
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                            Supports .xls, .xlsx, .csv files
                        </Typography>
                    </Box>
                    <input
                        ref={this.fileInputRef}
                        type="file"
                        accept=".xls,.xlsx,.csv"
                        style={{ display: 'none' }}
                        onChange={this.handleFileInputChange}
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
                        <Typography variant="body2" color="error.main">
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
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                        Expected File Format
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
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
                                <Typography variant="caption" color="text.secondary">
                                    <strong style={{ color: 'rgba(0, 0, 0, 0.87)' }}>{item.label}</strong>
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        );
    }

    private renderModeSelectState(): React.ReactNode {
        const { uploadedFile, selectedMode, errorMessage } = this.state;

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
                        fontWeight={500}
                        sx={{
                            maxWidth: 280,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {uploadedFile?.name}
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={this.handleBackToUpload}
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
                        <Typography variant="body2" color="error.main">
                            {errorMessage}
                        </Typography>
                    </Box>
                )}

                <Typography variant="body1" fontWeight={600} sx={{ mb: 2 }}>
                    How should prices be applied?
                </Typography>

                {/* Pricing options */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {modes.map((mode) => (
                        <Box
                            key={mode.value}
                            onClick={() => this.handleModeSelect(mode.value)}
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
                                                ? '#4caf50'
                                                : '#9c27b0'
                                        : 'text.secondary',
                                    transition: 'all 0.2s ease',
                                    '& svg': { fontSize: 22 },
                                }}
                            >
                                {mode.icon}
                            </Box>

                            {/* Text */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
                                <Typography variant="body1" fontWeight={500}>
                                    {mode.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
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
                    <Typography variant="body2" color="text.secondary">
                        {this.getModeDescription()}
                    </Typography>
                </Box>
            </Box>
        );
    }

    private renderLoadingState(): React.ReactNode {
        const { loadingMessage } = this.state;

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
                <Typography variant="body1" color="text.secondary" fontWeight={500}>
                    {loadingMessage || 'Processing...'}
                </Typography>
            </Box>
        );
    }

    private renderResultState(): React.ReactNode {
        const { filteredRows, resultRows, searchTerm, totalJobs, totalOldAmount, totalNewAmount } = this.state;
        const amountChange = this.getAmountChange();

        return (
            <Box sx={{ p: 2 }}>
                {/* Success header */}
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
                            bgcolor: 'rgba(76, 175, 80, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 1.5,
                        }}
                    >
                        <CheckCircleIcon sx={{ fontSize: 32, color: 'success.main' }} />
                    </Box>
                    <Typography variant="h6" fontWeight={600}>
                        Prices Updated
                    </Typography>
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
                        <Typography variant="subtitle1" fontWeight={600}>
                            {totalJobs}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Jobs Updated
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            {this.formatCurrency(totalOldAmount)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Previous Total
                        </Typography>
                    </Box>
                    <ArrowForwardIcon sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            {this.formatCurrency(totalNewAmount)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            New Total
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography
                            variant="subtitle1"
                            fontWeight={600}
                            sx={{
                                color: amountChange > 0 ? 'success.main' : amountChange < 0 ? 'error.main' : 'text.secondary',
                            }}
                        >
                            {this.formatChange(amountChange)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
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
                        onChange={this.handleSearchChange}
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
                                        <IconButton size="small" onClick={this.handleClearSearch}>
                                            <CloseIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            },
                        }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
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
                                            bgcolor: row.error ? 'rgba(211, 47, 47, 0.05)' : undefined,
                                        }}
                                    >
                                        <TableCell sx={{ fontWeight: 500 }}>{row.jobNo}</TableCell>
                                        <TableCell>{row.field}</TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{ fontFamily: '"Roboto Mono", monospace' }}
                                        >
                                            {this.formatCurrency(row.oldAmount)}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{ fontFamily: '"Roboto Mono", monospace' }}
                                        >
                                            {this.formatCurrency(row.newAmount)}
                                        </TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{
                                                fontFamily: '"Roboto Mono", monospace',
                                                color: rowChange > 0 ? 'success.main' : rowChange < 0 ? 'error.main' : 'inherit',
                                            }}
                                        >
                                            {this.formatChange(rowChange)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {filteredRows.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                                        <SearchOffIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                                        <Typography variant="body2" color="text.secondary">
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
    }

    render(): React.ReactNode {
        const { open, onClose } = this.props;
        const { currentState, isLoading } = this.state;

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
                            borderRadius: 2,
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
                    <UploadFileIcon sx={{ fontSize: 24 }} />
                    <Typography variant="h6" fontWeight={500} sx={{ flex: 1 }}>
                        Bulk Price Upload
                    </Typography>
                    <IconButton
                        onClick={onClose}
                        disabled={isLoading}
                        sx={{
                            color: 'white',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Content */}
                <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
                    {currentState === 'upload' && this.renderUploadState()}
                    {currentState === 'mode-select' && this.renderModeSelectState()}
                    {currentState === 'loading' && this.renderLoadingState()}
                    {currentState === 'result' && this.renderResultState()}
                </DialogContent>

                {/* Actions */}
                <DialogActions
                    sx={(theme) => ({
                        px: 2,
                        py: 2,
                        bgcolor: 'white',
                        borderTop: `1px solid ${theme.palette.divider}`,
                        gap: 1,
                    })}
                >
                    {currentState === 'upload' && (
                        <Button onClick={this.handleCancel} color="inherit">
                            Cancel
                        </Button>
                    )}

                    {currentState === 'mode-select' && (
                        <>
                            <Button
                                onClick={this.handleBackToUpload}
                                color="inherit"
                                startIcon={<ArrowBackIcon />}
                            >
                                Back
                            </Button>
                            <Button
                                onClick={this.handleApplyPrices}
                                variant="contained"
                                color="primary"
                                startIcon={<CheckIcon />}
                                sx={{ minWidth: 140 }}
                            >
                                {this.getApplyButtonText()}
                            </Button>
                        </>
                    )}

                    {currentState === 'result' && (
                        <Button
                            onClick={this.handleDone}
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
    }
}

export default BulkPriceUploadDialog;
