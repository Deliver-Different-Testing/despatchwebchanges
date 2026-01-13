/**
 * NoData Component
 *
 * Displays an empty state message with an icon and optional action button.
 * Used when there is no data to display in a section.
 */

import React from 'react';
import {
    Box,
    Typography,
    Button,
    Icon,
} from '@mui/material';

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

interface NoDataState {}

/**
 * NoData Component - displays an empty state with icon, title, message, and optional action
 */
export class NoData extends React.Component<NoDataProps, NoDataState> {
    static defaultProps: Partial<NoDataProps> = {
        title: 'No Data',
        message: 'No items to display.',
        icon: 'info',
        showAction: false,
        actionText: 'Refresh',
        isUsCustomer: false,
    };

    handleAction = () => {
        const { onAction } = this.props;
        if (onAction) {
            onAction();
        }
    };

    render() {
        const {
            title = 'No Data',
            message = 'No items to display.',
            icon = 'info',
            showAction = false,
            actionText = 'Refresh',
            isUsCustomer = false,
        } = this.props;

        // Theme colors
        const primaryColor = isUsCustomer ? '#1976d2' : '#ffeb3b';
        const primaryHoverColor = isUsCustomer ? '#1565c0' : '#fdd835';
        const buttonTextColor = isUsCustomer ? '#fff' : '#000';

        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minHeight: '200px',
                    backgroundColor: 'transparent',
                    padding: 3,
                }}
            >
                <Icon
                    sx={{
                        fontSize: '48px',
                        height: 'auto',
                        width: 'auto',
                        marginBottom: 1,
                        color: 'text.secondary',
                        opacity: 0.7,
                        fontFamily: 'Material Symbols Outlined',
                        overflow: 'visible',
                    }}
                >
                    {icon}
                </Icon>
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 600,
                        color: 'text.primary',
                        marginBottom: 1,
                    }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        color: 'text.secondary',
                        marginBottom: 2,
                        maxWidth: '240px',
                        lineHeight: 1.5,
                    }}
                >
                    {message}
                </Typography>
                {showAction && (
                    <Button
                        variant="contained"
                        onClick={this.handleAction}
                        sx={{
                            backgroundColor: primaryColor,
                            color: buttonTextColor,
                            borderRadius: '8px',
                            '&:hover': {
                                backgroundColor: primaryHoverColor,
                            },
                        }}
                    >
                        {actionText}
                    </Button>
                )}
            </Box>
        );
    }
}

export default NoData;
