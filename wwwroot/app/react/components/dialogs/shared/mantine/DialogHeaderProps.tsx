import React from "react";
import type {HeaderVariant} from "./styles";

export interface DialogHeaderProps {
    icon: React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    onClose: () => void;
    /** Fill palette — "error"/"warning" for destructive/cautionary dialogs. Defaults to "primary". */
    variant?: HeaderVariant;
    /** Disables the close button (e.g. while a submit is in flight). */
    closeDisabled?: boolean;
    /**
     * Extra controls rendered immediately before the close button — a refresh
     * or overflow menu. Style them with `headerOnColor`/`headerOverlayColor` so
     * they read on the header fill.
     */
    actions?: React.ReactNode;
}