/**
 * SearchSelect — the object-valued async picker.
 *
 * Mantine's `Autocomplete` is a free-text **string** input with no object value,
 * so it cannot stand in for the object-valued MUI `Autocomplete` used across the
 * dispatch, job and address forms. This rebuilds that behaviour on the
 * `Combobox` primitive: the input holds the display text while the owner keeps
 * the selected object, and the option list is fetched with a debounced,
 * abortable search.
 *
 * Typing always invalidates the previous pick (`onChange(null)`), so a caller
 * can treat a non-null value as "the user chose this from the list".
 *
 * Mantine's `Loader` carries no implicit role, so the busy indicator is given an
 * explicit `progressbar` role and label — without them the searching state is
 * invisible to assistive tech and unqueryable in tests.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Combobox, Group, Loader, Text, TextInput, useCombobox} from '@mantine/core';
import {SearchX} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {SearchSelectProps} from "./SearchSelectProps";

const DEFAULT_MIN_SEARCH_LENGTH = 2;
const DEFAULT_DEBOUNCE_MS = 300;

export function SearchSelect<T>({
    label,
    'aria-label': ariaLabel,
    placeholder,
    value,
    onChange,
    search,
    options: controlledOptions,
    onSearchChange,
    loading: controlledLoading,
    getOptionKey,
    getOptionLabel,
    renderOption,
    error,
    withAsterisk,
    disabled,
    autoFocus,
    minSearchLength = DEFAULT_MIN_SEARCH_LENGTH,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    autoHighlight,
}: SearchSelectProps<T>) {
    const combobox = useCombobox({onDropdownClose: () => combobox.resetSelectedOption()});

    const [inputValue, setInputValue] = useState(() => (value ? getOptionLabel(value) : ''));
    const [fetchedOptions, setFetchedOptions] = useState<T[]>([]);
    const [fetching, setFetching] = useState(false);

    const options = controlledOptions ?? fetchedOptions;
    const loading = controlledLoading ?? fetching;

    // The value this field last emitted, so an echo of our own change does not
    // fight the text the user is typing.
    const emittedRef = useRef<T | null>(value);
    const abortRef = useRef<AbortController | null>(null);

    // Callers routinely pass inline arrows; holding them in refs keeps the search
    // effect keyed on the term alone rather than re-firing on every parent render.
    const searchRef = useRef(search);
    searchRef.current = search;
    const searchChangeRef = useRef(onSearchChange);
    searchChangeRef.current = onSearchChange;
    const labelRef = useRef(getOptionLabel);
    labelRef.current = getOptionLabel;

    useEffect(() => {
        if (value === emittedRef.current) return;
        emittedRef.current = value;
        setInputValue(value ? labelRef.current(value) : '');
    }, [value]);

    useEffect(() => {
        if (inputValue.length < minSearchLength) {
            setFetchedOptions([]);
            setFetching(false);
            searchChangeRef.current?.('');
            return;
        }

        const timer = setTimeout(async () => {
            searchChangeRef.current?.(inputValue);
            if (!searchRef.current) return;

            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setFetching(true);
            try {
                const results = await searchRef.current(inputValue, {signal: controller.signal});
                if (!controller.signal.aborted) {
                    setFetchedOptions(results);
                    setFetching(false);
                }
            } catch (err) {
                if ((err as {name?: string})?.name !== 'AbortError' && !controller.signal.aborted) {
                    setFetchedOptions([]);
                }
                if (!controller.signal.aborted) setFetching(false);
            }
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [inputValue, minSearchLength, debounceMs]);

    useEffect(() => () => abortRef.current?.abort(), []);

    useEffect(() => {
        if (autoHighlight && options.length > 0) combobox.selectFirstOption();
    }, [autoHighlight, options]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = useCallback((optionKey: string) => {
        const selected = options.find(o => String(getOptionKey(o)) === optionKey) ?? null;
        emittedRef.current = selected;
        setInputValue(selected ? getOptionLabel(selected) : '');
        onChange(selected);
        combobox.closeDropdown();
    }, [options, getOptionKey, getOptionLabel, onChange, combobox]);

    const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.currentTarget.value);
        if (emittedRef.current !== null) {
            emittedRef.current = null;
            onChange(null);
        }
        combobox.openDropdown();
    }, [onChange, combobox]);

    return (
        <Combobox store={combobox} onOptionSubmit={handleSubmit} disabled={disabled}>
            <Combobox.Target>
                <TextInput
                    label={label}
                    aria-label={ariaLabel}
                    placeholder={placeholder}
                    withAsterisk={withAsterisk}
                    disabled={disabled}
                    data-autofocus={autoFocus || undefined}
                    value={inputValue}
                    error={error}
                    rightSection={loading ? <Loader size={18} role="progressbar" aria-label="Searching"/> : null}
                    onFocus={() => combobox.openDropdown()}
                    onBlur={() => combobox.closeDropdown()}
                    onClick={() => combobox.openDropdown()}
                    onChange={handleChange}
                />
            </Combobox.Target>
            <Combobox.Dropdown>
                <Combobox.Options>
                    {options.length > 0 ? (
                        options.map(option => (
                            <Combobox.Option value={String(getOptionKey(option))} key={getOptionKey(option)}>
                                {renderOption ? renderOption(option) : getOptionLabel(option)}
                            </Combobox.Option>
                        ))
                    ) : (
                        <Combobox.Empty>
                            {inputValue.length >= minSearchLength ? (
                                <Group gap="xs" justify="center">
                                    <Icon lucide={SearchX} size={18}/>
                                    <Text fz="sm" c="dimmed">No matches for &ldquo;{inputValue}&rdquo;</Text>
                                </Group>
                            ) : (
                                <Text fz="sm" c="dimmed">Type at least {minSearchLength} characters to search</Text>
                            )}
                        </Combobox.Empty>
                    )}
                </Combobox.Options>
            </Combobox.Dropdown>
        </Combobox>
    );
}

export default SearchSelect;
