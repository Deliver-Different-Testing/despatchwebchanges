/**
 * Vertical timeline list for the Recurring Log. Renders one
 * RecurringJourneyRunRow per run, with a continuous vertical rail.
 */

import React from 'react';
import {Box} from '@mantine/core';
import {RecurringJourneyRunRow} from './RecurringJourneyRunRow';
import type {RecurringJourneyRun} from './RecurringDeliveryJourney.types';
import classes from './RecurringDeliveryJourney.module.css';

interface RecurringJourneyRunListProps {
    runs: RecurringJourneyRun[];
    onParentClick: (jobId: number, jobNumber: string) => void;
    onChildClick: (jobId: number, jobNumber: string) => void;
}

export const RecurringJourneyRunList: React.FC<RecurringJourneyRunListProps> = ({
    runs,
    onParentClick,
    onChildClick,
}) => (
    // The rail is a ::before on the list — see the stylesheet.
    <Box component="ul" className={classes.runList}>
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
