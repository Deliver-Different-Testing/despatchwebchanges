import React from 'react';
import {Box, Card, CardContent, Typography} from '@mui/material';

interface StatCardProps {
    value: string | number;
    label: string;
    color?: string;
    icon?: React.ReactElement;
}

export const StatCard: React.FC<StatCardProps> = ({value, label, color, icon}) => (
    <Card sx={{flex: 1, minWidth: 140, borderRadius: 1, overflow: 'hidden'}}>
        <Box sx={{height: 3, bgcolor: color || 'grey.300'}} />
        <CardContent sx={{py: 1.5, '&:last-child': {pb: 1.5}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                {icon && React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, {sx: {fontSize: 28, color, ...(icon.props as Record<string, unknown>)?.sx as object}})}
                <Typography variant="h5" fontWeight={700} color={color}>{value}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
        </CardContent>
    </Card>
);
