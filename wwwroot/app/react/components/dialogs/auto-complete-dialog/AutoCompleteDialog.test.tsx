/** @jest-environment jest-environment-jsdom */
/**
 * AutoCompleteDialog Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {AutoCompleteDialog, AutoCompleteDialogProps, Suggestion} from './AutoCompleteDialog';
import {createProps, renderWithTheme} from '../../../__testUtils__';

const mockSuggestions: Suggestion[] = [
    {id: 1, text: 'John Smith'},
    {id: 2, text: 'Jane Doe'},
    {id: 3, text: 'John Brown'},
];

const defaultProps: AutoCompleteDialogProps = {
    open: true,
    title: 'Select Courier',
    placeholder: 'Search for a courier...',
    onClose: jest.fn(),
    onSubmit: jest.fn(),
    onSearch: jest.fn().mockResolvedValue(mockSuggestions),
};

const createMockProps = (overrides?: Partial<AutoCompleteDialogProps>) =>
    createProps(defaultProps, overrides);

describe('AutoCompleteDialog', () => {
    describe('Rendering', () => {
        it('renders dialog with expected elements and initial state', () => {
            const props = createMockProps();
            renderWithTheme(<AutoCompleteDialog {...props} />);

            // renders dialog when open is true
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            // displays title in header
            expect(screen.getByText('Select Courier')).toBeInTheDocument();
            // displays subtitle text
            expect(screen.getByText('Search and select an option')).toBeInTheDocument();
            // displays placeholder in search input
            expect(screen.getByPlaceholderText('Search for a courier...')).toBeInTheDocument();
            // displays Cancel button
            expect(screen.getByRole('button', {name: /cancel/i})).toBeInTheDocument();
            // displays Save button
            expect(screen.getByRole('button', {name: /save/i})).toBeInTheDocument();
            // Save button is disabled when no item is selected
            expect(screen.getByRole('button', {name: /save/i})).toBeDisabled();
        });

        it('does not render dialog when open is false', () => {
            const props = createMockProps({open: false});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Existing Item', () => {
        it('displays existing item in input and enables Save button', () => {
            const existingItem: Suggestion = {id: 1, text: 'John Smith'};
            const props = createMockProps({existingItem});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            // displays existing item value in input
            expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument();
            // enables Save button when existing item is provided
            expect(screen.getByRole('button', {name: /save/i})).not.toBeDisabled();
        });
    });

    describe('Re-rate Option', () => {
        it('shows re-rate checkbox unchecked by default when showRerateOption is true', () => {
            const props = createMockProps({showRerateOption: true});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            // shows re-rate checkbox
            expect(screen.getByLabelText(/re-rate job/i)).toBeInTheDocument();
            // re-rate checkbox is unchecked by default
            expect(screen.getByLabelText(/re-rate job/i)).not.toBeChecked();
        });

        it('does not show re-rate checkbox when showRerateOption is false', () => {
            const props = createMockProps({showRerateOption: false});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            expect(screen.queryByLabelText(/re-rate job/i)).not.toBeInTheDocument();
        });
    });

    describe('Search Functionality', () => {
        it('does not search when input is less than minInputLength', async () => {
            const user = userEvent.setup();
            const onSearch = jest.fn().mockResolvedValue([]);
            const props = createMockProps({onSearch, minInputLength: 3});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            const input = screen.getByPlaceholderText('Search for a courier...');
            await user.click(input);
            await user.paste('ab');

            await waitFor(() => {
                expect(onSearch).not.toHaveBeenCalled();
            }, {timeout: 500});
        });

        it('searches when input reaches minInputLength', async () => {
            const user = userEvent.setup();
            const onSearch = jest.fn().mockResolvedValue(mockSuggestions);
            const props = createMockProps({onSearch, minInputLength: 2});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            const input = screen.getByPlaceholderText('Search for a courier...');
            await user.click(input);
            await user.paste('jo');

            await waitFor(() => {
                expect(onSearch).toHaveBeenCalled();
            });
        });

        it('displays loading indicator during search', async () => {
            const user = userEvent.setup();
            let resolveSearch: (value: Suggestion[]) => void;
            const onSearch = jest.fn().mockImplementation(() =>
                new Promise<Suggestion[]>(resolve => {
                    resolveSearch = resolve;
                })
            );
            const props = createMockProps({onSearch, minInputLength: 1});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            const input = screen.getByPlaceholderText('Search for a courier...');
            await user.click(input);
            await user.paste('john');

            expect(await screen.findByRole('progressbar')).toBeInTheDocument();

            resolveSearch!([]);
        });

        it('displays no options text when search returns empty', async () => {
            const user = userEvent.setup();
            const onSearch = jest.fn().mockResolvedValue([]);
            const props = createMockProps({onSearch, minInputLength: 2});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            const input = screen.getByPlaceholderText('Search for a courier...');
            await user.click(input);
            await user.paste('xyz');

            // Open the listbox
            await user.click(input);

            expect(await screen.findByText(/no select courier matching/i)).toBeInTheDocument();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when close icon or Cancel button is clicked', () => {
            const onClose = jest.fn();
            const props = createMockProps({onClose});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            // calls onClose when close button is clicked
            const closeIcon = screen.getByTestId('CloseIcon');
            const closeButton = closeIcon.closest('button')!;
            fireEvent.click(closeButton);
            expect(onClose).toHaveBeenCalledTimes(1);

            // calls onClose when Cancel button is clicked
            fireEvent.click(screen.getByRole('button', {name: /cancel/i}));
            expect(onClose).toHaveBeenCalledTimes(2);
        });
    });

    describe('Submit Functionality', () => {
        it('calls onSubmit with selected item when Save is clicked', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const existingItem: Suggestion = {id: 1, text: 'John Smith'};
            const props = createMockProps({onSubmit, existingItem});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            await user.click(screen.getByRole('button', {name: /save/i}));

            // Third arg is `selectedType` — undefined when typeOptions isn't
            // supplied (i.e. legacy open() flow, no 3-way picker). Added
            // 2026-05-26 to support the Assign Route / Agent / NP radio.
            expect(onSubmit).toHaveBeenCalledWith(existingItem, false, undefined);
        });

        it('calls onSubmit with shouldRerate true when checkbox is checked', async () => {
            const user = userEvent.setup();
            const onSubmit = jest.fn();
            const existingItem: Suggestion = {id: 1, text: 'John Smith'};
            const props = createMockProps({onSubmit, existingItem, showRerateOption: true});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            await user.click(screen.getByLabelText(/re-rate job/i));
            await user.click(screen.getByRole('button', {name: /save/i}));

            expect(onSubmit).toHaveBeenCalledWith(existingItem, true, undefined);
        });

        it('does not call onSubmit when no item is selected', () => {
            const onSubmit = jest.fn();
            const props = createMockProps({onSubmit});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            // Try to click save (should be disabled)
            const saveButton = screen.getByRole('button', {name: /save/i});
            expect(saveButton).toBeDisabled();
        });
    });

    describe('State Reset', () => {
        it('resets state when dialog is reopened', () => {
            const existingItem: Suggestion = {id: 1, text: 'John Smith'};
            const props = createMockProps({existingItem, showRerateOption: true});
            const {rerender} = renderWithTheme(<AutoCompleteDialog {...props} />);

            // Dialog is open with existing item
            expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument();

            // Close dialog
            rerender(<AutoCompleteDialog {...{...props, open: false}} />);

            // Reopen with different existing item
            const newItem: Suggestion = {id: 2, text: 'Jane Doe'};
            rerender(<AutoCompleteDialog {...{...props, open: true, existingItem: newItem}} />);

            expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
        });
    });

    describe('Min Input Length Message', () => {
        it('displays minimum characters message for single character', async () => {
            const user = userEvent.setup();
            const props = createMockProps({minInputLength: 1});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            // Click the input to open dropdown
            const input = screen.getByPlaceholderText('Search for a courier...');
            await user.click(input);

            expect(screen.getByText(/type at least 1 character to search/i)).toBeInTheDocument();
        });

        it('displays minimum characters message for multiple characters', async () => {
            const user = userEvent.setup();
            const props = createMockProps({minInputLength: 3});
            renderWithTheme(<AutoCompleteDialog {...props} />);

            const input = screen.getByPlaceholderText('Search for a courier...');
            await user.click(input);

            expect(screen.getByText(/type at least 3 characters to search/i)).toBeInTheDocument();
        });
    });
});
