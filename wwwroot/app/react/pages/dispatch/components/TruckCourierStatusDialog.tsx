import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import RefreshIcon from '@mui/icons-material/Refresh';
import type {ITruckCourierStatus} from '../../../services/dispatchApi';

interface TruckCourierStatusDialogProps {
    open: boolean;
    onClose: () => void;
    truckCourierStatus: ITruckCourierStatus | null;
    isUsCustomer: boolean;
    onRefresh: () => void;
    isRefreshing: boolean;
}

export function TruckCourierStatusDialog({
    open,
    onClose,
    truckCourierStatus,
    isUsCustomer,
    onRefresh,
    isRefreshing,
}: TruckCourierStatusDialogProps) {
    const weightUnit = isUsCustomer ? 'lbs' : 'kg';
    const availableWeight =
        truckCourierStatus?.maxPayLoad != null && truckCourierStatus?.currentWeight != null
            ? truckCourierStatus.maxPayLoad - truckCourierStatus.currentWeight
            : undefined;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {borderRadius: 2, overflow: 'hidden'},
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    px: 3,
                    py: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                })}
            >
                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <LocalShippingIcon sx={{fontSize: 24}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" fontWeight={600}>
                        Truck Loading Status
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85}}>
                        {truckCourierStatus?.courierCode} {truckCourierStatus?.firstName}
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{color: 'white', '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'}}}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 3, bgcolor: 'background.default'}}>
                <Box sx={{display: 'flex', gap: 2}}>
                    <TextField
                        label="Max Pallets"
                        value={truckCourierStatus?.maxPallets ?? ''}
                        fullWidth
                        slotProps={{input: {readOnly: true}}}
                    />
                    <TextField
                        label={`Max Weight (${weightUnit})`}
                        value={truckCourierStatus?.maxPayLoad ?? ''}
                        fullWidth
                        slotProps={{input: {readOnly: true}}}
                    />
                    <TextField
                        label="Available Pallets"
                        value={truckCourierStatus?.availablePallets ?? ''}
                        fullWidth
                        slotProps={{input: {readOnly: true}}}
                    />
                </Box>
                <Box sx={{display: 'flex', gap: 2, mt: 2}}>
                    <TextField
                        label="Current Pallets"
                        value={truckCourierStatus?.currentPallets ?? ''}
                        fullWidth
                        slotProps={{input: {readOnly: true}}}
                    />
                    <TextField
                        label={`Current Weight (${weightUnit})`}
                        value={truckCourierStatus?.currentWeight ?? ''}
                        fullWidth
                        slotProps={{input: {readOnly: true}}}
                    />
                    <TextField
                        label={`Available Weight (${weightUnit})`}
                        value={availableWeight ?? ''}
                        fullWidth
                        slotProps={{input: {readOnly: true}}}
                    />
                </Box>
            </DialogContent>

            <DialogActions sx={{px: 3, py: 2}}>
                <Button onClick={onClose}>Close</Button>
                <Button
                    variant="contained"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    startIcon={isRefreshing ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                >
                    Refresh
                </Button>
            </DialogActions>
        </Dialog>
    );
}
