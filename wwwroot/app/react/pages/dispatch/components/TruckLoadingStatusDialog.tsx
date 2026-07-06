import React from 'react';
import {useQuery} from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import {fetchTruckCourierStatus} from '../../../services/courierApi';
import {queryKeys} from '../../../query/queryClient';
import {
    headerChipSx,
    headerChromeSx,
    headerOnColor,
    headerOverlayColor
} from '../../../components/dialogs/shared/styles';

export interface TruckLoadingStatusDialogProps {
    open: boolean;
    courierId?: number;
    courierLabel?: string;
    isUsCustomer: boolean;
    onClose: () => void;
}

const numberOrDash = (v: number | undefined): string =>
    v === undefined || v === null ? '—' : String(v);

/**
 * Read-only truck loading status (pallet + weight capacity) for a courier,
 * with a Refresh button. React port of the AngularJS
 * truck-courier-status-dialog. Follows the job-detail dialog design language.
 */
export const TruckLoadingStatusDialog: React.FC<TruckLoadingStatusDialogProps> = ({
    open,
    courierId,
    courierLabel,
    isUsCustomer,
    onClose,
}) => {
    const weightUnit = isUsCustomer ? 'lbs' : 'kg';

    const {data, isFetching, refetch} = useQuery({
        queryKey: queryKeys.dispatch.truckCourierStatus(courierId ?? 0),
        queryFn: ({signal}) => fetchTruckCourierStatus(courierId!, {signal}),
        enabled: open && !!courierId,
    });

    const availableWeight = data?.maxPayLoad != null && data?.currentWeight != null
        ? data.maxPayLoad - data.currentWeight
        : undefined;

    const fields: Array<{label: string; value: string}> = [
        {label: 'Max Pallets', value: numberOrDash(data?.maxPallets)},
        {label: `Max Weight (${weightUnit})`, value: numberOrDash(data?.maxPayLoad)},
        {label: 'Available Pallets', value: numberOrDash(data?.availablePallets)},
        {label: 'Current Pallets', value: numberOrDash(data?.currentPallets)},
        {label: `Current Weight (${weightUnit})`, value: numberOrDash(data?.currentWeight)},
        {label: `Available Weight (${weightUnit})`, value: numberOrDash(availableWeight)},
    ];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{paper: {elevation: 24, sx: {borderRadius: 2, overflow: 'hidden', minWidth: 480, maxWidth: 600}}}}
        >
            <Box sx={(theme) => headerChromeSx(theme)}>
                <Box sx={(theme) => headerChipSx(theme)}>
                    <LocalShippingIcon/>
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" sx={{fontWeight: 600}}>Truck Loading Status</Typography>
                    {courierLabel && (
                        <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>{courierLabel}</Typography>
                    )}
                </Box>
                <IconButton onClick={onClose} aria-label="Close dialog" sx={(theme) => ({
                    color: headerOnColor(theme),
                    '&:hover': {bgcolor: headerOverlayColor(theme, 0.1)}
                })}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3}}>
                    <Paper elevation={0} sx={{bgcolor: 'white', borderRadius: 3, p: 2.5, border: '1px solid', borderColor: 'grey.200'}}>
                        <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2}}>
                            {fields.map(f => (
                                <Box key={f.label}>
                                    <Typography variant="body2" sx={{color: 'text.secondary', mb: 0.5}}>{f.label}</Typography>
                                    <Typography variant="h6" sx={{fontWeight: 600}}>{f.value}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Paper>
                </Box>
            </DialogContent>

            <DialogActions sx={(theme) => ({px: 3, py: 2, bgcolor: 'white', borderTop: `1px solid ${theme.palette.divider}`, gap: 1})}>
                <Button onClick={onClose} variant="outlined" sx={{minWidth: 100}}>Close</Button>
                <Button
                    onClick={() => refetch()}
                    variant="contained"
                    color="primary"
                    disabled={isFetching}
                    startIcon={isFetching ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                    sx={{minWidth: 100}}
                >
                    Refresh
                </Button>
            </DialogActions>
        </Dialog>
    );
};
