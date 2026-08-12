/**
 * ToggleProperties - Checkboxes for truck, direct, active, void, etc.
 * Matches AngularJS footer-style checkbox layout.
 */

import React from 'react';
import {ActionIcon, Box, Checkbox, Collapse, Divider, Group, Paper, Text, UnstyledButton} from '@mantine/core';
import {Eye, EyeOff, SlidersHorizontal} from 'lucide-react';
import {Icon} from '../../icon/Icon';
import type {IJob} from '../JobDetails.types';
import {JobProperty} from '../../../../../enums/job-property.enum';
import {cardContainerProps, sectionBorderStyle} from '../JobDetails.styles';
import {SectionHeader} from './SectionHeader';

const togglesBodyStyle = (dense: boolean): React.CSSProperties => ({
    paddingInline: dense ? 12 : 16,
    paddingBlock: dense ? 6 : 12,
});

interface TogglePropertiesProps {
    job: IJob;
    isRecurringJob: boolean;
    dense: boolean;
    isEditMode: boolean;
    isFieldVisible: (key: string) => boolean;
    onToggleField: (key: string) => void;
    onToggleProperty: (property: string, currentValue: boolean) => void;
    onVoidClick: () => void;
    onActiveClick: () => void;
    onTailLiftPickupClick: () => void;
    onTailLiftDropOffClick: () => void;
    onDeliverToPrivateResChanged: (isResidential: boolean) => void;
    onDoneClick?: () => void;
}

function PropertyCheckbox({
    label,
    checked,
    onChange,
    disabled,
    dense,
}: {
    label: string;
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    dense?: boolean;
}) {
    return (
        <Checkbox
            size={dense ? 'xs' : 'sm'}
            label={label}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            styles={{label: {fontSize: '0.8125rem', paddingInlineStart: 6}}}
            mr={16}
        />
    );
}

export const ToggleProperties = React.memo(({
    job,
    isRecurringJob,
    dense,
    isEditMode,
    isFieldVisible,
    onToggleField,
    onToggleProperty,
    onVoidClick,
    onActiveClick,
    onTailLiftPickupClick,
    onTailLiftDropOffClick,
    onDeliverToPrivateResChanged,
    onDoneClick,
}: TogglePropertiesProps) => {
    if (isEditMode) {
        const visible = isFieldVisible('checkboxes');
        return (
            <Group justify="space-between" style={{...sectionBorderStyle, paddingInline: 8, paddingBlock: 4}}>
                <UnstyledButton
                    onClick={() => onToggleField('checkboxes')}
                    style={{flex: 1, minWidth: 0, textAlign: 'left'}}
                >
                    <Text size="sm" c={visible ? undefined : 'dimmed'} style={{fontSize: '0.8125rem'}}>
                        Properties
                    </Text>
                </UnstyledButton>
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => onToggleField('checkboxes')}
                    aria-label={visible ? 'Hide Properties' : 'Show Properties'}
                >
                    <Icon lucide={visible ? Eye : EyeOff} size={18}/>
                </ActionIcon>
            </Group>
        );
    }

    const locked = !!job.locked;

    return (
        <Collapse expanded={isFieldVisible('checkboxes')} keepMounted={false}>
            <Paper {...cardContainerProps}>
                <SectionHeader lucide={SlidersHorizontal} title="Job Properties" dense={dense}/>
                <Box style={togglesBodyStyle(dense)}>
                    <Group justify="center" gap={dense ? 2 : 4} wrap="wrap">
                        <PropertyCheckbox
                            label="Truck" checked={!!job.truck} dense={dense}
                            onChange={() => onToggleProperty(JobProperty.Truck, !!job.truck)}
                            disabled={locked}
                        />
                        <PropertyCheckbox
                            label="Direct" checked={!!job.direct} dense={dense}
                            onChange={() => onToggleProperty(JobProperty.Direct, !!job.direct)}
                            disabled={locked}
                        />
                        <PropertyCheckbox
                            label="Van" checked={job.van} dense={dense}
                            onChange={() => onToggleProperty(JobProperty.Van, job.van)}
                            disabled={locked}
                        />
                        <PropertyCheckbox
                            label="Reprice" checked={!!job.reprice} dense={dense}
                            onChange={() => onToggleProperty(JobProperty.Reprice, !!job.reprice)}
                            disabled={locked}
                        />
                        {!isRecurringJob && (
                            <PropertyCheckbox
                                label="Done" checked={!!job.done} dense={dense}
                                onChange={() => onDoneClick?.()}
                                disabled={locked}
                            />
                        )}
                        {!isRecurringJob && (
                            <PropertyCheckbox
                                label="Void" checked={!!job.void} dense={dense}
                                onChange={onVoidClick}
                                disabled={locked}
                            />
                        )}
                        {isRecurringJob && (
                            <PropertyCheckbox
                                label="Active" checked={!!job.active} dense={dense}
                                onChange={onActiveClick}
                            />
                        )}
                    </Group>

                    {/* Truck Options */}
                    <Collapse expanded={isFieldVisible('truckOptions') && !!job.truck} keepMounted={false}>
                        <Divider my={4}/>
                        <Text size="xs" c="dimmed" fw={500} mb={4}>
                            Truck Options
                        </Text>
                        <Group justify="center" wrap="wrap" gap={0}>
                            <PropertyCheckbox
                                label="Tail Lift PU" checked={job.tailLiftPu} dense={dense}
                                onChange={onTailLiftPickupClick}
                                disabled={locked || job.isBulkJob}
                            />
                            <PropertyCheckbox
                                label="Tail Lift DO" checked={job.tailLiftDo} dense={dense}
                                onChange={onTailLiftDropOffClick}
                                disabled={locked || job.isBulkJob}
                            />
                            <PropertyCheckbox
                                label="Residential" checked={job.deliverToPrivateRes} dense={dense}
                                onChange={() => onDeliverToPrivateResChanged(!job.deliverToPrivateRes)}
                                disabled={locked || job.isBulkJob}
                            />
                        </Group>
                    </Collapse>
                </Box>
            </Paper>
        </Collapse>
    );
});
