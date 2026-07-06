/**
 * DialogFooter
 *
 * The standard <DialogActions> footer: an outlined Cancel on the left and a
 * contained primary action on the right, both `minWidth: 100`. While
 * `submitting` is true the confirm button shows a spinner and both buttons
 * disable.
 */
import React from 'react';
import DialogActions from '@mui/material/DialogActions';
import Button, {type ButtonProps} from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

export interface DialogFooterProps {
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel: React.ReactNode;
    cancelLabel?: React.ReactNode;
    /** Icon shown before the confirm label (replaced by a spinner while submitting). */
    confirmIcon?: React.ReactNode;
    confirmColor?: ButtonProps['color'];
    /** Disables the confirm button independently of `submitting`. */
    confirmDisabled?: boolean;
    /** When true, shows a spinner on confirm and disables both buttons. */
    submitting?: boolean;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({
    onCancel,
    onConfirm,
    confirmLabel,
    cancelLabel = 'Cancel',
    confirmIcon,
    confirmColor = 'primary',
    confirmDisabled = false,
    submitting = false,
}) => (
    <DialogActions
        sx={(theme) => ({
            px: 3,
            py: 2,
            bgcolor: 'background.paper',
            borderTop: `1px solid ${theme.palette.divider}`,
            gap: 1,
        })}
    >
        <Button
            onClick={onCancel}
            variant="outlined"
            disabled={submitting}
            sx={{minWidth: 100, minHeight: 44}}
        >
            {cancelLabel}
        </Button>
        <Button
            onClick={onConfirm}
            variant="contained"
            color={confirmColor}
            disabled={confirmDisabled || submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit"/> : confirmIcon}
            sx={{minWidth: 100, minHeight: 44}}
        >
            {confirmLabel}
        </Button>
    </DialogActions>
);

export default DialogFooter;
