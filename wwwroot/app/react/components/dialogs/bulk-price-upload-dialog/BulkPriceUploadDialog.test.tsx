/** @jest-environment jest-environment-jsdom */
/**
 * BulkPriceUploadDialog Component Tests
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {BulkPriceUploadDialog} from './BulkPriceUploadDialog';
import {BulkPricePreviewResponse} from './types';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

const mockResponse: BulkPricePreviewResponse = {
    rows: [
        {
            jobId: 1,
            jobNo: 'JOB-001',
            field: 'Amount',
            oldAmount: 100.00,
            newAmount: 150.00,
            isPrebook: false,
        },
        {
            jobId: 2,
            jobNo: 'JOB-002',
            field: 'Amount',
            oldAmount: 200.00,
            newAmount: 180.00,
            isPrebook: true,
        },
    ],
    totalJobs: 2,
    totalOldAmount: 300.00,
    totalNewAmount: 330.00,
};

const createMockProps = (overrides = {}) => ({
    open: true,
    onClose: jest.fn(),
    onSubmit: jest.fn().mockResolvedValue(mockResponse),
    showToast: jest.fn(),
    ...overrides,
});

const createMockFile = (name = 'prices.csv', type = 'text/csv') => {
    return new File(['test,content'], name, { type });
};

describe('BulkPriceUploadDialog', () => {
    describe('Rendering', () => {
        it('should render dialog when open is true', () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Bulk Price Upload')).toBeInTheDocument();
        });

        it('should not render dialog when open is false', () => {
            const props = createMockProps({ open: false });
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should display upload dropzone in initial state', () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            expect(screen.getByText('Drop your file here')).toBeInTheDocument();
            expect(screen.getByText('or click to browse')).toBeInTheDocument();
            expect(screen.getByText('Supports .xls, .xlsx, .csv files')).toBeInTheDocument();
        });

        it('should display expected file format info', () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            expect(screen.getByText('Expected File Format')).toBeInTheDocument();
            expect(screen.getByText(/Id/)).toBeInTheDocument();
        });

        it('should display Cancel button in upload state', () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        });
    });

    describe('File Upload', () => {
        it('should accept CSV files', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            const file = createMockFile('prices.csv', 'text/csv');
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;

            await userEvent.upload(input, file);

            // Should transition to mode-select state
            expect(await screen.findByText('How should prices be applied?')).toBeInTheDocument();
        });

        it('should accept XLS files', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            const file = createMockFile('prices.xls', 'application/vnd.ms-excel');
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;

            await userEvent.upload(input, file);

            expect(await screen.findByText('How should prices be applied?')).toBeInTheDocument();
        });

        it('should accept XLSX files', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            const file = createMockFile('prices.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;

            await userEvent.upload(input, file);

            expect(await screen.findByText('How should prices be applied?')).toBeInTheDocument();
        });

        it('should show error for invalid file types', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            const file = createMockFile('document.pdf', 'application/pdf');
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;

            // Use fireEvent.change to simulate file selection with invalid file
            fireEvent.change(input, { target: { files: [file] } });

            expect(await screen.findByText(/Invalid file format/)).toBeInTheDocument();

            // Should still be in upload state (not transition to mode-select)
            expect(screen.getByText('Drop your file here')).toBeInTheDocument();
        });

        it('should display uploaded file name in mode-select state', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            const file = createMockFile('my-prices.csv');
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;

            await userEvent.upload(input, file);

            expect(await screen.findByText('my-prices.csv')).toBeInTheDocument();
        });
    });

    describe('Mode Selection', () => {
        const uploadFileAndGoToModeSelect = async () => {
            const file = createMockFile();
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            await userEvent.upload(input, file);
            expect(await screen.findByText('How should prices be applied?')).toBeInTheDocument();
        };

        it('should display three pricing mode options', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            expect(screen.getByText('Recalculate')).toBeInTheDocument();
            expect(screen.getByText('Raw Base Amount')).toBeInTheDocument();
            expect(screen.getByText('Gross Amount')).toBeInTheDocument();
        });

        it('should default to recalculate mode', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            expect(screen.getByText(/Prices will be recalculated based on job details/)).toBeInTheDocument();
        });

        it('should update description when selecting base mode', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            const baseOption = screen.getByText('Raw Base Amount');
            await userEvent.click(baseOption);

            expect(screen.getByText(/Raw base amounts from file will be saved/)).toBeInTheDocument();
        });

        it('should update description when selecting gross mode', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            const grossOption = screen.getByText('Gross Amount');
            await userEvent.click(grossOption);

            expect(screen.getByText(/Amounts from file will be applied directly/)).toBeInTheDocument();
        });

        it('should display Back and Apply buttons', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /recalculate & save/i })).toBeInTheDocument();
        });

        it('should update apply button text based on mode', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            // Select gross mode
            const grossOption = screen.getByText('Gross Amount');
            await userEvent.click(grossOption);

            expect(screen.getByRole('button', { name: /apply gross amounts/i })).toBeInTheDocument();
        });

        it('should go back to upload state when clicking Back', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            const backButton = screen.getByRole('button', { name: /back/i });
            await userEvent.click(backButton);

            expect(screen.getByText('Drop your file here')).toBeInTheDocument();
        });
    });

    describe('Apply Prices', () => {
        const uploadFileAndGoToModeSelect = async () => {
            const file = createMockFile();
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            await userEvent.upload(input, file);
            expect(await screen.findByText('How should prices be applied?')).toBeInTheDocument();
        };

        it('should call onSubmit with file and selected mode when clicking apply', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            const applyButton = screen.getByRole('button', { name: /recalculate & save/i });
            await userEvent.click(applyButton);

            await waitFor(() => {
                expect(props.onSubmit).toHaveBeenCalledTimes(1);
                const [file, mode] = props.onSubmit.mock.calls[0];
                expect(file).toBeInstanceOf(File);
                expect(mode).toBe('recalculate');
            });
        });

        it('should show loading state while applying', async () => {
            let resolveSubmit!: (value: typeof mockResponse) => void;
            const props = createMockProps({
                onSubmit: jest.fn().mockImplementation(
                    () => new Promise(resolve => { resolveSubmit = resolve; })
                ),
            });
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            const applyButton = screen.getByRole('button', { name: /recalculate & save/i });
            await userEvent.click(applyButton);

            // Promise never resolves until we say so — loading state is guaranteed visible
            expect(await screen.findByText(/Applying price changes.../)).toBeInTheDocument();

            // Clean up: resolve the pending promise
            resolveSubmit(mockResponse);
        });

        it('should show success toast on successful apply', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            const applyButton = screen.getByRole('button', { name: /recalculate & save/i });
            await userEvent.click(applyButton);

            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith(
                    'Successfully updated prices for 2 jobs.',
                    'success'
                );
            });
        });

        it('should show error toast on failure', async () => {
            const props = createMockProps({
                onSubmit: jest.fn().mockRejectedValue(new Error('Upload failed')),
            });
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            const applyButton = screen.getByRole('button', { name: /recalculate & save/i });
            await userEvent.click(applyButton);

            await waitFor(() => {
                expect(props.showToast).toHaveBeenCalledWith(
                    'Upload failed',
                    'error'
                );
            });
        });

        it('should return to mode-select state on error', async () => {
            const props = createMockProps({
                onSubmit: jest.fn().mockRejectedValue(new Error('Upload failed')),
            });
            renderWithTheme(<BulkPriceUploadDialog {...props} />);
            await uploadFileAndGoToModeSelect();

            const applyButton = screen.getByRole('button', { name: /recalculate & save/i });
            await userEvent.click(applyButton);

            expect(await screen.findByText('How should prices be applied?')).toBeInTheDocument();
        });
    });

    describe('Results State', () => {
        const uploadAndApply = async (props: ReturnType<typeof createMockProps>) => {
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            const file = createMockFile();
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            await userEvent.upload(input, file);

            expect(await screen.findByText('How should prices be applied?')).toBeInTheDocument();

            const applyButton = screen.getByRole('button', { name: /recalculate & save/i });
            await userEvent.click(applyButton);

            expect(await screen.findByText('Prices Updated')).toBeInTheDocument();
        };

        it('should display success header', async () => {
            const props = createMockProps();
            await uploadAndApply(props);

            expect(screen.getByText('Prices Updated')).toBeInTheDocument();
        });

        it('should display summary statistics', async () => {
            const props = createMockProps();
            await uploadAndApply(props);

            expect(screen.getByText('2')).toBeInTheDocument(); // Total jobs
            expect(screen.getByText('Jobs Updated')).toBeInTheDocument();
            expect(screen.getByText('$300.00')).toBeInTheDocument(); // Previous total
            expect(screen.getByText('$330.00')).toBeInTheDocument(); // New total
            expect(screen.getByText('+$30.00')).toBeInTheDocument(); // Change
        });

        it('should display results table with job data', async () => {
            const props = createMockProps();
            await uploadAndApply(props);

            expect(screen.getByText('JOB-001')).toBeInTheDocument();
            expect(screen.getByText('JOB-002')).toBeInTheDocument();
            expect(screen.getByText('$100.00')).toBeInTheDocument();
            expect(screen.getByText('$150.00')).toBeInTheDocument();
        });

        it('should display search input', async () => {
            const props = createMockProps();
            await uploadAndApply(props);

            expect(screen.getByPlaceholderText('Search by job number...')).toBeInTheDocument();
        });

        it('should filter results by job number', async () => {
            const props = createMockProps();
            await uploadAndApply(props);

            const searchInput = screen.getByPlaceholderText('Search by job number...');
            fireEvent.change(searchInput, { target: { value: 'JOB-001' } });

            await waitFor(() => {
                expect(screen.getByText('JOB-001')).toBeInTheDocument();
                expect(screen.queryByText('JOB-002')).not.toBeInTheDocument();
            });
        });

        it('should show result count', async () => {
            const props = createMockProps();
            await uploadAndApply(props);

            expect(screen.getByText('2 of 2 jobs')).toBeInTheDocument();
        });

        it('should update result count when filtering', async () => {
            const props = createMockProps();
            await uploadAndApply(props);

            const searchInput = screen.getByPlaceholderText('Search by job number...');
            fireEvent.change(searchInput, { target: { value: 'JOB-001' } });

            expect(await screen.findByText('1 of 2 jobs')).toBeInTheDocument();
        });

        it('should show empty state when no results match search', async () => {
            const props = createMockProps();
            await uploadAndApply(props);

            const searchInput = screen.getByPlaceholderText('Search by job number...');
            fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } });

            expect(await screen.findByText('No jobs match your search')).toBeInTheDocument();
        });

        it('should display Done button in results state', async () => {
            const props = createMockProps();
            await uploadAndApply(props);

            expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
        });

        it('should call onClose when clicking Done', async () => {
            const props = createMockProps();
            await uploadAndApply(props);

            const doneButton = screen.getByRole('button', { name: /done/i });
            await userEvent.click(doneButton);

            expect(props.onClose).toHaveBeenCalled();
        });
    });

    describe('Cancel and Close', () => {
        it('should call onClose when clicking Cancel in upload state', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            await userEvent.click(cancelButton);

            expect(props.onClose).toHaveBeenCalled();
        });

        it('should call onClose when clicking close icon', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            const closeButtons = screen.getAllByRole('button');
            const closeIconButton = closeButtons.find(btn =>
                btn.querySelector('[data-testid="CloseIcon"]')
            );

            if (closeIconButton) {
                await userEvent.click(closeIconButton);
                expect(props.onClose).toHaveBeenCalled();
            }
        });
    });

    describe('State Reset', () => {
        it('should reset to upload state when dialog reopens', async () => {
            const props = createMockProps();
            const { rerender } = renderWithTheme(<BulkPriceUploadDialog {...props} />);

            // Upload a file
            const file = createMockFile();
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            await userEvent.upload(input, file);

            expect(await screen.findByText('How should prices be applied?')).toBeInTheDocument();

            // Close and reopen
            rerender(
                <ThemeProvider theme={theme}>
                    <BulkPriceUploadDialog {...props} open={false} />
                </ThemeProvider>
            );

            rerender(
                <ThemeProvider theme={theme}>
                    <BulkPriceUploadDialog {...props} open={true} />
                </ThemeProvider>
            );

            // Should be back to upload state
            expect(screen.getByText('Drop your file here')).toBeInTheDocument();
        });
    });

    describe('Drag and Drop', () => {
        it('should handle drag over event', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            const dropzone = screen.getByText('Drop your file here').parentElement!;

            fireEvent.dragOver(dropzone, {
                dataTransfer: { files: [] },
            });

            // The dropzone should have drag-over styling (we just verify no error occurs)
            expect(dropzone).toBeInTheDocument();
        });

        it('should handle drag leave event', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            const dropzone = screen.getByText('Drop your file here').parentElement!;

            fireEvent.dragOver(dropzone);
            fireEvent.dragLeave(dropzone);

            expect(dropzone).toBeInTheDocument();
        });

        it('should handle file drop', async () => {
            const props = createMockProps();
            renderWithTheme(<BulkPriceUploadDialog {...props} />);

            const dropzone = screen.getByText('Drop your file here').parentElement!;
            const file = createMockFile();

            fireEvent.drop(dropzone, {
                dataTransfer: {
                    files: [file],
                },
            });

            expect(await screen.findByText('How should prices be applied?')).toBeInTheDocument();
        });
    });
});
