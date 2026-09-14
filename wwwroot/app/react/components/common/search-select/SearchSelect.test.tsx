/**
 * SearchSelect tests.
 *
 * The component replaces the object-valued MUI `Autocomplete`, so these pin the
 * parts that differ from Mantine's string-only `Autocomplete`: the value is the
 * option object, typing invalidates the previous pick, and the search is
 * debounced and abortable.
 */

import React, {useState} from 'react';
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {SearchSelect} from './SearchSelect';
import {renderWithMantine} from '../../../__testUtils__';

interface Courier {
    id: number;
    text: string;
}

const couriers: Courier[] = [
    {id: 1, text: 'Courier Alpha'},
    {id: 2, text: 'Courier Beta'},
];

const mockSearch = jest.fn();

function Harness({initial = null, onValue}: {initial?: Courier | null; onValue?: (v: Courier | null) => void}) {
    const [value, setValue] = useState<Courier | null>(initial);
    return (
        <>
            <SearchSelect<Courier>
                label="Courier"
                placeholder="Search Courier..."
                value={value}
                onChange={(next) => {
                    setValue(next);
                    onValue?.(next);
                }}
                search={(term, options) => mockSearch(term, options)}
                getOptionKey={(o) => o.id}
                getOptionLabel={(o) => o.text}
            />
            <button onClick={() => setValue(null)}>reset</button>
        </>
    );
}

function typeSearch(term: string) {
    const input = screen.getByLabelText(/courier/i);
    fireEvent.focus(input);
    fireEvent.change(input, {target: {value: term}});
    return input;
}

async function flushDebounce() {
    await act(async () => {
        jest.advanceTimersByTime(350);
    });
}

/** Several fields can search the same list, so scope lookups to this input's own dropdown. */
function dropdownFor(input: HTMLElement): HTMLElement {
    const id = input.getAttribute('aria-controls');
    const dropdown = id ? document.getElementById(id) : null;
    if (!dropdown) throw new Error('dropdown not found');
    return dropdown;
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSearch.mockResolvedValue([]);
});

afterEach(() => {
    jest.useRealTimers();
});

