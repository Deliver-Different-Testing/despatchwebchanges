import React from "react";

export interface SearchSelectProps<T> {
    /**
     * Visible field label. Optional because some call sites have no room for one
     * (an inline table cell); those must pass `aria-label` instead so the input
     * still has an accessible name.
     */
    label?: string;
    'aria-label'?: string;
    placeholder?: string;
    /** The selected option, or null. Owned by the caller. */
    value: T | null;
    /** Fired with the chosen option, or with null as soon as the user edits the text. */
    onChange: (value: T | null) => void;
    /**
     * Self-managed mode: fetches options for a term, aborted when the term
     * changes again. Use this **or** the caller-managed `options` below.
     */
    search?: (term: string, options?: { signal?: AbortSignal }) => Promise<T[]>;
    /**
     * Caller-managed mode: the options to show, for callers that already own the
     * fetch (a React Query hook, say). Pair with `onSearchChange` and `loading`.
     */
    options?: T[];
    /** Caller-managed mode: the debounced search term, once it is long enough. */
    onSearchChange?: (term: string) => void;
    /** Caller-managed mode: whether a fetch is in flight. */
    loading?: boolean;
    getOptionKey: (option: T) => string | number;
    getOptionLabel: (option: T) => string;
    /** Option row content; defaults to `getOptionLabel`. */
    renderOption?: (option: T) => React.ReactNode;
    error?: string;
    withAsterisk?: boolean;
    disabled?: boolean;
    /** Marks the field for Mantine's modal autofocus. */
    autoFocus?: boolean;
    minSearchLength?: number;
    debounceMs?: number;
    /**
     * Highlight the first option as soon as results arrive, so Enter picks it —
     * MUI `Autocomplete`'s `autoHighlight`. Mantine's `Combobox` activates no
     * option until the user arrows onto one, so without this Enter does nothing
     * and a "type the code, press Enter" flow silently stops working.
     */
    autoHighlight?: boolean;
}