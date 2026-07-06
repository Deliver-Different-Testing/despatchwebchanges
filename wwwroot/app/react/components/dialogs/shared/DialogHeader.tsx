/**
 * DialogHeader
 *
 * The gradient header block for the dialog design language: a 44×44 icon badge,
 * a title (+ optional subtitle), and a close button, over a main→dark gradient.
 * `variant="error"` swaps the primary palette for the error palette on
 * destructive dialogs.
 *
 * The icon badge normalises its child glyph to `fontSize: 24`, so pass a plain
 * icon element (e.g. `icon={<DeleteIcon />}`) — no need to size it yourself.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import {headerChromeSx, headerChipSx, headerOnColor, headerOverlayColor} from './styles';

export interface DialogHeaderProps {
    icon: React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    onClose: () => void;
    /** "error" uses the error palette for destructive dialogs. */
    variant?: 'primary' | 'error';
    /** Disables the close button (e.g. while a submit is in flight). */
    closeDisabled?: boolean;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({
    icon,
    title,
    subtitle,
    onClose,
    variant = 'primary',
    closeDisabled = false,
}) => (
    <Box sx={(theme) => headerChromeSx(theme, variant)}>
        <Box sx={(theme) => headerChipSx(theme, variant)}>
            {icon}
        </Box>
        <Box sx={{flex: 1}}>
            <Typography variant="h6" sx={{fontWeight: 600}}>
                {title}
            </Typography>
            {subtitle != null && (
                <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                    {subtitle}
                </Typography>
            )}
        </Box>
        <IconButton
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close dialog"
            sx={(theme) => ({
                color: headerOnColor(theme, variant),
                '&:hover': {bgcolor: headerOverlayColor(theme, 0.1, variant)},
            })}
        >
            <CloseIcon/>
        </IconButton>
    </Box>
);

export default DialogHeader;
