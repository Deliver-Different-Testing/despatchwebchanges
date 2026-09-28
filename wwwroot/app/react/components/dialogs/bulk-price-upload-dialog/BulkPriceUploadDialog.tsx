/**
 * React Bulk Price Upload Dialog
 *
 * A multi-step wizard dialog for bulk uploading price changes.
 * States: upload -> mode-select -> loading -> result
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {alpha, Box, CloseButton, Group, Loader, Paper, Radio, Stack, Table, Text, TextInput, ThemeIcon, UnstyledButton} from '@mantine/core';
import {
    ArrowRight,
    Check,
    CirclePlus,
    CircleAlert,
    CircleCheck,
    CloudUpload,
    FileText,
    FileUp,
    Info,
    NotebookPen,
    Pencil,
    RefreshCw,
    Search,
    SearchX,
    TriangleAlert,
} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {pricingModeColors} from '../../../theme/designTokens';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    dialogSize,
} from '../shared/mantine';
import styles from './BulkPriceUploadDialog.module.css';
import {formatCurrency} from '../../../utils/currencyUtils';
import {
    BulkPriceUploadDialogProps,
    BulkPricePreviewRow,
    BulkPricePreviewResponse,
    PricingMode,
    DialogState,
} from './types';

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
    const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>): void => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>): void => {
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

    const handleDrop = useCallback((event: React.DragEvent<HTMLElement>): void => {
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
                return 'Prices will be recalculated from job details and current rates';
            case 'base':
                return 'File amounts are treated as base prices; PPD & fuel are added on top';
            case 'gross':
                return 'File amounts are applied directly as the final prices';
            default:
                return '';
        }
    }, [selectedMode]);

    const applyButtonText = useMemo((): string => {
        switch (selectedMode) {
            case 'recalculate':
                return 'Recalculate & Save';
            case 'base':
                return 'Apply Base Amounts';
            case 'gross':
                return 'Apply Final Amounts';
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
    /* The same banner appeared verbatim in the upload and mode-select steps. */
    const renderError = (): React.ReactNode => (
        <Group
            gap={8}
            p={12}
            mb={16}
            wrap="nowrap"
            c="var(--mantine-color-red-8)"
            style={{
                borderRadius: 'var(--mantine-radius-md)',
                background: 'var(--mantine-color-red-0)',
            }}
        >
            <Icon lucide={CircleAlert} size={20}/>
            <Text fz="sm">{errorMessage}</Text>
        </Group>
    );

    const renderUploadState = (): React.ReactNode => {
        return (
            <Box p={24}>
                {/* Dropzone */}
                <Box mb={20}>
                    {/*
                      * A real button, not a div with onClick: this is the only way
                      * into the dialog and it was unreachable by keyboard.
                      */}
                    <UnstyledButton
                        className={styles.dropzone}
                        data-drag-over={isDragOver || undefined}
                        onClick={handleFileInputClick}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        w="100%"
                        p={40}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Box c="dimmed" mb={12}>
                            <Icon lucide={CloudUpload} size={48}/>
                        </Box>
                        <Text fz="md" fw={500} mb={4}>Drop your file here</Text>
                        <Text fz="sm" c="dimmed" mb={8}>or click to browse</Text>
                        <Text fz="xs" c="dimmed">Supports .xls, .xlsx, .csv files</Text>
                    </UnstyledButton>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xls,.xlsx,.csv"
                        style={{ display: 'none' }}
                        onChange={handleFileInputChange}
                    />
                </Box>

                {errorMessage && renderError()}

                {/* File format info */}
                <Paper radius="md" p={16} bg="var(--mantine-color-gray-0)">
                    <Text fz="sm" fw={600} mb={8}>Expected File Format</Text>
                    <Text fz="sm" c="dimmed" mb={8}>
                        Your spreadsheet should contain a column named <strong>Id</strong> with job IDs, and optionally:
                    </Text>
                    <Box component="ul" m={0} pl={20}>
                        {[
                            { label: 'Amount', desc: 'Base mode: pre-surcharge base price · Gross mode: final total' },
                            { label: 'Fuel', desc: 'Gross mode only (calculated automatically in Base mode)' },
                            { label: 'Ppd', desc: 'Gross mode only' },
                            { label: 'CourierPayment', desc: 'Courier payment (Base & Gross modes)' },
                            { label: 'CourierFuel', desc: 'Courier fuel (Base & Gross modes)' },
                            { label: 'CourierBonus', desc: 'Courier bonus (Base & Gross modes)' },
                        ].map((item) => (
                            <Box component="li" key={item.label} mb={4}>
                                <Text fz="xs" c="dimmed" component="span">
                                    <Text fz="xs" fw={700} component="span" c="var(--mantine-color-text)">
                                        {item.label}
                                    </Text> — {item.desc}
                                </Text>
                            </Box>
                        ))}
                    </Box>
                    <Text fz="xs" c="dimmed" mt={8}>
                        Recalculate mode re-prices each job from its details and ignores the price columns above.
                    </Text>
                </Paper>
            </Box>
        );
    };

    const renderModeSelectState = (): React.ReactNode => {
        const modes: { value: PricingMode; title: string; desc: string; icon: React.ReactNode }[] = [
            {
                value: 'recalculate',
                title: 'Auto-Calculate Prices',
                desc: 'Recalculate from job details & current rates',
                icon: <Icon lucide={RefreshCw} size={22}/>,
            },
            {
                value: 'base',
                title: 'Base Price (add surcharges)',
                desc: 'Use file amounts as base; PPD & fuel added on top',
                icon: <Icon lucide={CirclePlus} size={22}/>,
            },
            {
                value: 'gross',
                title: 'Final Price (use as-is)',
                desc: 'Apply file amounts directly as the final price',
                icon: <Icon lucide={NotebookPen} size={22}/>,
            },
        ];

        return (
            <Box p={24}>
                {/* File badge */}
                <Group
                    gap={8}
                    display="inline-flex"
                    py={8}
                    pl={14}
                    pr={8}
                    mb={20}
                    style={{
                        borderRadius: 'var(--mantine-radius-sm)',
                        background: 'var(--mantine-color-gray-1)',
                    }}
                >
                    <Icon lucide={FileText} size={20}/>
                    <Text fz="sm" fw={500} maw={280} truncate>{uploadedFile?.name}</Text>
                    <CloseButton
                        size="sm"
                        aria-label="Choose a different file"
                        icon={<Icon lucide={Pencil} size={16}/>}
                        onClick={handleBackToUpload}
                    />
                </Group>

                {errorMessage && renderError()}

                <Text fz="md" fw={600} mb={16}>How should prices be applied?</Text>

                {/*
                  * Radio.Card, not three divs with a hand-drawn dot: the options
                  * were unreachable by keyboard and announced as nothing. This is
                  * one tab stop with arrow-key movement, and the selected border
                  * and fill come with it.
                  */}
                <Radio.Group
                    value={selectedMode}
                    onChange={(value) => handleModeSelect(value as PricingMode)}
                    aria-label="How should prices be applied?"
                >
                    <Stack gap={10}>
                        {modes.map((mode) => {
                            const modeColor = pricingModeColors[mode.value];
                            return (
                            <Radio.Card
                                key={mode.value}
                                value={mode.value}
                                radius="md"
                                p={14}
                                data-pricing-mode={mode.value}
                                style={{
                                    '--radio-color': modeColor,
                                    borderWidth: 2,
                                    backgroundColor: selectedMode === mode.value
                                        ? alpha(modeColor, 0.06)
                                        : undefined,
                                } as React.CSSProperties}
                            >
                                <Group gap={14} wrap="nowrap">
                                    <Radio.Indicator/>
                                    <ThemeIcon
                                        size={40}
                                        radius="md"
                                        style={{
                                            '--ti-bg': alpha(modeColor, selectedMode === mode.value ? 0.16 : 0.08),
                                            '--ti-color': modeColor,
                                        } as React.CSSProperties}
                                    >
                                        {mode.icon}
                                    </ThemeIcon>
                                    <Box style={{minWidth: 0}}>
                                        <Text fz="md" fw={500}>{mode.title}</Text>
                                        <Text fz="xs" c="dimmed">{mode.desc}</Text>
                                    </Box>
                                </Group>
                            </Radio.Card>
                            );
                        })}
                    </Stack>
                </Radio.Group>

                {/* Mode hint */}
                <Group
                    gap={8}
                    mt={16}
                    p={12}
                    wrap="nowrap"
                    style={{
                        borderRadius: 'var(--mantine-radius-md)',
                        background: 'var(--mantine-primary-color-light)',
                    }}
                >
                    <Icon lucide={Info} size={18}/>
                    <Text fz="sm">{modeDescription}</Text>
                </Group>
            </Box>
        );
    };

    const renderLoadingState = (): React.ReactNode => {
        return (
            <Stack align="center" justify="center" py={60} px={24} gap={16}>
                <Loader size={48} aria-label={loadingMessage || 'Processing'}/>
                <Text fz="md" fw={500} c="dimmed">{loadingMessage || 'Processing...'}</Text>
            </Stack>
        );
    };

    const renderResultState = (): React.ReactNode => {
        const noneUpdated = totalJobs === 0 && skippedJobs > 0;
        const partial = totalJobs > 0 && skippedJobs > 0;
        const headerColor = noneUpdated ? 'red' : partial ? 'yellow' : 'green';
        const headerTitle = noneUpdated ? 'No Prices Updated' : partial ? 'Partially Updated' : 'Prices Updated';
        const headerGlyph = noneUpdated ? CircleAlert : partial ? TriangleAlert : CircleCheck;

        /** One figure of the summary strip. */
        const Stat = ({value, label, color}: {value: string | number; label: string; color?: string}) => (
            <Box ta="center" style={{flex: 1}}>
                <Text fz="md" fw={600} c={color}>{value}</Text>
                <Text fz="xs" c="dimmed">{label}</Text>
            </Box>
        );

        return (
            <Box p={16}>
                {/* Result header */}
                <Stack align="center" py={24} gap={0}>
                    <ThemeIcon variant="light" color={headerColor} size={56} radius="xl" mb={12}>
                        <Icon lucide={headerGlyph} size={32}/>
                    </ThemeIcon>
                    <Text fz="lg" fw={600}>{headerTitle}</Text>
                    {skippedJobs > 0 && (
                        <Text fz="sm" c="dimmed" mt={4}>
                            {skippedJobs} {skippedJobs === 1 ? 'job' : 'jobs'} could not be updated — see the highlighted rows below.
                        </Text>
                    )}
                </Stack>

                {/* Summary stats */}
                <Group
                    justify="space-between"
                    gap={12}
                    p={16}
                    mb={16}
                    wrap="nowrap"
                    style={{
                        borderRadius: 'var(--mantine-radius-lg)',
                        background: 'var(--mantine-color-gray-0)',
                    }}
                >
                    <Stat value={totalJobs} label="Jobs Updated"/>
                    {skippedJobs > 0 && <Stat value={skippedJobs} label="Skipped" color="yellow.7"/>}
                    <Stat value={formatCurrency(totalOldAmount)} label="Previous Total"/>
                    <Box c="dimmed" style={{flexShrink: 0}}>
                        <Icon lucide={ArrowRight} size={20}/>
                    </Box>
                    <Stat value={formatCurrency(totalNewAmount)} label="New Total"/>
                    <Stat
                        value={formatChange(amountChange)}
                        label="Change"
                        color={amountChange > 0 ? 'green.7' : amountChange < 0 ? 'red.7' : 'dimmed'}
                    />
                </Group>

                {/* Search */}
                <Group gap={12} mb={12} wrap="nowrap">
                    <TextInput
                        size="sm"
                        style={{flex: 1}}
                        placeholder="Search by job number..."
                        aria-label="Search by job number"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        leftSection={<Icon lucide={Search} size={20}/>}
                        rightSection={searchTerm
                            ? <CloseButton size="sm" aria-label="Clear search" onClick={handleClearSearch}/>
                            : null}
                    />
                    <Text fz="xs" c="dimmed" style={{whiteSpace: 'nowrap'}}>
                        {filteredRows.length} of {resultRows.length} jobs
                    </Text>
                </Group>

                {/* Results table */}
                <Table.ScrollContainer minWidth={0} mah={300} type="native">
                    <Table stickyHeader highlightOnHover verticalSpacing={6}>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th tt="uppercase" fz="xs">Job #</Table.Th>
                                <Table.Th tt="uppercase" fz="xs">Field</Table.Th>
                                <Table.Th tt="uppercase" fz="xs" ta="right">Previous</Table.Th>
                                <Table.Th tt="uppercase" fz="xs" ta="right">New Amount</Table.Th>
                                <Table.Th tt="uppercase" fz="xs" ta="right">Change</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {filteredRows.map((row) => {
                                const rowChange = row.newAmount - row.oldAmount;
                                return (
                                    <Table.Tr
                                        key={`${row.jobId}_${row.field}`}
                                        bg={row.skipped ? 'var(--mantine-color-yellow-0)' : undefined}
                                    >
                                        <Table.Td fw={500}>
                                            <Group gap={4} wrap="nowrap">
                                                {row.skipped && (
                                                    <Box c="yellow.7" style={{display: 'flex'}}>
                                                        <Icon lucide={TriangleAlert} size={16}/>
                                                    </Box>
                                                )}
                                                {row.jobNo}
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            {row.skipped
                                                ? <Text fz="xs" c="yellow.8">{row.error || 'Skipped'}</Text>
                                                : row.field}
                                        </Table.Td>
                                        {/* Tabular figures so the columns line up down the page. */}
                                        <Table.Td ta="right" style={{fontVariantNumeric: 'tabular-nums'}}>
                                            {formatCurrency(row.oldAmount)}
                                        </Table.Td>
                                        <Table.Td ta="right" style={{fontVariantNumeric: 'tabular-nums'}}>
                                            {row.skipped ? '—' : formatCurrency(row.newAmount)}
                                        </Table.Td>
                                        <Table.Td
                                            ta="right"
                                            style={{fontVariantNumeric: 'tabular-nums'}}
                                            c={row.skipped
                                                ? 'yellow.7'
                                                : rowChange > 0 ? 'green.7' : rowChange < 0 ? 'red.7' : undefined}
                                        >
                                            {row.skipped ? 'Skipped' : formatChange(rowChange)}
                                        </Table.Td>
                                    </Table.Tr>
                                );
                            })}
                            {filteredRows.length === 0 && (
                                <Table.Tr>
                                    <Table.Td colSpan={5} ta="center" py={40}>
                                        <Box c="dimmed" mb={8} style={{display: 'flex', justifyContent: 'center'}}>
                                            <Icon lucide={SearchX} size={40}/>
                                        </Box>
                                        <Text fz="sm" c="dimmed">No jobs match your search</Text>
                                    </Table.Td>
                                </Table.Tr>
                            )}
                        </Table.Tbody>
                    </Table>
                </Table.ScrollContainer>
            </Box>
        );
    };

    return (
        <DialogShell
            opened={open}
            onClose={isLoading ? () => undefined : onClose}
            size={dialogSize.sm}
            label="Bulk Price Upload"
        >
            <DialogHeader
                icon={<Icon lucide={FileUp}/>}
                title="Bulk Price Upload"
                subtitle="Upload prices from a spreadsheet"
                onClose={onClose}
                closeDisabled={isLoading}
            />

            {/* Content */}
            <Box bg={dialogContentBg}>
                {currentState === 'upload' && renderUploadState()}
                {currentState === 'mode-select' && renderModeSelectState()}
                {currentState === 'loading' && renderLoadingState()}
                {currentState === 'result' && renderResultState()}
            </Box>

            {/*
              * One footer, four shapes. The wizard's steps differ only in which
              * of the two buttons they show and what they are called, so the
              * shared footer carries all of them rather than three DialogActions
              * blocks that had drifted to three different button styles.
              */}
            {currentState === 'upload' && (
                <DialogFooter onCancel={handleCancel} cancelLabel="Cancel" hideConfirm/>
            )}
            {currentState === 'mode-select' && (
                <DialogFooter
                    onCancel={handleBackToUpload}
                    cancelLabel="Back"
                    onConfirm={handleApplyPrices}
                    confirmLabel={applyButtonText}
                    confirmIcon={<Icon lucide={Check}/>}
                />
            )}
            {currentState === 'result' && (
                <DialogFooter
                    onConfirm={handleDone}
                    confirmLabel="Done"
                    confirmIcon={<Icon lucide={Check}/>}
                    hideCancel
                />
            )}
        </DialogShell>
    );
};

export default BulkPriceUploadDialog;
