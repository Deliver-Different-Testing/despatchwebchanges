/**
 * NoData Component Types
 */

import type React from 'react';

export interface NoDataProps {
    /** Title text to display */
    title?: string;
    /** Message text to display below the title */
    message?: string;
    /**
     * Icon to display. Prefer an `@mui/icons-material` element (e.g. `<WorkOutlineIcon/>`)
     * — NoData controls its size and colour. A string is accepted for the AngularJS
     * `no-data-react` bridge and rendered via the Material Symbols font.
     */
    icon?: React.ReactNode;
    /** Whether to show the action button */
    showAction?: boolean;
    /** Text for the action button */
    actionText?: string;
    /** Callback when action button is clicked */
    onAction?: () => void;
    /** Whether the current user is a US customer (affects theming) */
    isUsCustomer?: boolean;
}
