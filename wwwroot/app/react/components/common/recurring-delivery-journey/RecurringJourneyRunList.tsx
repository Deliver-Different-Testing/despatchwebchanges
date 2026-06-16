/**
 * Vertical timeline list for the Recurring Log. Renders one
 * RecurringJourneyRunRow per run, with a continuous vertical rail.
 */

import React from 'react';
import Box from '@mui/material/Box';
import type {SxProps, Theme} from '@mui/material/styles';
import {RecurringJourneyRunRow} from './RecurringJourneyRunRow';
import type {RecurringJourneyRun} from './RecurringDeliveryJourney.types';

interface RecurringJourneyRunListProps {
    runs: RecurringJourneyRun[];
    onParentClick: (jobId: number, jobNumber: string) => void;
    onChildClick: (jobId: number, jobNumber: string) => void;
}

const listSx = ((theme: Theme) => ({
    position: 'relative',
    listStyle: 'none',
    m: 0,
    p: 0,
    py: 0.75,
    '&::before': {
        content: '""',
        position: 'absolute',
        top: 14,
        bottom: 14,
        left: 32, // matches first column (16 px panel-pad + 16 to dot centre)
        width: '2px',
        bgcolor: theme.palette.divider,
    },
})) satisfies SxProps<Theme>;

export const RecurringJourneyRunList: React.FC<RecurringJourneyRunListProps> = ({
    runs,
    onParentClick,
    onChildClick,
}) => (
    <Box component="ul" sx={listSx}>
        {runs.map(run => (
            <Box component="li" key={run.parentJobId}>
                <RecurringJourneyRunRow
                    run={run}
                    onParentClick={onParentClick}
                    onChildClick={onChildClick}
                />
            </Box>
        ))}
    </Box>
);

export default RecurringJourneyRunList;
