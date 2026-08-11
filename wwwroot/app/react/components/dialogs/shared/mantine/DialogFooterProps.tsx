import React from "react";
import type {ButtonProps} from "@mantine/core";

export interface DialogFooterProps {
    /** Required unless `hideCancel` — the dialog's only way out is then the header close. */
    onCancel?: () => void;
    /** Required unless `hideConfirm` — a view-only dialog has nothing to confirm. */
    onConfirm?: () => void;
    confirmLabel?: React.ReactNode;
    cancelLabel?: React.ReactNode;
    /** Icon shown before the confirm label (hidden by the loader while submitting). */
    confirmIcon?: React.ReactNode;
    /** Mantine theme colour for the confirm button. Defaults to the theme primary (Cyan). */
    confirmColor?: ButtonProps['color'];
    /** Disables the confirm button independently of `submitting`. */
    confirmDisabled?: boolean;
    /** When true, shows a loader on confirm and disables both buttons. */
    submitting?: boolean;
    /** Drops the confirm button entirely — for view-only dialogs that only need a close. */
    hideConfirm?: boolean;
    /** Drops the cancel button — for dialogs whose single action also dismisses them. */
    hideCancel?: boolean;
    /** Extra control rendered between Cancel and Confirm (e.g. a "Skip" or "Reset"). */
    secondaryAction?: React.ReactNode;
}