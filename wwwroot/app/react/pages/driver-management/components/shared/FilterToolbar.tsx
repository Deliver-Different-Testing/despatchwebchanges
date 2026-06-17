import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TuneIcon from '@mui/icons-material/Tune';
import {PanelHeader} from '../../../../components/common/panel-header';

interface FilterToolbarProps {
    actions?: React.ReactNode;
    children: React.ReactNode;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({actions, children}) => (
    <Card sx={{borderRadius: 1, overflow: 'hidden'}}>
        <PanelHeader icon={<TuneIcon />} title="Filters" action={actions} />
        <CardContent sx={{display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', py: 1.5, '&:last-child': {pb: 1.5}}}>
            {children}
        </CardContent>
    </Card>
);
