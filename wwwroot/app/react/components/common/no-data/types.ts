/**
 * NoData Component Types
 */

export interface NoDataProps {
    /** Title text to display */
    title?: string;
    /** Message text to display below the title */
    message?: string;
    /** Material icon name to display */
    icon?: string;
    /** Whether to show the action button */
    showAction?: boolean;
    /** Text for the action button */
    actionText?: string;
    /** Callback when action button is clicked */
    onAction?: () => void;
    /** Whether the current user is a US customer (affects theming) */
    isUsCustomer?: boolean;
}