describe('SearchSelect', () => {
    it('searches after the debounce once the term is long enough, and passes an abort signal', async () => {
        mockSearch.mockResolvedValue(couriers);
        renderWithMantine(<Harness />);

        const input = typeSearch('Co');
        expect(mockSearch).not.toHaveBeenCalled();

        await flushDebounce();

        expect(mockSearch).toHaveBeenCalledWith('Co', expect.objectContaining({signal: expect.any(AbortSignal)}));
        const dropdown = dropdownFor(input);
        expect(await within(dropdown).findByText('Courier Alpha')).toBeInTheDocument();
        expect(within(dropdown).getByText('Courier Beta')).toBeInTheDocument();
    });

    /**
     * Mantine only stamps the combobox role and aria-expanded when the target asks
     * for them; without it the field announces as a plain text box and nothing tells
     * a screen reader the list is open.
     */
    it('announces itself as a combobox and reports whether the list is open', async () => {
        renderWithMantine(<Harness />);

        const input = screen.getByRole('combobox', {name: /courier/i});
        expect(input).toHaveAttribute('aria-expanded', 'false');

        fireEvent.focus(input);
        await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
    });

    it('does not search below the minimum term length, and prompts instead', async () => {
        renderWithMantine(<Harness />);

        const input = typeSearch('C');
        await flushDebounce();

        expect(mockSearch).not.toHaveBeenCalled();
        expect(within(dropdownFor(input)).getByText('Type at least 2 characters to search'))
            .toBeInTheDocument();
    });

    it('shows a no-matches message when the search comes back empty', async () => {
        renderWithMantine(<Harness />);

        const input = typeSearch('Zz');
        await flushDebounce();

        expect(await within(dropdownFor(input)).findByText(/no matches for/i)).toBeInTheDocument();
    });

    it('emits the selected option object and shows its label in the input', async () => {
        mockSearch.mockResolvedValue(couriers);
        const onValue = jest.fn();
        renderWithMantine(<Harness onValue={onValue} />);

        const input = typeSearch('Co');
        await flushDebounce();

        fireEvent.click(await within(dropdownFor(input)).findByText('Courier Beta'));

        expect(onValue).toHaveBeenCalledWith(couriers[1]);
        expect(input).toHaveValue('Courier Beta');
    });

    it('invalidates the previous selection as soon as the user types again', async () => {
        mockSearch.mockResolvedValue(couriers);
        const onValue = jest.fn();
        renderWithMantine(<Harness onValue={onValue} />);

        const input = typeSearch('Co');
        await flushDebounce();
        fireEvent.click(await within(dropdownFor(input)).findByText('Courier Alpha'));
        expect(onValue).toHaveBeenLastCalledWith(couriers[0]);

        fireEvent.change(input, {target: {value: 'Courier A'}});

        expect(onValue).toHaveBeenLastCalledWith(null);
    });

    it('renders an initial value and clears the input when the owner resets the value', async () => {
        renderWithMantine(<Harness initial={couriers[0]} />);

        const input = screen.getByLabelText(/courier/i);
        expect(input).toHaveValue('Courier Alpha');

        fireEvent.click(screen.getByRole('button', {name: 'reset'}));

        await waitFor(() => expect(input).toHaveValue(''));
    });

    it('aborts the in-flight search when the term changes again', async () => {
        mockSearch.mockResolvedValue(couriers);
        renderWithMantine(<Harness />);

        const input = typeSearch('Co');
        await flushDebounce();
        const firstSignal = mockSearch.mock.calls[0][1].signal as AbortSignal;

        fireEvent.change(input, {target: {value: 'Cour'}});
        await flushDebounce();

        expect(firstSignal.aborted).toBe(true);
        expect(mockSearch).toHaveBeenCalledTimes(2);
    });

    it('surfaces an error message and the busy state', async () => {
        renderWithMantine(
            <SearchSelect<Courier>
                label="Courier"
                value={null}
                onChange={jest.fn()}
                search={(term, options) => mockSearch(term, options)}
                getOptionKey={(o) => o.id}
                getOptionLabel={(o) => o.text}
                error="This field is required."
                withAsterisk
            />
        );

        expect(screen.getByText('This field is required.')).toBeInTheDocument();

        mockSearch.mockImplementation(() => new Promise(() => {/* never settles */}));
        typeSearch('Co');
        await flushDebounce();

        expect(await screen.findByRole('progressbar', {name: 'Searching'})).toBeInTheDocument();
    });

    it('swallows an aborted search without clearing the options', async () => {
        mockSearch.mockRejectedValue(Object.assign(new Error('aborted'), {name: 'AbortError'}));
        renderWithMantine(<Harness />);

        const input = typeSearch('Co');
        await flushDebounce();

        // No crash, and the field falls back to the no-matches message.
        expect(await within(dropdownFor(input)).findByText(/no matches for/i)).toBeInTheDocument();
    });

    it('takes focus on mount when asked, outside a focus trap as well as inside one', () => {
        // `data-autofocus` alone only works where Mantine traps focus (modals),
        // so an inline field — the job list's courier cell — never got focus.
        renderWithMantine(
            <SearchSelect<Courier>
                aria-label="Courier"
                placeholder="Search Courier..."
                autoFocus
                value={null}
                onChange={jest.fn()}
                search={mockSearch}
                getOptionKey={(o) => o.id}
                getOptionLabel={(o) => o.text}
            />,
        );

        expect(screen.getByLabelText('Courier')).toHaveFocus();
    });

    describe('seedSearch', () => {
        function SeedHarness({seed}: {seed?: string}) {
            const [value, setValue] = useState<Courier | null>(null);
            return (
                <SearchSelect<Courier>
                    label="Courier"
                    placeholder="Search Courier..."
                    value={value}
                    onChange={setValue}
                    seedSearch={seed}
                    search={(term, options) => mockSearch(term, options)}
                    getOptionKey={(o) => o.id}
                    getOptionLabel={(o) => o.text}
                />
            );
        }

        it('fills the input and searches for it', async () => {
            mockSearch.mockResolvedValue(couriers);
            const {rerender} = renderWithMantine(<SeedHarness/>);

            rerender(<SeedHarness seed="Courier Alpha"/>);
            await flushDebounce();

            expect(screen.getByLabelText(/courier/i)).toHaveValue('Courier Alpha');
            expect(mockSearch).toHaveBeenCalledWith('Courier Alpha', expect.anything());
        });

        it('does not fight the operator once they edit the seeded text', async () => {
            renderWithMantine(<SeedHarness seed="Courier Alpha"/>);
            await flushDebounce();

            typeSearch('Beta');
            await flushDebounce();

            expect(screen.getByLabelText(/courier/i)).toHaveValue('Beta');
        });

        it('ignores an empty or unchanged seed', async () => {
            const {rerender} = renderWithMantine(<SeedHarness seed="Courier Alpha"/>);
            await flushDebounce();

            typeSearch('Beta');
            await flushDebounce();

            // Same seed again: a re-render must not stamp over what they typed.
            rerender(<SeedHarness seed="Courier Alpha"/>);
            await flushDebounce();
            expect(screen.getByLabelText(/courier/i)).toHaveValue('Beta');

            rerender(<SeedHarness seed=""/>);
            await flushDebounce();
            expect(screen.getByLabelText(/courier/i)).toHaveValue('Beta');
        });
    });
});
