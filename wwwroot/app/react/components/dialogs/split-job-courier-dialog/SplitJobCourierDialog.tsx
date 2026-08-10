/**
 * Split Job Courier Dialog
 *
 * Lets the user optionally assign a courier to the delivery leg (Leg B)
 * of a split job. Shown after the meeting point address dialog.
 *
 * Three outcomes:
 *  - Assign: user picked a courier  → { action: 'assign', courierId }
 *  - Skip:   user chose to skip     → { action: 'skip' }
 *  - Cancel: user closed the dialog → { action: 'cancel' }
 */

import React, {useState} from 'react';
import {Box, Button, Combobox, Loader, Text, TextInput, useCombobox} from '@mantine/core';
import {IconTruck} from '@tabler/icons-react';
import {Icon} from '../../common/icon/Icon';
import {useCourierSearch} from '../../../hooks/useCourierApi';
import type {CourierSuggestion} from '../../../interfaces';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg} from '../shared/mantine';

export type SplitJobCourierResult =
    | {action: 'assign'; courierId: number}
    | {action: 'skip'}
    | {action: 'cancel'};

export interface SplitJobCourierDialogProps {
    open: boolean;
    onClose: (result: SplitJobCourierResult) => void;
}

export const SplitJobCourierDialog: React.FC<SplitJobCourierDialogProps> = ({open, onClose}) => {
    const [searchText, setSearchText] = useState('');
    const [selected, setSelected] = useState<CourierSuggestion | null>(null);
    const {data: courierOptions = [], isFetching} = useCourierSearch(searchText, {enabled: open});
    const combobox = useCombobox({onDropdownClose: () => combobox.resetSelectedOption()});

    const handleAssign = () => {
        if (selected) {
            onClose({action: 'assign', courierId: selected.id});
        }
    };

    const cancel = () => onClose({action: 'cancel'});

    return (
        <DialogShell opened={open} onClose={cancel} size={420}>
            <DialogHeader
                icon={<Icon tabler={IconTruck}/>}
                title="Assign Courier to Delivery Leg"
                subtitle="Optionally assign a courier for delivery"
                onClose={cancel}
            />
            <Box p="lg" style={{backgroundColor: dialogContentBg, display: 'flex', flexDirection: 'column', gap: 'var(--mantine-spacing-md)'}}>
                <Text fz="sm" c="dimmed">
                    Optionally assign a courier to the delivery leg (Leg B). You can skip this step.
                </Text>
                <Combobox
                    store={combobox}
                    onOptionSubmit={(value) => {
                        const option = courierOptions.find(o => String(o.id) === value) ?? null;
                        setSelected(option);
                        setSearchText(option?.text ?? '');
                        combobox.closeDropdown();
                    }}
                >
                    <Combobox.Target>
                        <TextInput
                            label="Search courier..."
                            placeholder="Type at least 2 characters"
                            data-autofocus
                            value={searchText}
                            rightSection={isFetching ? <Loader size={18} role="progressbar" aria-label="Searching"/> : null}
                            onFocus={() => combobox.openDropdown()}
                            onBlur={() => combobox.closeDropdown()}
                            onClick={() => combobox.openDropdown()}
                            onChange={(event) => {
                                setSearchText(event.currentTarget.value);
                                setSelected(null);
                                combobox.openDropdown();
                            }}
                        />
                    </Combobox.Target>
                    <Combobox.Dropdown>
                        <Combobox.Options>
                            {courierOptions.length > 0 ? (
                                courierOptions.map(option => (
                                    <Combobox.Option value={String(option.id)} key={option.id}>
                                        {option.text}
                                    </Combobox.Option>
                                ))
                            ) : (
                                <Combobox.Empty>
                                    {searchText.length < 2 ? 'Type to search...' : 'No couriers found'}
                                </Combobox.Empty>
                            )}
                        </Combobox.Options>
                    </Combobox.Dropdown>
                </Combobox>
            </Box>
            <DialogFooter
                onCancel={cancel}
                onConfirm={handleAssign}
                confirmLabel="Assign"
                confirmDisabled={!selected}
                secondaryAction={
                    <Button variant="subtle" onClick={() => onClose({action: 'skip'})}>Skip</Button>
                }
            />
        </DialogShell>
    );
};
