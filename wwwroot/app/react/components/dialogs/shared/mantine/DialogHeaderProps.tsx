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
}