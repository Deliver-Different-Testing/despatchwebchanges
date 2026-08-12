/**
 * React Auto Complete Dialog
 *
 * A modern replacement for the AngularJS auto-complete-dialog using MUI components.
 */

import React, {useState, useCallback, useEffect} from 'react';
import {Box, Checkbox, Combobox, Group, Loader, Paper, Text, TextInput, useCombobox} from '@mantine/core';
import {useDebouncedValue} from '@mantine/hooks';
import {SegmentedToggle} from '../../common/segmented-toggle';
import {Check, ListFilter, SearchX} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg, sectionPaperProps} from '../shared/mantine';

// Types
export interface Suggestion {
    id: number;
    text: string;
    selected?: boolean;
}

/**
 * 3-way Assign picker — per-type config for the radio row + filtered dropdown.
 * When AutoCompleteDialog receives a non-empty `typeOptions` prop, it renders
 * a radio row above the Autocomplete and routes the search callback through
 * the active option. Submit emits the chosen option's `value` alongside the
 * picked item so the caller knows which target column to write.
 * Steve 2026-05-26, HANDOVER-KEVIN-2026-05-26.md.
 */
export interface AssignTypeOption {
    /** Discriminator returned via onSubmit so the caller routes to the right field. */
    value: string;
    /** Radio label rendered to the operator. */
    label: string;
    /** Placeholder shown inside the search box when this option is active. */
    placeholder: string;
    /** Per-type search backend. Replaces the dialog-level onSearch when active. */
    onSearch: (searchTerm: string) => Promise<Suggestion[]>;
}

export interface AutoCompleteDialogProps {
    open: boolean;
    title: string;
    placeholder: string;
    itemIcon?: string;
    existingItem?: Suggestion;
    showRerateOption?: boolean;
    minInputLength?: number;
    /** When non-empty, renders the Type radio row above the dropdown. */
    typeOptions?: AssignTypeOption[];
    /** Initial radio selection (defaults to the first typeOption when omitted). */
    initialTypeValue?: string;
    onClose: () => void;
    onSubmit: (item: Suggestion, shouldRerate: boolean, selectedType?: string) => void;
    onSearch: (searchTerm: string) => Promise<Suggestion[]>;
}

