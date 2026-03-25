import React from 'react';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Icon from '@mui/material/Icon';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import type {SxProps, Theme} from '@mui/material';

interface FilterToolbarProps {
    actions?: React.ReactNode;
    children: React.ReactNode;
}

const cardHeaderStyle: SxProps<Theme> = (theme: Theme) => ({
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    minHeight: 40,
    px: 1.25,
    gap: 0.5,
    flexShrink: 0,
    boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.2)}`,
    '& .MuiIconButton-root': {
        color: 'inherit',
        p: 0.5,
        borderRadius: 1,
        transition: 'background-color 150ms ease, transform 150ms ease',
        '&:hover': {
            bgcolor: alpha(theme.palette.common.white, 0.15),
        },
        '&:active': {
            transform: 'scale(0.92)',
        },
    },
});

export const FilterToolbar: React.FC<FilterToolbarProps> = ({actions, children}) => (
    <Card sx={{overflow: 'hidden'}}>
        <Toolbar variant="dense" disableGutters sx={cardHeaderStyle}>
            <Icon sx={{fontSize: 20, mr: 0.75, opacity: 0.9}} baseClassName="material-symbols-outlined">tune</Icon>
            <Typography variant="subtitle2" noWrap sx={{fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.01em'}}>Filters</Typography>
            <Box sx={{flexGrow: 1}} />
            {actions}
        </Toolbar>
        <CardContent sx={{display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', py: 1.5, '&:last-child': {pb: 1.5}}}>
            {children}
        </CardContent>
    </Card>
);
