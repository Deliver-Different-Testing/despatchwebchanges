import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TuneIcon from '@mui/icons-material/Tune';

interface FilterToolbarProps {
    actions?: React.ReactNode;
    children: React.ReactNode;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({actions, children}) => (
    <Card sx={{borderRadius: 1, overflow: 'hidden'}}>
        <Toolbar
            variant="dense"
            sx={{bgcolor: 'background.paper', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider', minHeight: 44}}
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
