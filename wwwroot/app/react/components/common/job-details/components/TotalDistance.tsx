/**
 * TotalDistance - Centered distance indicator between address and fields sections.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import RouteIcon from '@mui/icons-material/Route';

interface TotalDistanceProps {
    distance: number;
    isUsCustomer: boolean;
    visible: boolean;
}

export const TotalDistance = React.memo(function TotalDistance({distance, isUsCustomer, visible}: TotalDistanceProps) {
    if (!visible || !distance) return null;

    const unit = isUsCustomer ? 'miles' : 'km';

    return (
        <Box
            sx={{
                bgcolor: 'grey.50',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                py: 1,
                px: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
            }}
        >
            <RouteIcon sx={{fontSize: 18, color: 'primary.main', opacity: 0.7}}/>
            <Typography variant="body2" sx={{fontSize: '0.875rem', fontWeight: 600}}>
                {distance.toFixed(1)} {unit}
            </Typography>
        </Box>
    );
});
