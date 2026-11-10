import React from 'react';
import {MantineTestProvider} from '../../../../test/utils';
import {fireEvent, render, screen, act} from '@testing-library/react';
import {SearchField} from './SearchField';


const renderSearchField = (props = {}) =>
    render(
        <MantineTestProvider>
            <SearchField value="" onChange={vi.fn()} {...props} />
        </MantineTestProvider>
    );

describe('SearchField', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should render input with placeholder', () => {
        renderSearchField({placeholder: 'Search drivers…'});

        expect(screen.getByPlaceholderText('Search drivers…')).toBeInTheDocument();
    });

    it('should render default placeholder when none provided', () => {
        renderSearchField();

        expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
    });

    it('should update local value on typing', () => {
        renderSearchField();

        const input = screen.getByPlaceholderText('Search…') as HTMLInputElement;
        fireEvent.change(input, {target: {value: 'test'}});

        expect(input.value).toBe('test');
    });

    it('should debounce onChange after 300ms', () => {
        const onChange = vi.fn();
        renderSearchField({onChange});

        const input = screen.getByPlaceholderText('Search…');
        fireEvent.change(input, {target: {value: 'hello'}});

        // Not called immediately
        expect(onChange).not.toHaveBeenCalled();

        // Called after 300ms
        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(onChange).toHaveBeenCalledWith('hello');
    });

    it('should show clear button when value is present', () => {
        renderSearchField({value: 'test'});

        // The clear button should be visible
        const clearButton = screen.getByRole('button');
        expect(clearButton).toBeInTheDocument();
    });

    it('should clear value and call onChange immediately on clear', () => {
        const onChange = vi.fn();
        renderSearchField({value: 'test', onChange});

        const clearButton = screen.getByRole('button');
        fireEvent.click(clearButton);

        expect(onChange).toHaveBeenCalledWith('');
    });
});
