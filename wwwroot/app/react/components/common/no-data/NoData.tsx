/**
 * NoData Component
 *
 * Displays an empty state message with an icon and optional action button.
 * Used when there is no data to display in a section.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Icon from '@mui/material/Icon';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {NoDataProps} from "./types";

/**
 * NoData Component - displays an empty state with icon, title, message, and optional action
 */
export const NoData: React.FC<NoDataProps> = ({
                                                  title = 'No Data',
                                                  message = 'No items to display.',
                                                  icon = <InfoOutlinedIcon/>,
                                                  showAction = false,
                                                  actionText = 'Refresh',
                                                  onAction,
                                              }) => {
    // React callers pass an `@mui/icons-material` element (preferred); the
    // AngularJS `no-data-react` bridge passes a string ligature, which we
    // render via the Material Symbols font for backward compatibility.
    const iconNode = typeof icon === 'string'
        ? (
            <Icon
                sx={{
                    fontSize: 48,
                    height: 'auto',
                    width: 'auto',
                    color: 'text.secondary',
                    opacity: 0.7,
                    fontFamily: 'Material Symbols Outlined',
                    overflow: 'visible',
                }}
            >
                {icon}
            </Icon>
        )
        : (
            <Box
                sx={{
                    display: 'inline-flex',
                    color: 'text.secondary',
                    opacity: 0.7,
                    '& > svg': {fontSize: 48},
                }}
            >
                {icon}
            </Box>
        );

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                minHeight: 200,
                bgcolor: 'transparent',
                p: 3,
            }}
        >
            <Box sx={{mb: 1}}>
                {iconNode}
            </Box>
            <Typography
                variant="h6"
                sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 1,
                }}
            >
                {title}
            </Typography>
            <Typography
                variant="body2"
                sx={{
                    color: 'text.secondary',
                    mb: 2,
                    maxWidth: 240,
                }}
            >
                {message}
            </Typography>
            {showAction && (
                <Button
                    variant="contained"
                    onClick={() => onAction?.()}
                    sx={{borderRadius: 2}}
                >
                    {actionText}
                </Button>
            )}
        </Box>
    );
};

export default NoData;
