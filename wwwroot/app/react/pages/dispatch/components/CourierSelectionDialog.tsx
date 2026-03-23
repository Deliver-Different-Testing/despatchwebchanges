/**
 * Courier Selection Dialog
 *
 * Dialog for selecting a courier to reallocate a job to.
 * Shows search results and potential couriers for the selected job.
 */

import React, {useState, useCallback} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import CloseIcon from '@mui/icons-material/Close';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SearchIcon from '@mui/icons-material/Search';
import {searchActiveCouriers} from '../../../services/courierApi';

export interface CourierSelection {
    courierId: number;
    courierCode: string;
    courierName: string;
}

export interface PotentialCourierItem {
    courierId: number;
    name?: string;
    code?: string;
    firstName?: string;
    reason?: string;
    distance?: number;
}

interface CourierSelectionDialogProps {
    open: boolean;
    onClose: () => void;
    onSelect: (courier: CourierSelection) => void;
    jobNo: string;
    potentialCouriers?: PotentialCourierItem[];
}

export function CourierSelectionDialog({
    open,
    onClose,
    onSelect,
    jobNo,
    potentialCouriers,
}: CourierSelectionDialogProps) {
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<Array<{id: number; text: string}>>([]);
    const [searching, setSearching] = useState(false);
    const [selectedCourier, setSelectedCourier] = useState<CourierSelection | null>(null);

    const handleSearch = useCallback(async () => {
        if (!searchText.trim()) return;
        setSearching(true);
        try {
            const results = await searchActiveCouriers(searchText.trim());
            setSearchResults(results);
        } catch {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    }, [searchText]);

    const handleConfirm = useCallback(() => {
        if (selectedCourier) {
            onSelect(selectedCourier);
        }
    }, [selectedCourier, onSelect]);

    const handleClose = useCallback(() => {
        setSearchText('');
        setSearchResults([]);
        setSelectedCourier(null);
        onClose();
    }, [onClose]);

    return (
        <Dialog
            open={open}
            onClose={handleClose}
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
                    <SwapHorizIcon sx={{fontSize: 24}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" fontWeight={600}>
                        Select Courier
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85}}>
                        Reallocate job {jobNo}
                    </Typography>
                </Box>
                <IconButton
                    onClick={handleClose}
                    sx={{color: 'white', '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'}}}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 3, bgcolor: 'background.default'}}>
                {/* Search */}
                <TextField
                    autoFocus
                    fullWidth
                    size="small"
                    placeholder="Search courier by name or code..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearch();
                    }}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{fontSize: 20, color: 'text.secondary'}} />
                                </InputAdornment>
                            ),
                            endAdornment: searching ? (
                                <InputAdornment position="end">
                                    <CircularProgress size={18} />
                                </InputAdornment>
                            ) : undefined,
                        },
                    }}
                    sx={{mb: 2}}
                />

                {/* Search results */}
                {searchResults.length > 0 && (
                    <Box sx={{mb: 2}}>
                        <Typography variant="caption" color="text.secondary" sx={{px: 1}}>
                            Search Results
                        </Typography>
                        <List dense sx={{maxHeight: 200, overflow: 'auto'}}>
                            {searchResults.map((courier) => (
                                <ListItemButton
                                    key={courier.id}
                                    selected={selectedCourier?.courierId === courier.id}
                                    onClick={() => setSelectedCourier({
                                        courierId: courier.id,
                                        courierCode: String(courier.id),
                                        courierName: courier.text,
                                    })}
                                    sx={{borderRadius: 1}}
                                >
                                    <ListItemText primary={courier.text} />
                                </ListItemButton>
                            ))}
                        </List>
                    </Box>
                )}

                {/* Potential couriers */}
                {potentialCouriers && potentialCouriers.length > 0 && (
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{px: 1}}>
                            Suggested Couriers
                        </Typography>
                        <List dense sx={{maxHeight: 250, overflow: 'auto'}}>
                            {potentialCouriers.map((courier) => {
                                const displayName = courier.firstName || courier.name || '';
                                const displayCode = courier.code || String(courier.courierId);
                                const secondary = courier.reason
                                    || (courier.distance != null ? `${courier.distance.toFixed(1)} km away` : undefined);
                                return (
                                    <ListItemButton
                                        key={courier.courierId}
                                        selected={selectedCourier?.courierId === courier.courierId}
                                        onClick={() => setSelectedCourier({
                                            courierId: courier.courierId,
                                            courierCode: displayCode,
                                            courierName: displayName,
                                        })}
                                        sx={{borderRadius: 1}}
                                    >
                                        <ListItemText
                                            primary={`${displayCode} - ${displayName}`}
                                            secondary={secondary}
                                        />
                                    </ListItemButton>
                                );
                            })}
                        </List>
                    </Box>
                )}

                {searchResults.length === 0 && (!potentialCouriers || potentialCouriers.length === 0) && (
                    <Typography variant="body2" color="text.secondary" sx={{textAlign: 'center', py: 3}}>
                        Search for a courier or select from suggestions
                    </Typography>
                )}
            </DialogContent>

            <DialogActions sx={(theme) => ({px: 3, py: 2, bgcolor: 'white', borderTop: `1px solid ${theme.palette.divider}`, gap: 1})}>
                <Button onClick={handleClose} variant="outlined">
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    disabled={!selectedCourier}
                >
                    Reallocate
                </Button>
            </DialogActions>
        </Dialog>
    );
}
