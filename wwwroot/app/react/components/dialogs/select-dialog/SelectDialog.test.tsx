/**
 * Tests for SelectDialog React component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material';
import { SelectDialog } from './SelectDialog';
import { SelectDialogProps, SelectDialogItem } from './types';

const theme = createTheme();

const sampleItems: SelectDialogItem[] = [
    { id: 1, text: 'Option A' },
    { id: 2, text: 'Option B' },
    { id: 3, text: 'Option C' },
];

function renderWithProviders(props: SelectDialogProps) {
    return render(
        <ThemeProvider theme={theme}>
            <SelectDialog {...props} />
        </ThemeProvider>
    );
}

function createDefaultProps(overrides?: Partial<SelectDialogProps>): SelectDialogProps {
    return {
        open: true,
        title: 'Speed',
        fieldName: 'SpeedID',
        items: sampleItems,
        initialValue: null,
        onClose: jest.fn(),
        onSubmit: jest.fn(),
        showToast: jest.fn(),
        ...overrides,
    };
}

describe('SelectDialog', () => {
    describe('Rendering', () => {
        it('renders nothing when not open', () => {
            const props = createDefaultProps({ open: false });
            const { container } = renderWithProviders(props);
            expect(container.querySelector('.MuiDialog-root')).toBeNull();
        });

        it('renders the dialog when open', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('displays the title with "Edit" prefix', () => {
            const props = createDefaultProps({ title: 'Speed' });
            renderWithProviders(props);
            expect(screen.getByText('Edit Speed')).toBeInTheDocument();
        });

        it('displays Save and Cancel buttons', () => {
            const props = createDefaultProps();
            renderWithProviders(props);
            expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
        });

        it('renders all items in the dropdown', async () => {
            const user = userEvent.setup();
            const props = createDefaultProps();
            renderWithProviders(props);

            // Open the select dropdown
            const selectButton = screen.getByRole('combobox');
            await user.click(selectButton);

            // All options should be visible
            expect(screen.getByText('Option A')).toBeInTheDocument();
            expect(screen.getByText('Option B')).toBeInTheDocument();
            expect(screen.getByText('Option C')).toBeInTheDocument();
        });
    });

    describe('Initial Value', () => {
        it('pre-selects item matching initialValue by id', () => {
            const props = createDefaultProps({ initialValue: 2 });
            renderWithProviders(props);

            // The selected value should show "Option B"
            const select = screen.getByRole('combobox');
            expect(select).toHaveTextContent('Option B');
        });

        it('pre-selects item matching initialValue by text', () => {
            const props = createDefaultProps({ initialValue: 'Option C' });
            renderWithProviders(props);

            const select = screen.getByRole('combobox');
            expect(select).toHaveTextContent('Option C');
        });

        it('has no selection when initialValue is null', () => {
            const props = createDefaultProps({ initialValue: null });
            renderWithProviders(props);

            // The select should show the label/placeholder, not any option text
            const select = screen.getByRole('combobox');
            expect(select).not.toHaveTextContent('Option A');
            expect(select).not.toHaveTextContent('Option B');
            expect(select).not.toHaveTextContent('Option C');
        });
    });

    describe('Warning Message', () => {
        it('shows warning message when provided', () => {
            const props = createDefaultProps({ warningMessage: 'This is a warning' });
            renderWithProviders(props);
            expect(screen.getByText('This is a warning')).toBeInTheDocument();
        });

        it('hides warning message when not provided', () => {
            const props = createDefaultProps({ warningMessage: undefined });
            renderWithProviders(props);
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('Checkbox', () => {
        it('shows checkbox when showCheckbox is true', () => {
            const props = createDefaultProps({ showCheckbox: true, checkboxLabel: 'DG Documentation' });
            renderWithProviders(props);
            expect(screen.getByLabelText('DG Documentation')).toBeInTheDocument();
        });

        it('hides checkbox when showCheckbox is false', () => {
            const props = createDefaultProps({ showCheckbox: false });
            renderWithProviders(props);
            expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
        });

        it('includes checkbox value in result when checked', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({
                showCheckbox: true,
                checkboxLabel: 'DG Documentation',
                initialValue: 1,
                onSubmit,
            });
            renderWithProviders(props);

            // Check the checkbox
            await user.click(screen.getByLabelText('DG Documentation'));

            // Submit
            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledWith(
                    expect.objectContaining({
                        checkboxValue: true,
                    })
                );
            });
        });
    });

    describe('Submit', () => {
        it('returns correct result shape on submit', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const props = createDefaultProps({
                fieldName: 'SpeedID',
                initialValue: 2,
                onSubmit,
            });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', { name: /Save/i }));

            await waitFor(() => {
                expect(onSubmit).toHaveBeenCalledWith({
                    fieldName: 'SpeedID',
                    value: 2,
                    checkboxValue: undefined,
                });
            });
        });

        it('disables Save when nothing is selected', () => {
            const props = createDefaultProps({ initialValue: null });
            renderWithProviders(props);

            const saveButton = screen.getByRole('button', { name: /Save/i });
            expect(saveButton).toBeDisabled();
        });

        it('enables Save when an item is selected', () => {
            const props = createDefaultProps({ initialValue: 1 });
            renderWithProviders(props);

            const saveButton = screen.getByRole('button', { name: /Save/i });
            expect(saveButton).not.toBeDisabled();
        });
    });

    describe('Cancel', () => {
        it('calls onClose when Cancel is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createDefaultProps({ onClose });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', { name: /Cancel/i }));
            expect(onClose).toHaveBeenCalled();
        });

        it('calls onClose when close icon is clicked', async () => {
            const user = userEvent.setup();
            const onClose = jest.fn();
            const props = createDefaultProps({ onClose });
            renderWithProviders(props);

            // The close icon button is in the header
            const closeButtons = screen.getAllByRole('button');
            const closeIconButton = closeButtons.find(
                btn => btn.querySelector('[data-testid="CloseIcon"]')
            );

            if (closeIconButton) {
                await user.click(closeIconButton);
                expect(onClose).toHaveBeenCalled();
            }
        });
    });

    describe('Loading State', () => {
        it('shows loading state during submit', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn(() => new Promise<void>(() => {})); // Never resolves
            const props = createDefaultProps({ initialValue: 1, onSubmit });
            renderWithProviders(props);

            await user.click(screen.getByRole('button', { name: /Save/i }));

            expect(await screen.findByText('Saving...')).toBeInTheDocument();
        });
    });
});
