/**
 * 4-cell breakdown bar at the top of the Recurring Log panel.
 * Total / Completed / Voided / Pending.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type {SxProps, Theme} from '@mui/material/styles';
import type {RecurringJourneyBreakdown as RecurringJourneyBreakdownData} from './RecurringDeliveryJourney.types';

interface RecurringJourneyBreakdownProps {
    breakdown: RecurringJourneyBreakdownData;
}

const wrapperSx = ((theme: Theme) => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1px',
    bgcolor: theme.palette.divider,
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 1,
    overflow: 'hidden',
    mx: 2,
    mt: 2,
})) satisfies SxProps<Theme>;

const cellSx = {
    bgcolor: 'background.paper',
    px: 1,
    py: 1.25,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0.25,
} satisfies SxProps<Theme>;

const labelSx = {
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    color: 'text.secondary',
} satisfies SxProps<Theme>;

interface CellProps {
    label: string;
    value: number;
    color: SxProps<Theme>;
}

const Cell: React.FC<CellProps> = ({label, value, color}) => (
    <Box sx={cellSx}>
        <Typography variant="body1" component="div" sx={{fontSize: 18, fontWeight: 700, lineHeight: 1.1, ...color}}>
            {value}
        </Typography>
        <Typography component="div" sx={labelSx}>
            {label}
        </Typography>
    </Box>
);

export const RecurringJourneyBreakdown: React.FC<RecurringJourneyBreakdownProps> = ({breakdown}) => (
    <Box sx={wrapperSx}>
        <Cell label="Total" value={breakdown.total} color={{color: 'text.primary'}} />
        <Cell label="Completed" value={breakdown.completed} color={{color: 'success.dark'}} />
        <Cell label="Voided" value={breakdown.voided} color={{color: 'error.dark'}} />
        <Cell label="Pending" value={breakdown.pending} color={{color: 'warning.dark'}} />
    </Box>
);

export default RecurringJourneyBreakdown;
