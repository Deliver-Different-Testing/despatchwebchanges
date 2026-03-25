/**
 * ToggleProperties - Checkboxes for truck, direct, active, void, etc.
 * Matches AngularJS footer-style checkbox layout.
 */

import React from 'react';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import type {IJob} from '../JobDetails.types';
import {JobProperty} from '../../../../../enums/job-property.enum';
import {cardContainerSx} from '../JobDetails.styles';

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
        <FormControlLabel
            control={
                <Checkbox
                    size="small"
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    sx={{p: dense ? 0.25 : 0.5}}
                />
            }
            label={<Typography variant="body2" sx={{fontSize: '0.8125rem'}}>{label}</Typography>}
            sx={{ml: 0, mr: 2}}
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
        return (
            <Box sx={{borderTop: 1, borderColor: 'divider'}}>
                <List dense disablePadding>
                    <ListItem
                        dense
                        secondaryAction={
                            <IconButton edge="end" size="small" onClick={() => onToggleField('checkboxes')}>
                                {isFieldVisible('checkboxes') ? <VisibilityIcon sx={{fontSize: 18}}/> :
                                    <VisibilityOffIcon sx={{fontSize: 18}}/>}
                            </IconButton>
                        }
                    >
                        <ListItemButton dense onClick={() => onToggleField('checkboxes')}>
                            <ListItemText
                                primary="Properties"
                                slotProps={{
                                    primary: {
                                        variant: 'body2',
                                        fontSize: '0.8125rem',
                                        color: isFieldVisible('checkboxes') ? 'text.primary' : 'text.disabled'
                                    }
                                }}
                            />
                        </ListItemButton>
                    </ListItem>
                </List>
            </Box>
        );
    }

    if (!isFieldVisible('checkboxes')) return null;

    const locked = !!job.locked;

    return (
        <Box sx={{...cardContainerSx as object, bgcolor: 'grey.50', px: 2, py: 1.5}}>
            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center'}}>
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
            </Box>

            {/* Truck Options */}
            {isFieldVisible('truckOptions') && job.truck && (
                <>
                    <Divider sx={{my: 0.5}}/>
                    <Typography variant="caption" color="text.secondary"
                                sx={{mb: 0.5, display: 'block', fontWeight: 500}}>
                        Truck Options
                    </Typography>
                    <Box sx={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center'}}>
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
                        <FormControlLabel
                            control={
                                <Checkbox
                                    size="small"
                                    checked={job.deliverToPrivateRes}
                                    onChange={(e) => onDeliverToPrivateResChanged(e.target.checked)}
                                    disabled={locked || job.isBulkJob}
                                    sx={{p: dense ? 0.25 : 0.5}}
                                />
                            }
                            label={<Typography variant="body2" sx={{fontSize: '0.8125rem'}}>Residential</Typography>}
                            sx={{ml: 0, mr: 2}}
                        />
                    </Box>
                </>
            )}
        </Box>
    );
});
