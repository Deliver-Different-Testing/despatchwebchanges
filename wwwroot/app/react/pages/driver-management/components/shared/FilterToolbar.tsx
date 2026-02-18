import React from 'react';
import {Card, CardContent, Toolbar, Typography, Box} from '@mui/material';
import {Tune as TuneIcon} from '@mui/icons-material';

interface FilterToolbarProps {
    actions?: React.ReactNode;
    children: React.ReactNode;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({actions, children}) => (
    <Card sx={{borderRadius: 1, overflow: 'hidden'}}>
        <Toolbar
            variant="dense"
            sx={{bgcolor: 'primary.main', color: 'primary.contrastText', minHeight: 40}}
        >
            <TuneIcon sx={{mr: 1, fontSize: 20}} />
            <Typography variant="subtitle2">Filters</Typography>
            <Box sx={{flexGrow: 1}} />
            {actions}
        </Toolbar>
        <CardContent sx={{display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', py: 1.5, '&:last-child': {pb: 1.5}}}>
            {children}
        </CardContent>
    </Card>
);