export const AutoCompleteDialog: React.FC<AutoCompleteDialogProps> = ({
    open,
    title,
    placeholder,
    existingItem,
    showRerateOption = false,
    minInputLength = 1,
    typeOptions,
    initialTypeValue,
    onClose,
    onSubmit,
    onSearch,
}) => {
    const combobox = useCombobox({onDropdownClose: () => combobox.resetSelectedOption()});
    const hasTypeOptions = !!(typeOptions && typeOptions.length > 0);
    const defaultTypeValue = initialTypeValue ?? typeOptions?.[0]?.value ?? '';

    const [inputValue, setInputValue] = useState('');
    const [selectedItem, setSelectedItem] = useState<Suggestion | null>(existingItem ?? null);
    const [options, setOptions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [shouldRerate, setShouldRerate] = useState(false);
    const [selectedType, setSelectedType] = useState<string>(defaultTypeValue);

    // Resolve the active search function — when typeOptions is supplied the
    // radio determines which backend the dropdown queries. The dialog-level
    // onSearch is the fallback for non-typed callers (e.g. Client picker).
    const activeSearchFn = hasTypeOptions
        ? (typeOptions!.find((t) => t.value === selectedType)?.onSearch ?? onSearch)
        : onSearch;

    const activePlaceholder = hasTypeOptions
        ? (typeOptions!.find((t) => t.value === selectedType)?.placeholder ?? placeholder)
        : placeholder;

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedItem(existingItem ?? null);
            setInputValue(existingItem?.text ?? '');
            setOptions([]);
            setShouldRerate(false);
            setSelectedType(defaultTypeValue);
        }
    }, [open, existingItem, defaultTypeValue]);

    // Radio change — clear the prior selection so an operator can't accidentally
    // submit a courier id against the agent column or vice versa. The Autocomplete's
    // value/inputValue refresh too. Re-run the active search if the box still has
    // text in it so the new list populates without an extra keystroke.
    const handleTypeChange = useCallback((newType: string) => {
        setSelectedType(newType);
        setSelectedItem(null);
        setInputValue('');
        setOptions([]);
    }, []);

    // Debounced search
    const handleSearch = useCallback(async (searchTerm: string) => {
        if (searchTerm.length < minInputLength) {
            setOptions([]);
            return;
        }

        setLoading(true);
        try {
            const results = await activeSearchFn(searchTerm);
            setOptions(results);
        } catch (error) {
            console.error('Search failed:', error);
            setOptions([]);
        } finally {
            setLoading(false);
        }
    }, [activeSearchFn, minInputLength]);

    const [debouncedInput] = useDebouncedValue(inputValue, 300);

    useEffect(() => {
        if (debouncedInput && debouncedInput.length >= minInputLength) {
            void handleSearch(debouncedInput);
        }
    }, [debouncedInput, handleSearch, minInputLength]);

    const handleSubmit = () => {
        if (selectedItem) {
            onSubmit(selectedItem, shouldRerate, hasTypeOptions ? selectedType : undefined);
        }
    };

    return (
        <DialogShell opened={open} onClose={onClose}>
            <DialogHeader
                icon={<Icon lucide={ListFilter} />}
                title={title}
                subtitle="Search and select an option"
                onClose={onClose}
            />
            {/* Content */}
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Paper {...sectionPaperProps} p="lg">
                    {/* Type radio — only renders when typeOptions is supplied.
                        Steve 2026-05-26: "Add a radio button row above the
                        existing dropdown" for the 3-way Assign picker. */}
                    {hasTypeOptions && (
                        <Group gap="md" align="center" mb="md">
                            <Text fz="sm" fw={600} c="dimmed">Type:</Text>
                            <SegmentedToggle
                                aria-label="Type"
                                variant="inline"
                                value={selectedType}
                                onChange={handleTypeChange}
                                data={typeOptions!.map((opt) => ({value: opt.value, label: opt.label}))}
                            />
                        </Group>
                    )}

                    <Combobox
                        store={combobox}
                        onOptionSubmit={(value) => {
                            const option = options.find(o => String(o.id) === value) ?? null;
                            setSelectedItem(option);
                            setInputValue(option?.text ?? '');
                            combobox.closeDropdown();
                        }}
                    >
                        <Combobox.Target>
                            <TextInput
                                data-autofocus
                                placeholder={activePlaceholder}
                                value={inputValue}
                                rightSection={loading ? <Loader size={18} role="progressbar" aria-label="Searching" /> : null}
                                onFocus={() => combobox.openDropdown()}
                                onBlur={() => combobox.closeDropdown()}
                                onClick={() => combobox.openDropdown()}
                                onChange={(event) => {
                                    // Typing invalidates the previous pick.
                                    setInputValue(event.currentTarget.value);
                                    setSelectedItem(null);
                                    combobox.openDropdown();
                                }}
                            />
                        </Combobox.Target>
                        <Combobox.Dropdown>
                            <Combobox.Options>
                                {options.length > 0 ? (
                                    options.map(option => (
                                        <Combobox.Option value={String(option.id)} key={option.id}>
                                            <Group gap="xs" wrap="nowrap">
                                                <Icon lucide={ListFilter} size={20} color="var(--mantine-color-brand-6)" />
                                                <Text>{option.text}</Text>
                                            </Group>
                                        </Combobox.Option>
                                    ))
                                ) : (
                                    <Combobox.Empty>
                                        {inputValue.length >= minInputLength ? (
                                            <Group gap="xs" justify="center">
                                                <Icon lucide={SearchX} size={18} />
                                                <Text fz="sm" c="dimmed">
                                                    No {title.toLowerCase()} matching &quot;{inputValue}&quot; were found.
                                                </Text>
                                            </Group>
                                        ) : (
                                            <Text fz="sm" c="dimmed">
                                                Type at least {minInputLength} character{minInputLength > 1 ? 's' : ''} to search
                                            </Text>
                                        )}
                                    </Combobox.Empty>
                                )}
                            </Combobox.Options>
                        </Combobox.Dropdown>
                    </Combobox>

                    {/* Re-rate checkbox */}
                    {showRerateOption && (
                        <Checkbox
                            mt="md"
                            label="Re-Rate Job"
                            checked={shouldRerate}
                            onChange={(e) => setShouldRerate(e.currentTarget.checked)}
                        />
                    )}
                </Paper>
            </Box>
            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSubmit}
                confirmLabel="Save"
                confirmIcon={<Icon lucide={Check} />}
                confirmDisabled={!selectedItem}
            />
        </DialogShell>
    );
};

export default AutoCompleteDialog;
