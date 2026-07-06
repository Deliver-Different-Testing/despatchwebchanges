/**
 * DialogShell
 *
 * The standard <Dialog> wrapper for the dialog design language: `maxWidth="sm"`,
 * `fullWidth`, and the elevation-24 rounded paper with the fixed min/max width.
 * Extracted from the ~40 dialogs that hand-copied this block (see CLAUDE.md
 * "Dialog design language").
 *
 * Compose with <DialogHeader>, <DialogContent> and <DialogFooter> as children.
 */
import React from 'react';
import Dialog, {type DialogProps} from '@mui/material/Dialog';

export interface DialogShellProps extends Omit<DialogProps, 'maxWidth'> {
    open: boolean;
    onClose: DialogProps['onClose'];
    /** Defaults to "sm", matching the design language. */
    maxWidth?: DialogProps['maxWidth'];
}

export const DialogShell: React.FC<DialogShellProps> = ({
    open,
    onClose,
    maxWidth = 'sm',
    children,
    slotProps,
    ...rest
}) => (
    <Dialog
        open={open}
        onClose={onClose}
        maxWidth={maxWidth}
        fullWidth
        {...rest}
        slotProps={{
            ...slotProps,
            paper: {
                elevation: 24,
                sx: {
                    // Corner radius comes from the theme's MD3 MuiDialog override
                    // (extra-large, 28px) — not re-set here so it stays centralised.
                    overflow: 'hidden',
                    minWidth: 480,
                    maxWidth: 600,
                },
                ...slotProps?.paper,
            },
        }}
    >
        {children}
    </Dialog>
);

export default DialogShell;
