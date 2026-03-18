/**
 * ChipsAutocomplete Component Tests
 */

import React from 'react';
import {screen, act, within} from '@testing-library/react';
import userEvent, {UserEvent} from '@testing-library/user-event';
import {ChipsAutocomplete, ChipsAutocompleteProps} from './ChipsAutocomplete';
import {ISuggestion} from '../../../../interfaces/job.interface';
import {renderWithTheme} from '../../../__testUtils__';

function createChipsProps(overrides?: Partial<ChipsAutocompleteProps>): ChipsAutocompleteProps {
    return {
        label: 'Clients',
        placeholder: 'Search clients...',
        value: [],
        minInputLength: 2,
        onSearch: jest.fn().mockResolvedValue([]),
        onChange: jest.fn(),
        ...overrides,
    };
}

// All mock texts must contain the search string used in tests ('ac')
// because MUI Autocomplete also applies client-side filtering via getOptionLabel
const mockResults: ISuggestion[] = [
    {id: 1, text: 'Acme Corp'},
    {id: 2, text: 'Bacardi Inc'},
    {id: 3, text: 'Pac Ltd'},
];

describe('ChipsAutocomplete', () => {
    let user: UserEvent;

    beforeEach(() => {
        jest.useFakeTimers();
        user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // Helper: get the combobox input element
    const getInput = () => screen.getByRole('combobox');

    describe('Rendering', () => {
        it('renders with placeholder when no value selected', () => {
            renderWithTheme(<ChipsAutocomplete {...createChipsProps()} />);
            expect(getInput()).toHaveAttribute('placeholder', 'Search clients...');
        });

        it('hides placeholder when value has items', () => {
            const props = createChipsProps({
                value: [{id: 1, text: 'Acme Corp'}],
            });
            renderWithTheme(<ChipsAutocomplete {...props} />);
            expect(getInput()).toHaveAttribute('placeholder', '');
        });
    });

    describe('Search Behavior', () => {
        it('does not call onSearch when input shorter than minInputLength', async () => {
            const props = createChipsProps({minInputLength: 2});
            renderWithTheme(<ChipsAutocomplete {...props} />);

            await user.type(getInput(), 'a');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            expect(props.onSearch).not.toHaveBeenCalled();
        });

        it('shows "Type at least N characters" message when input too short', async () => {
            const props = createChipsProps({minInputLength: 2});
            renderWithTheme(<ChipsAutocomplete {...props} />);

            await user.type(getInput(), 'a');

            expect(await screen.findByText('Type at least 2 characters to search')).toBeInTheDocument();
        });

        it('shows singular message for minInputLength of 1', async () => {
            const props = createChipsProps({minInputLength: 1, label: 'Speeds'});
            renderWithTheme(<ChipsAutocomplete {...props} />);

            // Open autocomplete without typing any characters
            await user.click(getInput());

            expect(await screen.findByText('Type at least 1 character to search')).toBeInTheDocument();
        });

        it('calls onSearch after 300ms debounce when input meets minInputLength', async () => {
            const props = createChipsProps({
                minInputLength: 2,
                onSearch: jest.fn().mockResolvedValue(mockResults),
            });
            renderWithTheme(<ChipsAutocomplete {...props} />);

            await user.type(getInput(), 'ac');

            // Not called before debounce fires
            expect(props.onSearch).not.toHaveBeenCalled();

            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            expect(props.onSearch).toHaveBeenCalledWith('ac');
        });

        it('shows loading spinner during search', async () => {
            // Create a search that never resolves during the test
            let resolveSearch!: (value: ISuggestion[]) => void;
            const searchPromise = new Promise<ISuggestion[]>(resolve => {
                resolveSearch = resolve;
            });
            const props = createChipsProps({
                minInputLength: 2,
                onSearch: jest.fn().mockReturnValue(searchPromise),
            });
            renderWithTheme(<ChipsAutocomplete {...props} />);

            await user.type(getInput(), 'ac');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            expect(screen.getByRole('progressbar')).toBeInTheDocument();

            // Resolve to clean up
            await act(async () => {
                resolveSearch(mockResults);
            });
        });

        it('displays search results as options', async () => {
            const props = createChipsProps({
                minInputLength: 2,
                onSearch: jest.fn().mockResolvedValue(mockResults),
            });
            renderWithTheme(<ChipsAutocomplete {...props} />);

            await user.type(getInput(), 'ac');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            const listbox = await screen.findByRole('listbox');
            const options = within(listbox).getAllByRole('option');
            expect(options).toHaveLength(3);
            expect(options[0]).toHaveTextContent('Acme Corp');
            expect(options[1]).toHaveTextContent('Bacardi Inc');
            expect(options[2]).toHaveTextContent('Pac Ltd');
        });

        it('shows "No {label} found" when search returns empty', async () => {
            const props = createChipsProps({
                minInputLength: 2,
                onSearch: jest.fn().mockResolvedValue([]),
            });
            renderWithTheme(<ChipsAutocomplete {...props} />);

            await user.type(getInput(), 'zz');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            expect(await screen.findByText('No clients found')).toBeInTheDocument();
        });

        it('filters out already-selected items from results', async () => {
            const props = createChipsProps({
                minInputLength: 2,
                value: [{id: 1, text: 'Acme Corp'}],
                onSearch: jest.fn().mockResolvedValue(mockResults),
            });
            renderWithTheme(<ChipsAutocomplete {...props} />);

            await user.type(getInput(), 'ac');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            const listbox = await screen.findByRole('listbox');
            const options = within(listbox).getAllByRole('option');
            // Acme Corp (id: 1) should be filtered out since it's already selected
            expect(options).toHaveLength(2);
            expect(options[0]).toHaveTextContent('Bacardi Inc');
            expect(options[1]).toHaveTextContent('Pac Ltd');
        });
    });

    describe('Selection', () => {
        it('calls onChange with new items when option selected', async () => {
            const props = createChipsProps({
                minInputLength: 2,
                onSearch: jest.fn().mockResolvedValue(mockResults),
            });
            renderWithTheme(<ChipsAutocomplete {...props} />);

            await user.type(getInput(), 'ac');
            await act(async () => {
                jest.advanceTimersByTime(300);
            });

            const option = await screen.findByRole('option', {name: 'Acme Corp'});
            await user.click(option);

            expect(props.onChange).toHaveBeenCalledWith([{id: 1, text: 'Acme Corp'}]);
        });

        it('removes chip when delete icon clicked', async () => {
            const selectedItems: ISuggestion[] = [
                {id: 1, text: 'Acme Corp'},
                {id: 2, text: 'Beta Inc'},
            ];
            const props = createChipsProps({value: selectedItems});
            renderWithTheme(<ChipsAutocomplete {...props} />);

            // MUI Chip delete buttons have a data-testid of "CancelIcon"
            const cancelIcons = screen.getAllByTestId('CancelIcon');
            // Click the first chip's delete button
            await user.click(cancelIcons[0]);

            expect(props.onChange).toHaveBeenCalledWith([{id: 2, text: 'Beta Inc'}]);
        });
    });
});
