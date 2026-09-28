import React, {useCallback, useEffect, useState} from 'react';
import {ActionIcon, TextInput} from '@mantine/core';
import {useDebouncedCallback} from '@mantine/hooks';
import {Search, X} from 'lucide-react';
import {Icon} from '../../../../components/common/icon/Icon';
import {FILTER_CONTROL_HEIGHT} from '../../../../components/common/filter-fields';

interface SearchFieldProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const DEBOUNCE_DELAY = 300;

export const SearchField: React.FC<SearchFieldProps> = ({value, onChange, placeholder = 'Search...'}) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Replaces a hand-rolled setTimeout plus its unmount teardown.
    const emitChange = useDebouncedCallback(onChange, DEBOUNCE_DELAY);

    const handleChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const val = event.currentTarget.value;
            setLocalValue(val);
            emitChange(val);
        },
        [emitChange]
    );

    // Clearing is deliberately immediate: the debounce exists to ride out typing,
    // and there is nothing to ride out when the field is emptied in one action.
    const handleClear = useCallback(() => {
        setLocalValue('');
        emitChange.flush();
        onChange('');
    }, [emitChange, onChange]);

    return (
        <TextInput
            size="xs"
            miw={200}
            placeholder={placeholder}
            aria-label={placeholder}
            value={localValue}
            onChange={handleChange}
            styles={{input: {height: FILTER_CONTROL_HEIGHT, minHeight: FILTER_CONTROL_HEIGHT}}}
            leftSection={<Icon lucide={Search} size={20}/>}
            rightSection={localValue ? (
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={handleClear}
                    aria-label="Clear search"
                >
                    <Icon lucide={X} size={18}/>
                </ActionIcon>
            ) : null}
        />
    );
};
