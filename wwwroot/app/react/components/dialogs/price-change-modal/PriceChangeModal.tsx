import React from 'react';
import {alpha} from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import EditNoteIcon from '@mui/icons-material/EditNote';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import {headerChipSx, headerChromeSx, headerOnColor, headerOverlayColor} from '../shared/styles';
import {PriceDelta} from '../shared/PriceDelta';

export interface PriceChangeModalProps {
    open: boolean;
    jobNumber: string;
    oldPrice: number;
    newPrice: number;
    description: string | null;
    isApplying: boolean;
    onAccept: () => void;
    onKeep: () => void;
    onManualEdit: () => void;
}

export const PriceChangeModal: React.FC<PriceChangeModalProps> = ({
    open,
    jobNumber,
    oldPrice,
    newPrice,
    description,
    isApplying,
    onAccept,
    onKeep,
    onManualEdit,
}) => {
    const diff = newPrice - oldPrice;
    const diffColor = diff > 0 ? 'error.main' : diff < 0 ? 'success.main' : 'text.secondary';

    return (
        <Dialog
            open={open}
            onClose={isApplying ? undefined : onKeep}
            maxWidth="xs"
            disableEnforceFocus
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {overflow: 'hidden', width: 400, maxWidth: '95vw'},
                },
            }}
        >
            {/* Header */}
            <Box sx={(theme) => ({
                ...headerChromeSx(theme, 'warning'),
                minHeight: 48,
            })}>
                <Box sx={(theme) => headerChipSx(theme, 'warning')}>
                    <NotificationsActiveIcon/>
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" sx={{
                        fontWeight: 600
                    }}>Price Change</Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>{jobNumber}</Typography>
                </Box>
                <IconButton
                    onClick={onKeep}
                    disabled={isApplying}
                    sx={(theme) => ({
                        color: headerOnColor(theme, 'warning'),
                        '&:hover': {bgcolor: headerOverlayColor(theme, 0.15, 'warning')}
                    })}>
                    <CloseIcon />
                </IconButton>
            </Box>
            {/* Price comparison */}
            <Box sx={{p: '24px 24px 20px'}}>
                <Typography
                    variant="body2"
                    sx={{
                        color: "text.secondary",
                        mb: 2.5
                    }}>
                    Updating this job changes its calculated price. How would you like to proceed?
                </Typography>

                <Box sx={(theme) => ({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    p: 2,
                    bgcolor: alpha(theme.palette.common.black, 0.04),
                    borderRadius: 2.5,
                    mb: 0.5,
                })}>
                    <Box sx={{textAlign: 'center', flex: 1}}>
                        <Typography
                            variant="caption"
                            sx={{
                                color: "text.secondary",
                                display: "block",
                                mb: 0.5
                            }}>
                            Original
                        </Typography>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 600,
                                color: "text.secondary"
                            }}>
                            ${oldPrice.toFixed(2)}
                        </Typography>
                    </Box>
                    <ArrowForwardIcon sx={{fontSize: 20, color: 'text.disabled', flexShrink: 0}} />
                    <Box sx={{textAlign: 'center', flex: 1}}>
                        <Typography
                            variant="caption"
                            sx={{
                                color: "text.secondary",
                                display: "block",
                                mb: 0.5
                            }}>
                            New
                        </Typography>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 700,
                                color: "primary.main"
                            }}>
                            ${newPrice.toFixed(2)}
                        </Typography>
                    </Box>
                </Box>

                {diff !== 0 && (
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 1}}>
                        <PriceDelta oldPrice={oldPrice} newPrice={newPrice} />
                        <Typography variant="body2" color={diffColor} sx={{
                            fontWeight: 600
                        }}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                        </Typography>
                    </Box>
                )}

                {description && (
                    <Box sx={(theme) => ({
                        mt: 2,
                        p: 1.5,
                        bgcolor: alpha(theme.palette.common.black, 0.04),
                        borderRadius: 2,
                    })}>
                        {description.split(/\r|\n/).filter(Boolean).map((line, i) => (
                            <Typography
                                key={i}
                                variant="caption"
                                sx={{
                                    color: "text.secondary",
                                    display: "block",
                                    lineHeight: 1.8
                                }}>
                                {line}
                            </Typography>
                        ))}
                    </Box>
                )}
            </Box>
            {/* Actions */}
            <Box sx={{
                px: 2,
                pb: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
            }}>
                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={onAccept}
                    disabled={isApplying}
                    startIcon={<CheckIcon />}
                    sx={{borderRadius: 2, fontWeight: 500, py: 1}}
                >
                    {isApplying ? 'Applying…' : `Accept New Price ($${newPrice.toFixed(2)})`}
                </Button>
                <Box sx={{display: 'flex', gap: 1}}>
                    <Button
                        variant="outlined"
                        fullWidth
                        onClick={onKeep}
                        disabled={isApplying}
                        sx={{borderRadius: 2, color: 'text.secondary', borderColor: 'divider'}}
                    >
                        Keep Original
                    </Button>
                    <Button
                        variant="outlined"
                        fullWidth
                        onClick={onManualEdit}
                        disabled={isApplying}
                        startIcon={<EditNoteIcon />}
                        sx={{borderRadius: 2, color: 'text.secondary', borderColor: 'divider'}}
                    >
                        Set Manually
                    </Button>
                </Box>
            </Box>
        </Dialog>
    );
};

export default PriceChangeModal;
