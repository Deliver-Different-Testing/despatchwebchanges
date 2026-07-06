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
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import type {SxProps, Theme} from '@mui/material';
import {useCourierSearch} from '../../../hooks/useCourierApi';
import type {CourierSuggestion} from '../../../interfaces';
import {headerChromeSx, headerChipSx, headerOnColor, headerOverlayColor} from '../shared/styles';

export type SplitJobCourierResult =
    | {action: 'assign'; courierId: number}
    | {action: 'skip'}
    | {action: 'cancel'};

export interface SplitJobCourierDialogProps {
    open: boolean;
    onClose: (result: SplitJobCourierResult) => void;
}

const styles: Record<string, SxProps<Theme>> = {
    content: {
        pt: 1,
        minWidth: 360,
    },
};

export const SplitJobCourierDialog: React.FC<SplitJobCourierDialogProps> = ({open, onClose}) => {
    const [searchText, setSearchText] = useState('');
    const [selected, setSelected] = useState<CourierSuggestion | null>(null);
    const {data: courierOptions = [], isFetching} = useCourierSearch(searchText, {enabled: open});

    const handleAssign = () => {
        if (selected) {
            onClose({action: 'assign', courierId: selected.id});
        }
    };

    return (
        <Dialog open={open} onClose={() => onClose({action: 'cancel'})} maxWidth="xs" fullWidth>
            <Box sx={(theme) => headerChromeSx(theme)}>
                <Box sx={(theme) => headerChipSx(theme)}>
                    <LocalShippingIcon/>
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{
                        fontWeight: 600
                    }}>Assign Courier to Delivery Leg</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>Optionally assign a courier for delivery</Typography>
                </Box>
                <IconButton onClick={() => onClose({action: 'cancel'})} sx={(theme) => ({
                    color: headerOnColor(theme),
                    '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)}
                })}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <DialogContent sx={styles.content}>
                <Typography
                    variant="body2"
                    sx={{
                        color: "text.secondary",
                        mb: 2
                    }}>
                    Optionally assign a courier to the delivery leg (Leg B). You can skip this step.
                </Typography>
                <Autocomplete
                    options={courierOptions}
                    getOptionLabel={(option) => option.text}
                    loading={isFetching}
                    inputValue={searchText}
                    onInputChange={(_, value) => setSearchText(value)}
                    value={selected}
                    onChange={(_, value) => setSelected(value)}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    renderInput={({slotProps: autoSlotProps, ...params}) => (
                        <TextField
                            {...params}
                            label="Search courier..."
                            placeholder="Type at least 2 characters"
                            autoFocus
                            slotProps={{
                                ...autoSlotProps,
                                input: {
                                    ...autoSlotProps.input,
                                    endAdornment: (
                                        <>
                                            {isFetching ? <CircularProgress size={20}/> : null}
                                            {autoSlotProps.input.endAdornment}
                                        </>
                                    ),
                                },
                            }}
                        />
                    )}
                    noOptionsText={searchText.length < 2 ? 'Type to search...' : 'No couriers found'}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose({action: 'cancel'})}>Cancel</Button>
                <Button onClick={() => onClose({action: 'skip'})}>Skip</Button>
                <Button onClick={handleAssign} variant="contained" disabled={!selected}>
                    Assign
                </Button>
            </DialogActions>
        </Dialog>
    );
};
